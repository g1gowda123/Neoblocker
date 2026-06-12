import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState, useRef } from "react"
import { createPortal } from "react-dom"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
}

console.log("[Neoblocker] Content script active.")

export const getStyle = (): HTMLStyleElement => {
  const baseFontSize = 16
  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)")
  updatedCssText = updatedCssText.replace(/([\\d.]+)rem/g, (_, remValue) => {
    return `${parseFloat(remValue) * baseFontSize}px`
  })

  const styleElement = document.createElement("style")
  styleElement.textContent = updatedCssText

  if (!document.querySelector("#plasmo-firewall-styles")) {
    const globalStyle = styleElement.cloneNode(true) as HTMLStyleElement
    globalStyle.id = "plasmo-firewall-styles"
    globalStyle.textContent =
      globalStyle.textContent?.replaceAll(":host(plasmo-csui)", ":root") || ""
    document.head.appendChild(globalStyle)
  }

  return styleElement
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface BlockedItem {
  id: string
  element: HTMLElement
  reason: string
  videoId?: string
  commentId?: string
}

// ─── Firewall Overlay Card ─────────────────────────────────────────────────────
const FirewallOverlay = ({
  item,
  onReveal,
}: {
  item: BlockedItem
  onReveal: () => void
}) => {
  const ytDark = document.documentElement.hasAttribute("dark")
  const bg = ytDark ? "#0f0f0f" : "#ffffff"
  const txt = ytDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)"
  const sub = ytDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)"
  const btn = ytDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"
  const btnHover = ytDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.11)"

  return (
    <div
      className="plasmo-absolute plasmo-inset-0 plasmo-z-[99999] plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-p-4 plasmo-text-center plasmo-box-border"
      style={{
        backgroundColor: bg,
        borderRadius: "inherit",
        fontFamily: "Roboto, Arial, sans-serif",
        opacity: 0.97,
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation()
      }}
    >
      <svg
        style={{ width: 15, height: 15, marginBottom: 6, opacity: 0.35, color: sub }}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
          d="M12 3l7 4v5c0 4.418-3.134 8.215-7 9-3.866-.785-7-4.582-7-9V7l7-4z" />
      </svg>
      <span style={{ fontSize: 11, fontWeight: 500, color: txt, marginBottom: 2 }}>
        Filtered by Neoblocker
      </span>
      <span style={{ fontSize: 10, color: sub, marginBottom: 12 }}>
        {item.reason}
      </span>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation()
          onReveal()
        }}
        style={{
          backgroundColor: btn,
          color: txt,
          border: "none",
          borderRadius: 18,
          padding: "5px 14px",
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "Roboto, Arial, sans-serif",
          transition: "background-color 0.15s",
        }}
        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = btnHover }}
        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = btn }}
      >
        Show anyway
      </button>
    </div>
  )
}

// ─── DOM selectors for video cards + comment elements ─────────────────────────
const CARD_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-reel-item-renderer",       // Shorts shelf thumbnails (home feed)
  "ytd-rich-grid-slim-media",     // Shorts grid tiles
  "ytd-ad-slot-renderer",
].join(", ")

const COMMENT_SELECTORS = [
  "ytd-comment-thread-renderer",
  "ytd-comment-renderer",
].join(", ")

const CONTENT_SELECTORS = CARD_SELECTORS + ", " + COMMENT_SELECTORS

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the 11-char video ID from any card element or the current URL (for Shorts player). */
function getVideoId(el: HTMLElement): string {
  // Try anchor tags first (works for shelf cards and grid tiles)
  for (const a of Array.from(el.querySelectorAll("a"))) {
    const href = a.getAttribute("href") || ""
    const m = href.match(/(?:v=|\/shorts\/)([a-zA-Z0-9_-]{11})/)
    if (m) return m[1]
  }
  return ""
}

/** Get the video ID that is currently playing in the Shorts player from the URL. */
function getShortsPlayerVideoId(): string {
  const m = window.location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : ""
}

/** Returns true if we are currently on the Shorts player page. */
function isOnShortsPage(): boolean {
  return window.location.pathname.startsWith("/shorts/")
}

/** Create a mount node and append it to the element for a React portal overlay. */
function createMountNode(el: HTMLElement): HTMLElement {
  const mountNode = document.createElement("div")
  mountNode.className = "plasmo-firewall-mount"
  mountNode.style.cssText = "position:absolute;inset:0;z-index:99999;"
  el.appendChild(mountNode)
  return mountNode
}

/** Apply block styling to an element in blur mode. */
function applyBlurStyle(el: HTMLElement) {
  el.classList.add("firewall-blurred")
  el.style.overflow = "visible"
  el.style.position = "relative"
  el.dataset.neoblockerBlocked = "true"
}

/** Apply block styling to an element in remove mode. */
function applyRemoveStyle(el: HTMLElement) {
  el.style.display = "none"
  el.dataset.neoblockerBlocked = "true"
  el.dataset.neoblockerRemoved = "true"
}

// ─── OverlayManager ───────────────────────────────────────────────────────────
const OverlayManager = () => {
  const [blockedItems, setBlockedItems] = useState<BlockedItem[]>([])
  const [filterMode, setFilterMode] = useState<"blur" | "remove">("blur")
  const filterModeRef = useRef<"blur" | "remove">("blur")
  const settingsRef = useRef<any>({})

  // Cache of video analysis results: videoId → reason (only blocked ones stored)
  const blockedVideoIds = useRef(new Map<string, string>())
  // Videos already sent off for analysis (avoid duplicate requests)
  const analyzedVideoIds = useRef(new Set<string>())
  // Videos the user explicitly revealed (never re-block)
  const revealedVideoIds = useRef(new Set<string>())
  // Comment reason map for self-healing
  const blockedCommentReasons = useRef(new Map<string, string>())

  // ─── Load settings from storage and keep in sync ───────────────────────────
  useEffect(() => {
    const loadSettings = () => {
      chrome.storage.local.get("neoblocker_settings", (res) => {
        settingsRef.current = res?.neoblocker_settings || {}
        const mode: "blur" | "remove" = settingsRef.current.filterMode || "blur"
        filterModeRef.current = mode
        setFilterMode(mode)
      })
    }
    loadSettings()
    chrome.storage.onChanged.addListener(loadSettings)
    return () => chrome.storage.onChanged.removeListener(loadSettings)
  }, [])

  // ─── Concurrency queue for deep video analysis ─────────────────────────────
  const requestQueue = useRef<string[]>([])
  const activeRequests = useRef(0)
  const MAX_CONCURRENCY = 5

  const processQueue = async () => {
    if (activeRequests.current >= MAX_CONCURRENCY || requestQueue.current.length === 0) return
    const videoId = requestQueue.current.shift()
    if (!videoId) return
    activeRequests.current++
    processQueue() // kick off next in parallel
    try {
      const response = await chrome.runtime.sendMessage({ action: "analyzeVideoId", videoId })
      const { action, reason } = response || { action: "SAFE" }
      if (action === "LOCAL_BLOCK") {
        blockedVideoIds.current.set(videoId, reason || "Flagged Content")
        blockCardsWithId(videoId, reason || "Flagged Content")
      }
    } catch (err) {
      console.error(`[Neoblocker] Queue analysis failed for ${videoId}:`, err)
    } finally {
      activeRequests.current--
      processQueue()
    }
  }

  const enqueueVideo = (videoId: string) => {
    if (analyzedVideoIds.current.has(videoId)) return
    analyzedVideoIds.current.add(videoId)
    requestQueue.current.push(videoId)
    processQueue()
  }

  // ─── Core: apply block to a DOM element ────────────────────────────────────
  const blockElement = (el: HTMLElement, reason: string, videoId?: string, commentId?: string) => {
    if (el.dataset.neoblockerBlocked === "true") return
    if (filterModeRef.current === "remove") {
      applyRemoveStyle(el)
      if (videoId) el.dataset.neoblockerVideoId = videoId
      if (commentId) el.dataset.neoblockerCommentId = commentId
      return
    }
    // Blur mode
    applyBlurStyle(el)
    if (videoId) el.dataset.neoblockerVideoId = videoId
    if (commentId) el.dataset.neoblockerCommentId = commentId
    if (!el.querySelector(".plasmo-firewall-mount")) {
      const mountNode = createMountNode(el)
      const id = commentId || Math.random().toString(36).substring(7)
      setBlockedItems((prev) => [
        ...prev.filter((i) => (commentId ? i.commentId !== commentId : i.videoId !== videoId)),
        { id, element: mountNode, reason, videoId, commentId },
      ])
      if (commentId) {
        blockedCommentReasons.current.set(commentId, reason)
      }
    }
  }

  // ─── Block all DOM cards matching a videoId ─────────────────────────────────
  const blockCardsWithId = (videoId: string, reason: string) => {
    if (revealedVideoIds.current.has(videoId)) return
    document.querySelectorAll<HTMLElement>(CARD_SELECTORS).forEach((el) => {
      if (el.dataset.neoblockerBlocked === "true") return
      if (getVideoId(el) === videoId) {
        blockElement(el, reason, videoId)
      }
    })
  }

  // ─── Reveal handlers ────────────────────────────────────────────────────────
  const handleReveal = (videoId: string) => {
    revealedVideoIds.current.add(videoId)
    setBlockedItems((prev) => prev.filter((item) => item.videoId !== videoId))
    document.querySelectorAll<HTMLElement>('[data-neoblocker-blocked="true"]').forEach((el) => {
      const elVideoId = el.dataset.neoblockerVideoId || el.dataset.neoblockerShortsId || getVideoId(el)
      if (elVideoId === videoId) {
        el.classList.remove("firewall-blurred")
        el.removeAttribute("data-neoblocker-blocked")
        el.dataset.neoblockerRevealed = "true"
        el.style.overflow = ""
        el.style.position = ""
        el.querySelectorAll(".plasmo-firewall-mount").forEach((m) => m.remove())
      }
    })
    // Also clear the active Shorts player if it matches this videoId
    const playerEl = document.querySelector<HTMLElement>(
      "ytd-shorts ytd-reel-video-renderer[is-active], ytd-shorts ytd-reel-video-renderer:first-child, #shorts-player, ytd-shorts"
    )
    if (playerEl && getShortsPlayerVideoId() === videoId) {
      playerEl.classList.remove("firewall-blurred")
      playerEl.removeAttribute("data-neoblocker-blocked")
      playerEl.dataset.neoblockerRevealed = "true"
      playerEl.style.overflow = ""
      playerEl.style.position = ""
      playerEl.querySelectorAll(".plasmo-firewall-mount").forEach((m) => m.remove())
    }
  }

  const handleRevealComment = (commentId: string) => {
    setBlockedItems((prev) => prev.filter((item) => item.commentId !== commentId))
    const el = document.querySelector<HTMLElement>(`[data-neoblocker-comment-id="${commentId}"]`)
    if (el) {
      el.classList.remove("firewall-blurred")
      el.removeAttribute("data-neoblocker-blocked")
      el.dataset.neoblockerRevealed = "true"
      el.style.overflow = ""
      el.style.position = ""
      el.querySelectorAll(".plasmo-firewall-mount").forEach((m) => m.remove())
    }
  }

  // ─── Main analysis logic ────────────────────────────────────────────────────
  useEffect(() => {
    // ── processElement: analyse one card / comment renderer ──────────────────
    const processElement = async (target: HTMLElement) => {
      // Fan out Shorts shelves to each reel item
      if (target.tagName === "YTD-REEL-SHELF-RENDERER") {
        target.querySelectorAll<HTMLElement>("ytd-reel-item-renderer").forEach(processElement)
        return
      }

      // Thread → delegate to the inner comment renderer
      if (target.tagName === "YTD-COMMENT-THREAD-RENDERER") {
        const commentRenderer = target.querySelector<HTMLElement>("ytd-comment-renderer")
        if (commentRenderer) processElement(commentRenderer)
        return
      }

      // ── Comment processing ────────────────────────────────────────────────
      if (target.tagName === "YTD-COMMENT-RENDERER") {
        if (target.dataset.neoblockerBlocked === "true") {
          if (filterModeRef.current === "remove" && target.style.display !== "none") {
            target.style.display = "none"
          }
          return
        }
        if (target.dataset.neoblockerRevealed === "true") return

        const contentEl = target.querySelector("#content-text")
        if (!contentEl) return
        const commentText = (contentEl.textContent || "").replace(/\s+/g, " ").trim()
        if (commentText.length < 5) return

        const lowerText = commentText.toLowerCase()
        const settings = settingsRef.current

        // Assign a stable ID so we can track and self-heal this comment
        if (!target.dataset.neoblockerCommentId) {
          target.dataset.neoblockerCommentId = `c-${Math.random().toString(36).substring(7)}`
        }
        const commentId = target.dataset.neoblockerCommentId

        // Banned keywords (highest priority)
        if (matchesBannedKeyword(settings, lowerText)) {
          blockElement(target, "Banned Keyword", undefined, commentId)
          return
        }
        // Allowlist exceptions
        if (matchesException(settings, lowerText)) return

        try {
          const response = await chrome.runtime.sendMessage({
            action: "analyze",
            text: commentText,
            isTitle: false,
          })
          if (response?.action === "LOCAL_BLOCK") {
            blockElement(target, response.reason || "Flagged Content", undefined, commentId)
          }
        } catch (err) {
          console.error("[Neoblocker] Comment analysis failed:", err)
        }
        return
      }

      // ── Video card processing ─────────────────────────────────────────────
      if (target.dataset.neoblockerBlocked === "true") {
        if (filterModeRef.current === "remove" && target.style.display !== "none") {
          target.style.display = "none"
        }
        return
      }
      if (target.dataset.neoblockerRevealed === "true") return

      const videoId = getVideoId(target)
      if (videoId && revealedVideoIds.current.has(videoId)) return

      const settings = settingsRef.current
      const channelName = extractChannelName(target)
      const titleText = extractTitleText(target)
      const lowerChannel = channelName.toLowerCase()
      const lowerTitle = titleText.toLowerCase()

      // Banned keywords
      if (matchesBannedKeyword(settings, lowerTitle, lowerChannel)) {
        if (videoId) blockedVideoIds.current.set(videoId, "Banned Keyword")
        blockElement(target, "Banned Keyword", videoId || undefined)
        return
      }

      if (!videoId) return

      // If already confirmed blocked by cache
      if (blockedVideoIds.current.has(videoId)) {
        blockElement(target, blockedVideoIds.current.get(videoId)!, videoId)
        return
      }

      // Allowlist exceptions
      if (matchesException(settings, lowerTitle, lowerChannel)) return

      // Quick title analysis
      if (lowerTitle) {
        try {
          const response = await chrome.runtime.sendMessage({
            action: "analyze",
            text: titleText,
            isTitle: true,
          })
          if (response?.action === "LOCAL_BLOCK") {
            const reason = response.reason || "Flagged Content"
            blockedVideoIds.current.set(videoId, reason)
            blockElement(target, reason, videoId)
            return
          }
        } catch (err) {
          console.error("[Neoblocker] Title analysis failed:", err)
        }
      }

      // Deep analysis via background
      enqueueVideo(videoId)
    }

    // ── processShortsPlayer: block/allow the currently-visible Short ─────────
    const processShortsPlayer = async () => {
      const videoId = getShortsPlayerVideoId()
      if (!videoId) return

      // Find the Shorts player container to apply the overlay on
      const playerEl = document.querySelector<HTMLElement>(
        "ytd-shorts ytd-reel-video-renderer[is-active], ytd-shorts ytd-reel-video-renderer:first-child, #shorts-player, ytd-shorts"
      )
      if (!playerEl) return

      // If user revealed this video, skip
      if (revealedVideoIds.current.has(videoId)) {
        clearShortsOverlay(playerEl, videoId)
        playerEl.dataset.neoblockerShortsId = videoId
        return
      }

      // Check cache first (if we already know it's blocked, block it immediately)
      if (blockedVideoIds.current.has(videoId)) {
        blockShortsPlayer(playerEl, videoId, blockedVideoIds.current.get(videoId)!)
        playerEl.dataset.neoblockerShortsId = videoId
        return
      }

      // Already handled for this video ID
      if (playerEl.dataset.neoblockerShortsId === videoId) return

      // Grab the title text from the Shorts player UI
      const titleEl = playerEl.querySelector<HTMLElement>(
        "a#video-title-link, h3 a#video-title, #video-title-link, #video-title, .reel-item-title, h3 yt-formatted-string, #overlays h3, span#title, #title"
      )
      const titleText = (titleEl?.textContent || "").replace(/\s+/g, " ").trim()
      const lowerTitle = titleText.toLowerCase()

      // Grab the channel name from the Shorts player UI
      const channelEl = playerEl.querySelector<HTMLElement>(
        "ytd-channel-name #text, .ytd-channel-name, #channel-name, #byline"
      )
      const channelName = (channelEl?.textContent || "").replace(/\s+/g, " ").trim()
      const lowerChannel = channelName.toLowerCase()

      // If title text is not yet populated, wait until it is
      if (!titleText) {
        return
      }

      // Mark as handled now that we have the text and are running the evaluation
      playerEl.dataset.neoblockerShortsId = videoId

      const settings = settingsRef.current

      // Banned keyword check (checks title and channel)
      if (matchesBannedKeyword(settings, lowerTitle, lowerChannel)) {
        blockedVideoIds.current.set(videoId, "Banned Keyword")
        blockShortsPlayer(playerEl, videoId, "Banned Keyword")
        return
      }

      // Exception check
      if (matchesException(settings, lowerTitle, lowerChannel)) return

      // Quick title analysis
      try {
        const response = await chrome.runtime.sendMessage({
          action: "analyze",
          text: titleText,
          isTitle: true,
        })
        if (response?.action === "LOCAL_BLOCK") {
          const reason = response.reason || "Flagged Content"
          blockedVideoIds.current.set(videoId, reason)
          // Re-query player element in case it changed during async call
          const currentPlayerEl = document.querySelector<HTMLElement>(
            "ytd-shorts ytd-reel-video-renderer[is-active], ytd-shorts ytd-reel-video-renderer:first-child, #shorts-player, ytd-shorts"
          )
          if (currentPlayerEl && getShortsPlayerVideoId() === videoId) {
            blockShortsPlayer(currentPlayerEl, videoId, reason)
          }
          return
        }
      } catch (err) {
        console.error("[Neoblocker] Shorts title analysis failed:", err)
      }

      // Deep analysis
      if (!analyzedVideoIds.current.has(videoId)) {
        analyzedVideoIds.current.add(videoId)
        try {
          const response = await chrome.runtime.sendMessage({ action: "analyzeVideoId", videoId })
          const { action, reason } = response || { action: "SAFE" }
          if (action === "LOCAL_BLOCK") {
            blockedVideoIds.current.set(videoId, reason || "Flagged Content")
            const currentPlayerEl = document.querySelector<HTMLElement>(
              "ytd-shorts ytd-reel-video-renderer[is-active], ytd-shorts ytd-reel-video-renderer:first-child, #shorts-player, ytd-shorts"
            )
            if (currentPlayerEl && getShortsPlayerVideoId() === videoId) {
              blockShortsPlayer(currentPlayerEl, videoId, reason || "Flagged Content")
            }
          }
        } catch (err) {
          console.error(`[Neoblocker] Shorts deep analysis failed for ${videoId}:`, err)
        }
      }
    }

    const blockShortsPlayer = (el: HTMLElement, videoId: string, reason: string) => {
      if (revealedVideoIds.current.has(videoId)) return
      applyBlurStyle(el)
      el.dataset.neoblockerVideoId = videoId
      if (!el.querySelector(".plasmo-firewall-mount")) {
        const mountNode = createMountNode(el)
        setBlockedItems((prev) => [
          ...prev.filter((i) => i.videoId !== videoId),
          { id: videoId, element: mountNode, reason, videoId },
        ])
      }
    }

    const clearShortsOverlay = (el: HTMLElement, videoId: string) => {
      el.classList.remove("firewall-blurred")
      el.removeAttribute("data-neoblocker-blocked")
      el.style.overflow = ""
      el.style.position = ""
      el.querySelectorAll(".plasmo-firewall-mount").forEach((m) => m.remove())
      setBlockedItems((prev) => prev.filter((i) => i.videoId !== videoId))
    }

    // ── Self-healing: restore overlays YouTube may have wiped ─────────────────
    const selfHeal = () => {
      document.querySelectorAll<HTMLElement>('[data-neoblocker-blocked="true"]').forEach((el) => {
        if (filterModeRef.current === "remove") {
          if (el.style.display !== "none") el.style.display = "none"
          return
        }
        if (!el.classList.contains("firewall-blurred")) {
          el.classList.add("firewall-blurred")
          el.style.overflow = "visible"
          el.style.position = "relative"
        }
        if (!el.querySelector(".plasmo-firewall-mount")) {
          const mountNode = createMountNode(el)
          const commentId = el.dataset.neoblockerCommentId
          if (commentId) {
            const reason = blockedCommentReasons.current.get(commentId) || "Flagged Content"
            setBlockedItems((prev) => [
              ...prev.filter((i) => i.commentId !== commentId),
              { id: commentId, element: mountNode, reason, commentId },
            ])
          } else {
            const videoId = el.dataset.neoblockerShortsId || getVideoId(el)
            if (videoId) {
              const reason = blockedVideoIds.current.get(videoId) || "Flagged Content"
              setBlockedItems((prev) => [
                ...prev.filter((i) => i.videoId !== videoId),
                { id: Math.random().toString(36).substring(7), element: mountNode, reason, videoId },
              ])
            }
          }
        }
      })
    }

    // ── MutationObserver ──────────────────────────────────────────────────────
    const observer = new MutationObserver(() => {
      selfHeal()

      if (isOnShortsPage()) {
        processShortsPlayer()
        return
      }

      // Regular page: collect changed card/comment nodes and process them
      const targets = new Set<HTMLElement>()
      document.querySelectorAll<HTMLElement>(CONTENT_SELECTORS).forEach((el) => {
        if (!el.dataset.neoblockerBlocked && !el.dataset.neoblockerRevealed) {
          targets.add(el)
        }
      })
      targets.forEach(processElement)
    })

    // Initial scan
    if (isOnShortsPage()) {
      processShortsPlayer()
    } else {
      document.querySelectorAll<HTMLElement>(CONTENT_SELECTORS).forEach(processElement)
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href", "is-active"],
    })

    // ── URL-change watcher for SPA navigation (Shorts swipe / YT navigation) ──
    let lastUrl = location.href
    const urlPoller = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        if (isOnShortsPage()) {
          processShortsPlayer()
        }
      }
    }, 400)

    return () => {
      observer.disconnect()
      clearInterval(urlPoller)
    }
  }, [])

  // ─── Sync filter mode changes across already-blocked elements ───────────────
  useEffect(() => {
    const blockedEls = document.querySelectorAll<HTMLElement>('[data-neoblocker-blocked="true"]')
    if (filterMode === "remove") {
      setBlockedItems([])
      blockedEls.forEach((el) => {
        el.style.display = "none"
        el.classList.remove("firewall-blurred")
        el.style.overflow = ""
        el.style.position = ""
        el.querySelectorAll(".plasmo-firewall-mount").forEach((m) => m.remove())
        el.dataset.neoblockerRemoved = "true"
      })
    } else {
      blockedEls.forEach((el) => {
        if (el.dataset.neoblockerRemoved === "true") {
          el.style.display = ""
          applyBlurStyle(el)
          el.removeAttribute("data-neoblocker-removed")
        }
        if (!el.querySelector(".plasmo-firewall-mount")) {
          const mountNode = createMountNode(el)
          const commentId = el.dataset.neoblockerCommentId
          if (commentId) {
            const reason = blockedCommentReasons.current.get(commentId) || "Flagged Content"
            setBlockedItems((prev) => [
              ...prev.filter((i) => i.commentId !== commentId),
              { id: commentId, element: mountNode, reason, commentId },
            ])
          } else {
            const videoId = el.dataset.neoblockerShortsId || getVideoId(el)
            if (videoId) {
              const reason = blockedVideoIds.current.get(videoId) || "Flagged Content"
              setBlockedItems((prev) => [
                ...prev.filter((i) => i.videoId !== videoId),
                { id: Math.random().toString(36).substring(7), element: mountNode, reason, videoId },
              ])
            }
          }
        }
      })
    }
  }, [filterMode])

  return (
    <>
      {blockedItems.map((item) =>
        createPortal(
          <FirewallOverlay
            key={item.id}
            item={item}
            onReveal={() => {
              if (item.commentId) handleRevealComment(item.commentId)
              else if (item.videoId) handleReveal(item.videoId)
            }}
          />,
          item.element
        )
      )}
    </>
  )
}

// ─── Utility: keyword helpers ─────────────────────────────────────────────────
function matchesBannedKeyword(settings: any, ...texts: string[]): boolean {
  const raw = typeof settings.bannedKeywords === "string" ? settings.bannedKeywords : ""
  const keywords = raw.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean)
  return keywords.length > 0 && texts.some((t) => keywords.some((kw: string) => t.includes(kw)))
}

function matchesException(settings: any, ...texts: string[]): boolean {
  const raw = typeof settings.exceptions === "string" ? settings.exceptions : ""
  const keywords = raw.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean)
  return keywords.length > 0 && texts.some((t) => keywords.some((kw: string) => t.includes(kw)))
}

function extractChannelName(el: HTMLElement): string {
  const channelEl = el.querySelector(
    "ytd-channel-name yt-formatted-string, ytd-channel-name, #channel-name a, #channel-name, #byline"
  )
  return (channelEl?.textContent || "").replace(/\s+/g, " ").trim()
}

function extractTitleText(el: HTMLElement): string {
  const titleEl = el.querySelector(
    "a#video-title-link, h3 a#video-title, #video-title-link, #video-title," +
    " .reel-item-title, h3 yt-formatted-string, #overlays h3, span#title"
  )
  return (titleEl?.textContent || "").replace(/\s+/g, " ").trim()
}

export default OverlayManager
