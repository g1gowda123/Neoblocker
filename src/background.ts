import { analyzeContent, applyModelSettings, getModelStatuses, warmupModels } from "~utils/ai-router"
import {
  decodeHtmlEntities,
  extractJsonBlock,
  isTrustedYouTubeUrl,
  isValidVideoId,
  sampleText
} from "~utils/extract"
import {
  addBlockedCount,
  ensureSettingsCurrent,
  getSettings,
  getStats,
  STATS_KEY,
  todayKey
} from "~utils/storage"

const WATCH_FETCH_TIMEOUT = 12_000
const SUBTITLE_FETCH_TIMEOUT = 8_000
const CACHE_TTL = 30 * 60 * 1000
const CACHE_MAX = 100

// ─────────────────────────────────────────────────────────────────────────────
// Small LRU + TTL cache for full-video analyses.
// ─────────────────────────────────────────────────────────────────────────────
interface VideoAnalysisResult {
  action: "LOCAL_BLOCK" | "SAFE"
  reason?: string
  error?: string
}

interface CacheEntry {
  expires: number
  value: Promise<VideoAnalysisResult>
}

const videoAnalysisCache = new Map<string, CacheEntry>()

function getCached(
  videoId: string
): Promise<VideoAnalysisResult> | undefined {
  const entry = videoAnalysisCache.get(videoId)
  if (!entry) return undefined
  if (entry.expires < Date.now()) {
    videoAnalysisCache.delete(videoId)
    return undefined
  }
  // Refresh LRU position.
  videoAnalysisCache.delete(videoId)
  videoAnalysisCache.set(videoId, entry)
  return entry.value
}

function setCached(videoId: string, value: CacheEntry["value"]) {
  if (videoAnalysisCache.size >= CACHE_MAX) {
    const oldest = videoAnalysisCache.keys().next().value
    if (oldest) videoAnalysisCache.delete(oldest)
  }
  videoAnalysisCache.set(videoId, { expires: Date.now() + CACHE_TTL, value })
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch helpers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const response = await fetchWithTimeout(
    url,
    {
      credentials: "omit",
      headers: { "Accept-Language": "en-US,en;q=0.9" }
    },
    timeoutMs
  )
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  // Guard against unexpectedly large payloads.
  if (text.length > 8_000_000) throw new Error("Response too large")
  return text
}

interface SubtitleTrack {
  baseUrl?: string
  languageCode?: string
  kind?: string
}

async function extractSubtitleText(
  playerResponse: any
): Promise<string | null> {
  const tracks: SubtitleTrack[] | undefined =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(tracks) || tracks.length === 0) return null

  const usable = tracks.filter(
    (item) => item.baseUrl && isTrustedYouTubeUrl(item.baseUrl)
  )
  if (usable.length === 0) return null

  const isEnglish = (item: SubtitleTrack) =>
    /^en(?:-|$)/i.test(item.languageCode || "")
  // Prefer manual English, then English auto-captions, then any manual
  // track, then whatever is left. This avoids picking an unrelated
  // auto-translated track when the video has English captions.
  const track =
    usable.find((item) => item.kind !== "asr" && isEnglish(item)) ||
    usable.find(isEnglish) ||
    usable.find((item) => item.kind !== "asr") ||
    usable[0]
  if (!track?.baseUrl) return null

  const url = new URL(track.baseUrl)
  url.searchParams.set("fmt", "json3")
  const body = await fetchText(url.toString(), SUBTITLE_FETCH_TIMEOUT)
  const data = JSON.parse(body)
  const events: Array<{ segs?: Array<{ utf8?: string }> }> =
    data?.events || []

  const text = events
    .flatMap((event) => event.segs || [])
    .map((segment) => segment.utf8 || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  return text || null
}

interface VideoData {
  text: string
  title: string
}

async function fetchVideoData(videoId: string): Promise<VideoData> {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
  const html = await fetchText(url, WATCH_FETCH_TIMEOUT)

  const playerJson = extractJsonBlock(html, "ytInitialPlayerResponse")
  let playerResponse: any = {}
  if (playerJson) {
    try {
      playerResponse = JSON.parse(playerJson)
    } catch {
      playerResponse = {}
    }
  }

  const details = playerResponse?.videoDetails || {}
  const title =
    typeof details.title === "string"
      ? decodeHtmlEntities(details.title).trim()
      : "Unknown Title"
  const channel =
    typeof details.author === "string"
      ? decodeHtmlEntities(details.author).trim()
      : "Unknown"
  const description =
    typeof details.shortDescription === "string"
      ? decodeHtmlEntities(details.shortDescription).slice(0, 600)
      : ""

  let subtitleText: string | null = null
  try {
    subtitleText = await extractSubtitleText(playerResponse)
  } catch (error) {
    console.warn("[Neoblocker] Subtitle fetch failed:", error)
  }

  const sections: string[] = []
  if (title && title !== "Unknown Title") sections.push(`Title: ${title}`)
  sections.push(`Channel: ${channel}`)
  if (description) sections.push(`Description: ${description}`)
  if (subtitleText) sections.push(`Subtitles: ${sampleText(subtitleText, 5000)}`)

  return { text: sections.join("\n"), title }
}

async function analyzeVideoId(videoId: string) {
  const settings = await getSettings()
  if (!settings.enabled || !settings.deepScan || !settings.enableToxicity) {
    return { action: "SAFE" as const }
  }

  const cached = getCached(videoId)
  if (cached) return cached

  const analysis = (async () => {
    try {
      const { text } = await fetchVideoData(videoId)
      if (!text || text.length < 12) return { action: "SAFE" as const }
      const result = await analyzeContent(text, settings, false)
      if (result.error) {
        // Do not memoise transient failures.
        videoAnalysisCache.delete(videoId)
      }
      return result
    } catch (error) {
      console.warn("[Neoblocker] Video analysis failed:", error)
      // A network/parse failure must not be memoised as a SAFE verdict.
      videoAnalysisCache.delete(videoId)
      return { action: "SAFE" as const, error: "Video analysis failed" }
    }
  })()

  setCached(videoId, analysis)
  return analysis
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge + stats
// ─────────────────────────────────────────────────────────────────────────────
async function refreshBadge() {
  if (!chrome.action?.setBadgeText) return
  try {
    const stats = await getStats()
    const count = stats.date === todayKey() ? stats.total : 0
    await chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" })
    await chrome.action.setBadgeText({
      text: count > 0 ? String(Math.min(count, 999)) : ""
    })
  } catch {
    // Badge updates are cosmetic; never let them crash the worker.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message handling
// ─────────────────────────────────────────────────────────────────────────────
function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function handleMessage(message: unknown) {
  if (!isRecord(message) || typeof message.action !== "string") {
    return { error: "Invalid message" }
  }

  switch (message.action) {
    case "analyze": {
      if (typeof message.text !== "string") {
        return { action: "SAFE", error: "Invalid text" }
      }
      const settings = await getSettings()
      if (!settings.enabled) return { action: "SAFE" }
      return analyzeContent(
        message.text.slice(0, 5000),
        settings,
        message.isTitle === true
      )
    }

    case "analyzeVideoId": {
      if (!isValidVideoId(message.videoId)) {
        return { action: "SAFE", error: "Invalid video ID" }
      }
      return analyzeVideoId(message.videoId)
    }

    case "getModelStatus":
      return { statuses: getModelStatuses() }

    case "warmupModels": {
      const settings = await getSettings()
      return { statuses: await warmupModels(settings) }
    }

    case "applySettings": {
      const settings = await getSettings()
      applyModelSettings(settings)
      return { ok: true }
    }

    case "recordBlock": {
      const count =
        typeof message.count === "number" && Number.isFinite(message.count)
          ? Math.min(10, Math.max(1, Math.floor(message.count)))
          : 1
      await addBlockedCount(count)
      await refreshBadge()
      return { ok: true }
    }

    case "refreshBadge":
      await refreshBadge()
      return { ok: true }

    default:
      return { error: "Unknown action" }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error("[Neoblocker] Message handler failed:", error)
      sendResponse({ action: "SAFE", error: "Internal error" })
    })
  return true
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return

  if (changes[STATS_KEY]) {
    void getSettings()
      .then((settings) => {
        if (!settings.enabled) {
          void chrome.action?.setBadgeText?.({ text: "" })
          return
        }
        return refreshBadge()
      })
      .catch((error) => console.warn("[Neoblocker] Badge update failed:", error))
  }

  if (!changes.neoblocker_settings) return
  // Persist the one-time schema migration even if it was triggered by an old
  // settings object arriving from another context.
  if (
    typeof changes.neoblocker_settings.newValue?.settingsVersion !== "number"
  ) {
    void ensureSettingsCurrent()
  }
  // Deep-scan results depend on thresholds and enabled models; never serve a
  // result produced under the previous configuration.
  videoAnalysisCache.clear()
  void getSettings()
    .then((settings) => {
      applyModelSettings(settings)
      if (!settings.enabled) {
        try {
          void chrome.action?.setBadgeText?.({ text: "" })
        } catch {
          // Badge updates are cosmetic.
        }
        return
      }
      return refreshBadge()
    })
    .catch((error) => console.warn("[Neoblocker] Settings update failed:", error))
})

function applyStoredSettings() {
  void ensureSettingsCurrent()
    .then((settings) => {
      applyModelSettings(settings)
    })
    .catch((error) =>
      console.warn("[Neoblocker] Settings migration failed:", error)
    )
  void refreshBadge()
}

chrome.runtime.onInstalled.addListener(applyStoredSettings)
chrome.runtime.onStartup.addListener(applyStoredSettings)

applyStoredSettings()
