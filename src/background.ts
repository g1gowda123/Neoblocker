import { analyzeContent, getModelStatuses } from "~utils/ai-router"
import { getSettings } from "~utils/storage"

// In-memory cache for analyzed videos to prevent duplicate network calls
const videoAnalysisCache = new Map<
  string,
  { action: "LOCAL_BLOCK" | "SAFE"; reason?: string }
>()

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (match, dec) =>
      String.fromCharCode(parseInt(dec, 10))
    )
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
}

function extractJsonBlock(html: string, varName: string): string | null {
  const regex = new RegExp(`${varName}\\s*=\\s*({)`)
  const match = regex.exec(html)
  if (!match) return null

  const startIndex = match.index + match[0].length - 1 // Index of the opening brace '{'
  let depth = 0
  let inString = false
  let escape = false

  for (let i = startIndex; i < html.length; i++) {
    const char = html[i]

    if (inString) {
      if (escape) {
        escape = false
      } else if (char === "\\") {
        escape = true
      } else if (char === '"') {
        inString = false
      }
    } else {
      if (char === '"') {
        inString = true
      } else if (char === "{") {
        depth++
      } else if (char === "}") {
        depth--
        if (depth === 0) {
          return html.slice(startIndex, i + 1)
        }
      }
    }
  }
  return null
}

async function fetchVideoData(
  videoId: string
): Promise<{ title: string; deepText: string }> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`
    const res = await fetch(url)
    const html = await res.text()

    // 1. Get player response JSON
    const playerResponseJson = extractJsonBlock(html, "ytInitialPlayerResponse")
    if (!playerResponseJson) {
      return { title: "", deepText: "" }
    }
    const playerResponse = JSON.parse(playerResponseJson)
    const videoDetails = playerResponse.videoDetails || {}
    const title = videoDetails.title || ""
    const description = videoDetails.shortDescription || ""
    const author = videoDetails.author || ""

    let subtitlesPromise = Promise.resolve("")
    let commentsPromise = Promise.resolve("")

    // 2. Setup subtitle fetch promise
    const captionTracks =
      playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks
    if (captionTracks && captionTracks.length > 0) {
      const englishTrack =
        captionTracks.find((track: any) => track.languageCode === "en") ||
        captionTracks[0]
      if (englishTrack && englishTrack.baseUrl) {
        subtitlesPromise = fetch(englishTrack.baseUrl)
          .then((r) => r.text())
          .then((capXml) => {
            let subtitles = capXml.replace(/<[^>]*>/g, " ")
            return decodeHtmlEntities(subtitles)
          })
          .catch((err) => {
            console.warn(
              `[Neoblocker] Failed to fetch subtitles for ${videoId}:`,
              err
            )
            return ""
          })
      }
    }

    // 3. Setup comments fetch promise (InnerTube API)
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)
    if (apiKeyMatch) {
      const apiKey = apiKeyMatch[1]
      const strJson = JSON.stringify(playerResponse)
      const tokenMatch = strJson.match(/"token":"([^"]+)"/)
      if (tokenMatch) {
        const token = tokenMatch[1]
        commentsPromise = fetch(
          `https://www.youtube.com/youtubei/v1/next?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: {
                client: { clientName: "WEB", clientVersion: "2.20240308.00.00" }
              },
              continuation: token
            })
          }
        )
          .then((r) => r.json())
          .then((nextJson) => {
            const commentList: string[] = []
            const mutations =
              nextJson.frameworkUpdates?.entityBatchUpdate?.mutations || []
            for (const m of mutations) {
              const content =
                m.payload?.commentEntityPayload?.properties?.content?.content
              if (content) commentList.push(content)
            }
            return commentList.join(" ")
          })
          .catch((err) => {
            console.warn(
              `[Neoblocker] Failed to fetch comments for ${videoId}:`,
              err
            )
            return ""
          })
      }
    }

    // Await both subtitle and comment fetches in parallel
    const [subtitles, comments] = await Promise.all([
      subtitlesPromise,
      commentsPromise
    ])

    // ── Backend optimisation: skip description when subtitles are present
    // (subtitles have far richer signal). When absent, include only the first
    // 300 chars of the description to keep token count low.
    const descriptionSnippet = subtitles ? "" : description.slice(0, 300)

    const deepText = [
      author ? `Channel: ${author}` : "",
      descriptionSnippet ? `Description: ${descriptionSnippet}` : "",
      subtitles ? `Subtitles: ${subtitles}` : "",
      comments ? `Comments: ${comments}` : ""
    ]
      .filter(Boolean)
      .join("\n")

    return { title, deepText }
  } catch (err) {
    console.error(`[Neoblocker] Error prefetching data for ${videoId}:`, err)
    return { title: "", deepText: "" }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ─── Analyze single text request (quick title/channel evaluation) ───────────
  if (request.action === "analyze") {
    const text: string = request.text
    console.log(
      `[Neoblocker] Analyze text request: "${text.substring(0, 50)}..."`
    )

    getSettings()
      .then((settings) => analyzeContent(text, settings, request.isTitle))
      .then((result) => {
        sendResponse(result)
      })
      .catch((err) => {
        console.error("[Neoblocker] Analysis pipeline error:", err)
        sendResponse({ action: "SAFE", error: String(err) })
      })

    return true // Indicate async response
  }

  // ─── Prefetch and Analyze YouTube video ID ─────────────────────────────────
  if (request.action === "analyzeVideoId") {
    const videoId: string = request.videoId

    // Check cache first to avoid repeating network requests
    if (videoAnalysisCache.has(videoId)) {
      const cachedResult = videoAnalysisCache.get(videoId)
      console.log(
        `[Neoblocker] Cache hit for video ID ${videoId}:`,
        cachedResult
      )
      sendResponse(cachedResult)
      return false
    }

    console.log(
      `[Neoblocker] Cache miss. Prefetching & analyzing video ID: ${videoId}`
    )

    fetchVideoData(videoId)
      .then(async ({ title, deepText }) => {
        if (!title && !deepText) return { action: "SAFE" as const }
        const settings = await getSettings()

        // Pass One: The Title Scan
        if (title) {
          const titleResult = await analyzeContent(title, settings, true)
          if (titleResult.action === "LOCAL_BLOCK") {
            return titleResult
          }
        }

        // Pass Two: The Deep Scan
        if (deepText) {
          return analyzeContent(deepText, settings, false)
        }

        return { action: "SAFE" as const }
      })
      .then((result) => {
        // Cache result
        videoAnalysisCache.set(videoId, result)
        sendResponse(result)
      })
      .catch((err) => {
        console.error(`[Neoblocker] Analysis failed for video ${videoId}:`, err)
        sendResponse({ action: "SAFE", error: String(err) })
      })

    return true // Indicate async response
  }

  // ─── Model status query (from popup) ────────────────────────────────────────
  if (request.action === "getModelStatus") {
    sendResponse(getModelStatuses())
    return false
  }
})
