import type { PlasmoCSConfig } from "plasmo"

import { isValidVideoId } from "~utils/extract"
import { addKeyword, matchesAnyKeyword } from "~utils/keywords"
import { getSettings, saveSettings } from "~utils/storage"
import type { ExtensionSettings } from "~utils/storage"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"]
}

const CARD_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-rich-grid-slim-media",
  "ytd-reel-item-renderer",
  "ytd-shorts ytd-reel-video-renderer[is-active]"
].join(", ")

const SHORTS_PLAYER_SELECTOR = "#shorts-player"
const COMMENT_SELECTORS = "ytd-comment-renderer"

const TITLE_SELECTORS = [
  "a#video-title-link",
  "h3 a#video-title",
  "#video-title-link",
  "#video-title",
  ".reel-item-title",
  "h3 yt-formatted-string",
  "#overlays h3",
  "span#title",
  "a#thumbnail[aria-label]",
  "a[href*='/watch?v='][aria-label]"
]

const CHANNEL_SELECTORS = [
  "ytd-channel-name yt-formatted-string",
  "ytd-channel-name",
  "#channel-name a",
  "#channel-name",
  "#byline",
  "a.yt-simple-endpoint[href^='/@']"
]

const STYLE_ID = "neoblocker-page-style"
const REVEAL_KEY = "neoblocker_revealed_v1"
const MAX_REVEALED = 500
const MAX_TEXT_CACHE = 300
const TEXT_CACHE_TTL = 30 * 60 * 1000
const MAX_CONCURRENT_DEEP = 2

type ItemKind = "card" | "comment"
type BlockResult = {
  action: "LOCAL_BLOCK" | "SAFE"
  reason?: string
  error?: string
}

interface CachedTextResult {
  at: number
  result: BlockResult
}

let settings: ExtensionSettings | null = null
let lastUrl = location.href
let scanTimer: ReturnType<typeof setTimeout> | null = null
let observer: IntersectionObserver | null = null
let mutationObserver: MutationObserver | null = null
let urlPollTimer: ReturnType<typeof setInterval> | null = null
let rescanTimer: ReturnType<typeof setInterval> | null = null
let processedKeys = new WeakMap<Element, string>()
let processing = new WeakSet<Element>()
let attempts = new WeakMap<Element, number>()
let analysisFailures = new WeakMap<Element, number>()
let itemKinds = new WeakMap<Element, ItemKind>()
let trackedItems = new Set<Element>()
const revealTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>()
const textCache = new Map<string, CachedTextResult>()
const revealed = loadRevealed()
const deepDone = new Set<string>()
const deepPending = new Set<string>()
const deepBlockedReasons = new Map<string, string>()
const visibleItems = new Set<Element>()
let activeDeep = 0
const deepQueue: Array<() => void> = []
let destroyed = false

// ─────────────────────────────────────────────────────────────────────────────
// Page CSS — deliberately tiny. Never inject Tailwind/preflight into YouTube.
// ─────────────────────────────────────────────────────────────────────────────
function injectPageStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .neoblocker-blurred { position: relative !important; overflow: hidden !important; }
    .neoblocker-blurred > *:not(.neoblocker-overlay-host) {
      filter: blur(16px) brightness(0.55) !important;
      pointer-events: none !important;
      user-select: none !important;
      transition: filter 180ms ease !important;
    }
    .neoblocker-removed { display: none !important; }
    .neoblocker-overlay-host {
      position: absolute; inset: 0; z-index: 2147483000;
      display: flex; align-items: center; justify-content: center;
      box-sizing: border-box; font-family: Roboto, Arial, sans-serif;
      background: linear-gradient(135deg, rgba(22, 16, 43, 0.8), rgba(9, 7, 20, 0.88));
      backdrop-filter: blur(3px); border-radius: inherit;
    }
  `
  ;(document.head || document.documentElement).appendChild(style)
}

// ─────────────────────────────────────────────────────────────────────────────
// Revealed items — sessionStorage so a page refresh keeps "Show anyway" choices
// ─────────────────────────────────────────────────────────────────────────────
function loadRevealed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(REVEAL_KEY)
    if (!raw) return new Set()
    const values = JSON.parse(raw)
    return new Set(Array.isArray(values) ? values.filter((v) => typeof v === "string") : [])
  } catch {
    return new Set()
  }
}

function persistRevealed() {
  try {
    const values = Array.from(revealed).slice(-MAX_REVEALED)
    sessionStorage.setItem(REVEAL_KEY, JSON.stringify(values))
  } catch {
    // Storage can be unavailable in private windows; in-memory still works.
  }
}

function rememberRevealed(key: string) {
  revealed.add(key)
  persistRevealed()
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM extraction
// ─────────────────────────────────────────────────────────────────────────────
function clean(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim()
}

function getVideoId(el: Element): string | null {
  const anchors = el.querySelectorAll<HTMLAnchorElement>(
    "a[href*='v='], a[href*='/shorts/'], a#thumbnail"
  )
  for (const anchor of Array.from(anchors)) {
    const href = anchor.getAttribute("href") || ""
    const match = /(?:v=|\/shorts\/)([a-zA-Z0-9_-]{11})/.exec(href)
    if (match) return match[1]
  }

  if (location.pathname.startsWith("/shorts/")) {
    const match = /\/shorts\/([a-zA-Z0-9_-]{11})/.exec(location.pathname)
    if (match) return match[1]
  }
  return null
}

function extractTitle(el: Element): string {
  for (const selector of TITLE_SELECTORS) {
    const node = el.querySelector<HTMLElement>(selector)
    if (node) {
      const text = clean(
        node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent
      )
      if (text && text.length > 1) return text
    }
  }

  const heading = el.querySelector<HTMLElement>("h3")
  return clean(heading?.textContent)
}

function extractChannel(el: Element): string {
  for (const selector of CHANNEL_SELECTORS) {
    const node = el.querySelector<HTMLElement>(selector)
    const text = clean(node?.textContent || node?.getAttribute("aria-label"))
    if (text) return text
  }
  return ""
}

function extractCommentText(el: Element): string {
  const node = el.querySelector<HTMLElement>("#content-text, yt-attributed-string#content-text")
  const text = clean(node?.textContent)
  return text.length > 0 ? text.slice(0, 3000) : ""
}

function cardKey(el: Element, title: string, channel: string): string {
  const videoId = getVideoId(el) || "no-id"
  return `card|${videoId}|${title.slice(0, 160)}|${channel.slice(0, 80)}`
}

function commentKey(text: string): string {
  return `comment|${text.slice(0, 220)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings / messaging
// ─────────────────────────────────────────────────────────────────────────────
function settingsSignature(next: ExtensionSettings): string {
  return JSON.stringify([
    next.enabled,
    next.enableToxicity,
    next.enableBias,
    next.enableObscene,
    next.toxicityThreshold,
    next.biasThreshold,
    next.racismThreshold,
    next.filterMode,
    next.deepScan,
    next.bannedKeywords,
    next.exceptions
  ])
}

let currentSignature = ""
// Bumped whenever detection settings change so in-flight deep scans cannot
// apply a verdict computed under the previous thresholds.
let settingsRevision = 0

function sendMessage(message: unknown, timeoutMs = 20_000): Promise<any | null> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(null)
    }, timeoutMs)

    const finish = (value: any) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime?.lastError) return finish(null)
        finish(response ?? null)
      })
    } catch {
      finish(null)
    }
  })
}

function recordBlock() {
  try {
    chrome.runtime.sendMessage({ action: "recordBlock", count: 1 }, () => {
      // Notifications are best effort; no response is expected.
      void chrome.runtime?.lastError
    })
  } catch {
    // Extension context may have been invalidated after a reload.
  }
}

function getCachedText(key: string): BlockResult | null {
  const cached = textCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.at > TEXT_CACHE_TTL) {
    textCache.delete(key)
    return null
  }
  return cached.result
}

function setCachedText(key: string, result: BlockResult) {
  if (textCache.size >= MAX_TEXT_CACHE) {
    const oldest = textCache.keys().next().value
    if (oldest) textCache.delete(oldest)
  }
  textCache.set(key, { at: Date.now(), result })
}

async function analyzeText(text: string, isTitle: boolean): Promise<BlockResult | null> {
  const cacheKey = `${isTitle ? "title" : "text"}|${text.slice(0, 600)}`
  const cached = getCachedText(cacheKey)
  if (cached) return cached

  const result = (await sendMessage(
    { action: "analyze", text, isTitle },
    isTitle ? 25_000 : 40_000
  )) as BlockResult | null

  if (!result || result.error) return result
  setCachedText(cacheKey, result)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocking / restoring
// ─────────────────────────────────────────────────────────────────────────────
const SHIELD_SVG =
  '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5 20 6v5.4c0 5-3.4 8.7-8 10.1-4.6-1.4-8-5.1-8-10.1V6l8-3.5Z" fill="#a78bfa" stroke="#c4b5fd" stroke-width="1.2"/><path d="M9.2 12.1l1.9 1.9 3.9-4" stroke="#1e1b2e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

function overlayButton(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = label
  button.style.cssText = primary
    ? "appearance:none;border:0;border-radius:999px;padding:7px 14px;background:#8b5cf6;color:#fff;font:600 12px/1.2 Roboto,Arial,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(124,58,237,.45);"
    : "appearance:none;border:1px solid rgba(196,181,253,.45);border-radius:999px;padding:7px 14px;background:rgba(255,255,255,.06);color:#ddd6fe;font:600 12px/1.2 Roboto,Arial,sans-serif;cursor:pointer;"

  const swallow = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
  }
  button.addEventListener("pointerdown", swallow)
  button.addEventListener("click", (event) => {
    swallow(event)
    onClick()
  })
  return button
}

function mountOverlay(el: Element, reason: string, channel: string) {
  removeOverlay(el)
  const host = document.createElement("div")
  host.className = "neoblocker-overlay-host"

  const panel = document.createElement("div")
  panel.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 18px;text-align:center;max-width:min(310px,86%);box-sizing:border-box;"

  const icon = document.createElement("div")
  icon.innerHTML = SHIELD_SVG
  icon.style.cssText = "line-height:0;filter:drop-shadow(0 3px 10px rgba(139,92,246,.55));"

  const heading = document.createElement("div")
  heading.textContent = "Filtered by Neoblocker"
  heading.style.cssText =
    "color:#f5f3ff;font:700 13px/1.25 Roboto,Arial,sans-serif;letter-spacing:.01em;"

  const detail = document.createElement("div")
  detail.textContent = reason
  detail.style.cssText =
    "color:#c4b5fd;font:500 11px/1.35 Roboto,Arial,sans-serif;max-width:270px;"

  const actions = document.createElement("div")
  actions.style.cssText = "display:flex;gap:7px;margin-top:2px;flex-wrap:wrap;justify-content:center;"

  const key = el.getAttribute("data-neoblocker-key") || ""
  actions.appendChild(
    overlayButton("Show anyway", true, () => {
      if (key) rememberRevealed(key)
      restoreItem(el, false)
      el.setAttribute("data-neoblocker-revealed", "true")
    })
  )

  if (channel) {
    actions.appendChild(
      overlayButton("Allow channel", false, () => {
        void allowChannel(channel)
        if (key) rememberRevealed(key)
        restoreItem(el, false)
        el.setAttribute("data-neoblocker-revealed", "true")
      })
    )
  }

  panel.append(icon, heading, detail, actions)
  host.appendChild(panel)
  el.appendChild(host)
}

function removeOverlay(el: Element) {
  el.querySelectorAll(":scope > .neoblocker-overlay-host").forEach((node) => node.remove())
}

function cardIsRevealed(el: Element): boolean {
  if (el.getAttribute("data-neoblocker-revealed") === "true") return true
  return revealed.has(cardKey(el, extractTitle(el), extractChannel(el)))
}

function blockItem(el: Element, reason: string) {
  if (!settings?.enabled || !el.isConnected) return
  const isComment = itemKinds.get(el) === "comment"
  if (!isComment && cardIsRevealed(el)) return
  const channel = isComment ? "" : extractChannel(el)
  const key = isComment
    ? commentKey(extractCommentText(el))
    : cardKey(el, extractTitle(el), channel)

  el.setAttribute("data-neoblocker-blocked", "true")
  el.setAttribute("data-neoblocker-reason", reason)
  el.setAttribute("data-neoblocker-key", key)

  if (settings.filterMode === "remove") {
    el.classList.add("neoblocker-removed")
    el.setAttribute("data-neoblocker-removed", "true")
  } else {
    el.classList.add("neoblocker-blurred")
    mountOverlay(el, reason, channel)
  }

  if (!el.getAttribute("data-neoblocker-counted")) {
    el.setAttribute("data-neoblocker-counted", "1")
    recordBlock()
  }
}

function blockCardsForVideo(videoId: string, reason: string) {
  for (const el of trackedItems) {
    if (itemKinds.get(el) !== "card" || !el.isConnected) continue
    if (getVideoId(el) !== videoId) continue
    if (el.getAttribute("data-neoblocker-blocked") === "true") continue
    blockItem(el, reason)
  }
}

function restoreItem(el: Element, clearCounted = false) {
  el.classList.remove("neoblocker-blurred", "neoblocker-removed")
  removeOverlay(el)
  for (const attr of [
    "data-neoblocker-blocked",
    "data-neoblocker-reason",
    "data-neoblocker-removed",
    "data-neoblocker-key",
    "data-neoblocker-revealed"
  ]) {
    el.removeAttribute(attr)
  }
  if (clearCounted) el.removeAttribute("data-neoblocker-counted")
}

function restoreAll(clearCounted = true) {
  document
    .querySelectorAll(
      ".neoblocker-blurred, .neoblocker-removed, [data-neoblocker-blocked], [data-neoblocker-revealed]"
    )
    .forEach((el) => restoreItem(el, clearCounted))
  document.querySelectorAll(".neoblocker-overlay-host").forEach((node) => node.remove())
}

async function allowChannel(channel: string) {
  if (!settings || !channel) return
  const nextExceptions = addKeyword(settings.exceptions, channel)
  if (nextExceptions === settings.exceptions) return
  settings = { ...settings, exceptions: nextExceptions }
  await saveSettings({ exceptions: nextExceptions })
  scanPage(true)
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis
// ─────────────────────────────────────────────────────────────────────────────
async function processItem(el: Element, kind: ItemKind) {
  if (!settings?.enabled || !el.isConnected || processing.has(el)) return

  if (el.getAttribute("data-neoblocker-blocked") === "true") return

  const title = kind === "card" ? extractTitle(el) : ""
  const channel = kind === "card" ? extractChannel(el) : ""
  const commentText = kind === "comment" ? extractCommentText(el) : ""
  const key = kind === "comment" ? commentKey(commentText) : cardKey(el, title, channel)

  if (revealed.has(key)) {
    restoreItem(el, false)
    el.setAttribute("data-neoblocker-revealed", "true")
    processedKeys.set(el, key)
    return
  }

  if (processedKeys.get(el) === key) return

  // YouTube inserts a shell first and fills in the title/comment text a frame
  // or two later. Poll briefly before giving up on this particular key.
  const contentReady = kind === "card" ? Boolean(title) : commentText.length >= 4
  if (!contentReady) {
    const attempt = (attempts.get(el) || 0) + 1
    attempts.set(el, attempt)
    if (attempt <= 12) {
      scheduleItem(el, kind, 650)
    }
    return
  }

  const searchable = kind === "comment" ? commentText : `${title} ${channel}`
  if (searchable.length < 4) return
  attempts.delete(el)
  processing.add(el)
  processedKeys.set(el, key)

  try {
    if (
      settings.exceptions &&
      matchesAnyKeyword(settings.exceptions, searchable)
    ) {
      return
    }

    if (settings.bannedKeywords && matchesAnyKeyword(settings.bannedKeywords, searchable)) {
      blockItem(el, "Matches a banned keyword")
      return
    }

    if (kind === "card") {
      if (title.length >= 12 && settings.enableToxicity) {
        const result = await analyzeText(title, true)
        if (result?.action === "LOCAL_BLOCK" && processedKeys.get(el) === key) {
          blockItem(el, result.reason || "Flagged by the local model")
          return
        }
        if (!result || result.error) {
          retryAfterFailure(el, kind, result?.error)
        } else {
          analysisFailures.delete(el)
        }
      }
    } else if (commentText.length >= 16 && (settings.enableToxicity || settings.enableBias)) {
      const result = await analyzeText(commentText, false)
      if (result?.action === "LOCAL_BLOCK" && processedKeys.get(el) === key) {
        blockItem(el, result.reason || "Flagged by the local model")
        return
      }
      if (!result || result.error) {
        retryAfterFailure(el, kind, result?.error)
      } else {
        analysisFailures.delete(el)
      }
    }
  } finally {
    processing.delete(el)
  }
}

function retryAfterFailure(el: Element, kind: ItemKind, error?: string) {
  if (destroyed || !settings?.enabled || !el.isConnected) return
  const attempt = (analysisFailures.get(el) || 0) + 1
  analysisFailures.set(el, attempt)

  // Model downloads can take several minutes on a first run. Keep retrying
  // those (and request timeouts) long enough for the download to finish;
  // permanent validation errors give up sooner.
  const recoverable =
    !error || error === "Model unavailable" || error === "Analysis failed"
  const maxAttempts = recoverable ? 20 : 6
  if (attempt > maxAttempts) {
    // Keep the processed key so a permanently unavailable model does not make
    // every scan retry forever. A settings change clears this state.
    return
  }
  processedKeys.delete(el)
  const delay = recoverable
    ? Math.min(30_000, 2_000 * 2 ** Math.min(attempt - 1, 4))
    : Math.min(20_000, 1_500 * 2 ** (attempt - 1))
  scheduleItem(el, kind, delay)
}

function scheduleItem(el: Element, kind: ItemKind, delay = 0) {
  itemKinds.set(el, kind)
  const existing = revealTimers.get(el)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    revealTimers.delete(el)
    void processItem(el, kind)
  }, delay)
  revealTimers.set(el, timer)
}

function enqueueDeep(task: () => Promise<void>) {
  const run = () => {
    activeDeep++
    void task().finally(() => {
      activeDeep--
      const next = deepQueue.shift()
      if (next) next()
    })
  }
  if (activeDeep >= MAX_CONCURRENT_DEEP) deepQueue.push(run)
  else run()
}

function maybeDeepScan(el: Element) {
  if (!settings?.enabled || !settings.deepScan || !settings.enableToxicity) return
  if (el.getAttribute("data-neoblocker-blocked") === "true") return

  const videoId = getVideoId(el)
  if (!isValidVideoId(videoId)) return

  const knownBlock = deepBlockedReasons.get(videoId)
  if (knownBlock) {
    blockItem(el, knownBlock)
    return
  }

  if (deepDone.has(videoId) || deepPending.has(videoId)) return

  const revision = settingsRevision
  deepPending.add(videoId)
  enqueueDeep(async () => {
    const result = (await sendMessage(
      { action: "analyzeVideoId", videoId },
      30_000
    )) as BlockResult | null

    deepPending.delete(videoId)
    if (revision !== settingsRevision) return

    if (!result || result.error) {
      // Allow a later retry after a transient fetch/model failure, but do not
      // hammer the service worker on every scan in the meantime.
      deepDone.add(videoId)
      setTimeout(() => deepDone.delete(videoId), 60_000)
      return
    }

    deepDone.add(videoId)
    if (result.action === "LOCAL_BLOCK") {
      const reason = result.reason || "Flagged by the local model"
      deepBlockedReasons.set(videoId, reason)
      // The same video often appears in several cards (home grid, sidebar,
      // recommendations). Apply the result to every matching card that the
      // user has not explicitly revealed.
      blockCardsForVideo(videoId, reason)
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanning / observation
// ─────────────────────────────────────────────────────────────────────────────
function getItems(): Array<{ el: Element; kind: ItemKind }> {
  const items: Array<{ el: Element; kind: ItemKind }> = []

  const addCard = (el: Element) => {
    if (el.closest(".neoblocker-overlay-host")) return
    // Some layouts nest one card renderer inside another. Only process the
    // outermost card so a single video is not blurred and counted twice.
    if (el.parentElement?.closest(CARD_SELECTORS)) return
    items.push({ el, kind: "card" })
  }

  document.querySelectorAll(CARD_SELECTORS).forEach(addCard)

  // Shorts normally expose an active reel. Fall back to the player only when
  // that marker is absent, otherwise the reel and the player both match.
  if (!document.querySelector("ytd-shorts ytd-reel-video-renderer[is-active]")) {
    document.querySelectorAll(SHORTS_PLAYER_SELECTOR).forEach(addCard)
  }

  document.querySelectorAll(COMMENT_SELECTORS).forEach((el) => {
    items.push({ el, kind: "comment" })
  })
  return items
}

function ensureObserver() {
  if (observer) return
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target
        if (!entry.isIntersecting) {
          visibleItems.delete(el)
          continue
        }
        visibleItems.add(el)
        const kind = itemKinds.get(el) || "card"
        if (kind === "card") {
          void processItem(el, "card")
          maybeDeepScan(el)
        } else {
          void processItem(el, "comment")
        }
      }
    },
    { rootMargin: "400px 0px", threshold: 0.01 }
  )
}

function scanPage(force = false) {
  if (destroyed) return
  injectPageStyle()
  if (settings !== null && !settings.enabled && !force) return
  ensureObserver()

  if (force) {
    processedKeys = new WeakMap()
    attempts = new WeakMap()
    analysisFailures = new WeakMap()
    deepDone.clear()
    deepPending.clear()
    deepBlockedReasons.clear()
  }

  const live = new Set<Element>()
  for (const { el, kind } of getItems()) {
    live.add(el)
    const isNew = !trackedItems.has(el)
    if (isNew) {
      trackedItems.add(el)
      itemKinds.set(el, kind)
      observer?.observe(el)
      // Schedule both cards and comments: comments often render their text
      // after the element has been observed for the first time.
      scheduleItem(el, kind, 0)
    } else if (el.getAttribute("data-neoblocker-blocked") === "true") {
      // Self-heal: YouTube re-renders can drop our overlay or class.
      const reason = el.getAttribute("data-neoblocker-reason")
      if (settings?.filterMode === "remove") {
        if (!el.classList.contains("neoblocker-removed")) {
          el.classList.add("neoblocker-removed")
        }
      } else if (
        reason &&
        el.classList.contains("neoblocker-blurred") &&
        !el.querySelector(":scope > .neoblocker-overlay-host")
      ) {
        mountOverlay(el, reason, extractChannel(el))
      }
    }

    // Re-check visible items on every scan. This catches titles and comment
    // bodies that arrived after the initial IntersectionObserver callback.
    if (visibleItems.has(el)) {
      void processItem(el, kind)
      if (kind === "card") maybeDeepScan(el)
    }
  }

  for (const el of trackedItems) {
    if (!live.has(el) && !el.isConnected) {
      trackedItems.delete(el)
      observer?.unobserve(el)
    }
  }
}

function scheduleScan(delay = 250) {
  if (destroyed) return
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    scanTimer = null
    scanPage()
  }, delay)
}

function handleUrlChange() {
  if (location.href === lastUrl) return
  lastUrl = location.href
  restoreAll(true)
  processedKeys = new WeakMap()
  attempts = new WeakMap()
  analysisFailures = new WeakMap()
  trackedItems = new Set()
  visibleItems.clear()
  deepDone.clear()
  deepPending.clear()
  deepBlockedReasons.clear()
  observer?.disconnect()
  observer = null
  injectPageStyle()
  scheduleScan(350)
}

function teardown() {
  destroyed = true
  if (scanTimer) clearTimeout(scanTimer)
  if (urlPollTimer) clearInterval(urlPollTimer)
  if (rescanTimer) clearInterval(rescanTimer)
  mutationObserver?.disconnect()
  observer?.disconnect()
}

function start() {
  injectPageStyle()
  ensureObserver()

  mutationObserver = new MutationObserver(() => {
    scheduleScan()
    // Attribute changes on Shorts mark the active reel; scanning is debounced,
    // so this stays cheap even during rapid scrolling.
  })
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["is-active"]
  })

  document.addEventListener("yt-navigate-finish", handleUrlChange)
  document.addEventListener("yt-page-data-updated", handleUrlChange)
  window.addEventListener("popstate", handleUrlChange)
  urlPollTimer = setInterval(handleUrlChange, 1000)

  rescanTimer = setInterval(() => {
    if (!settings?.enabled) return
    scanPage()
  }, 4000)

  window.addEventListener("pagehide", teardown, { once: true })

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === "resetPage") {
      document
        .querySelectorAll("[data-neoblocker-key]")
        .forEach((el) => {
          const key = el.getAttribute("data-neoblocker-key")
          if (key) rememberRevealed(key)
        })
      restoreAll(false)
      processedKeys = new WeakMap()
      scanPage(true)
      sendResponse({ ok: true })
      return false
    }
    return false
  })

  void getSettings().then((loaded) => {
    settings = loaded
    currentSignature = settingsSignature(loaded)
    if (!loaded.enabled) {
      restoreAll(true)
      return
    }
    scanPage(true)
  })

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.neoblocker_settings) return
    void getSettings().then((next) => {
      const previous = settings
      settings = next
      const nextSignature = settingsSignature(next)
      if (
        !next.enabled ||
        !previous ||
        nextSignature !== currentSignature
      ) {
        settingsRevision++
      }

      if (!next.enabled) {
        restoreAll(true)
        currentSignature = nextSignature
        return
      }

      if (!previous || nextSignature !== currentSignature) {
        currentSignature = nextSignature
        textCache.clear()
        restoreAll(false)
        scanPage(true)
      }
    })
  })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true })
} else {
  start()
}
