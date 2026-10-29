// Neoblocker settings + daily stats, persisted via chrome.storage.local.
// chrome.storage.local is a cross-browser standard — works on Chrome, Edge, Brave, Firefox, and any MV3 browser.

export interface ExtensionSettings {
  /** Master switch. When false the content script does no work at all. */
  enabled: boolean
  enableToxicity: boolean
  enableBias: boolean
  toxicityThreshold: number
  biasThreshold: number
  theme: "dark" | "light"
  exceptions: string
  enableObscene: boolean
  racismThreshold: number
  filterMode: "blur" | "remove"
  bannedKeywords: string
  /** Fetch subtitles/comments for videos that scroll into view. */
  deepScan: boolean
}

export interface FilterStats {
  /** Local YYYY-MM-DD date the total belongs to. */
  date: string
  total: number
}

export const SETTINGS_KEY = "neoblocker_settings"
export const STATS_KEY = "neoblocker_stats"

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  enableToxicity: true,
  enableBias: false,
  toxicityThreshold: 0.5,
  biasThreshold: 0.5,
  theme: "dark",
  exceptions: "",
  enableObscene: true,
  racismThreshold: 0.15,
  filterMode: "blur",
  bannedKeywords: "",
  deepScan: true
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

const bool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback

/** Merge unknown storage data with defaults and discard corrupt values. */
export function sanitizeSettings(value: unknown): ExtensionSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >
  return {
    enabled: bool(raw.enabled, DEFAULT_SETTINGS.enabled),
    enableToxicity: bool(
      raw.enableToxicity,
      DEFAULT_SETTINGS.enableToxicity
    ),
    enableBias: bool(raw.enableBias, DEFAULT_SETTINGS.enableBias),
    toxicityThreshold: clamp(
      raw.toxicityThreshold,
      0.05,
      0.95,
      DEFAULT_SETTINGS.toxicityThreshold
    ),
    biasThreshold: clamp(
      raw.biasThreshold,
      0.05,
      0.95,
      DEFAULT_SETTINGS.biasThreshold
    ),
    theme: raw.theme === "light" ? "light" : "dark",
    exceptions: text(raw.exceptions),
    enableObscene: bool(raw.enableObscene, DEFAULT_SETTINGS.enableObscene),
    racismThreshold: clamp(
      raw.racismThreshold,
      0.05,
      0.95,
      DEFAULT_SETTINGS.racismThreshold
    ),
    filterMode: raw.filterMode === "remove" ? "remove" : "blur",
    bannedKeywords: text(raw.bannedKeywords),
    deepScan: bool(raw.deepScan, DEFAULT_SETTINGS.deepScan)
  }
}

export function todayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizeStats(value: unknown): FilterStats {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >
  return {
    date: text(raw.date),
    total: Math.max(0, Math.floor(clamp(raw.total, 0, 1_000_000, 0)))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings cache. Reads are coalesced and shared by every context.
// ─────────────────────────────────────────────────────────────────────────────
let cachedSettingsPromise: Promise<ExtensionSettings> | null = null

if (
  typeof chrome !== "undefined" &&
  chrome.storage &&
  chrome.storage.onChanged
) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return
    if (changes[SETTINGS_KEY]) {
      cachedSettingsPromise = Promise.resolve(
        sanitizeSettings(changes[SETTINGS_KEY].newValue)
      )
    }
    if (changes[STATS_KEY]) {
      cachedStats = normalizeStats(changes[STATS_KEY].newValue)
    }
  })
}

export function getSettings(): Promise<ExtensionSettings> {
  if (!cachedSettingsPromise) {
    cachedSettingsPromise = new Promise((resolve) => {
      try {
        chrome.storage.local.get(SETTINGS_KEY, (result) => {
          resolve(sanitizeSettings(result?.[SETTINGS_KEY]))
        })
      } catch {
        resolve({ ...DEFAULT_SETTINGS })
      }
    })
  }
  return cachedSettingsPromise
}

// Serialise writes: sliders and switches can fire quickly, and two overlapping
// read-modify-write cycles used to clobber each other.
let settingsWriteChain: Promise<void> = Promise.resolve()

export function saveSettings(
  patch: Partial<ExtensionSettings>
): Promise<void> {
  settingsWriteChain = settingsWriteChain
    .catch(() => {
      // Keep the queue alive after a failed write.
    })
    .then(async () => {
      const current = await getSettings()
      const next = sanitizeSettings({ ...current, ...patch })
      cachedSettingsPromise = Promise.resolve(next)
      await new Promise<void>((resolve, reject) => {
        try {
          chrome.storage.local.set({ [SETTINGS_KEY]: next }, () => {
            const error = chrome.runtime?.lastError
            if (error) reject(new Error(error.message))
            else resolve()
          })
        } catch (error) {
          reject(error)
        }
      })
    })
  return settingsWriteChain
}

export async function resetSettings(): Promise<ExtensionSettings> {
  await saveSettings({ ...DEFAULT_SETTINGS })
  return getSettings()
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily stats. The background service worker is the only writer, so an
// in-memory cache plus a write queue is enough to avoid lost increments.
// ─────────────────────────────────────────────────────────────────────────────
let cachedStats: FilterStats | null = null
let statsWriteChain: Promise<FilterStats> = Promise.resolve({
  date: todayKey(),
  total: 0
})

function readStats(): Promise<FilterStats> {
  if (
    cachedStats &&
    cachedStats.date === todayKey()
  ) {
    return Promise.resolve({ ...cachedStats })
  }
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STATS_KEY, (result) => {
        const stats = normalizeStats(result?.[STATS_KEY])
        const normalized =
          stats.date === todayKey()
            ? stats
            : { date: todayKey(), total: 0 }
        cachedStats = normalized
        resolve({ ...normalized })
      })
    } catch {
      resolve({ date: todayKey(), total: 0 })
    }
  })
}

export async function getStats(): Promise<FilterStats> {
  await statsWriteChain.catch(() => undefined)
  const stats = await readStats()
  return stats.date === todayKey() ? stats : { date: todayKey(), total: 0 }
}

export function addBlockedCount(count = 1): Promise<FilterStats> {
  const safeCount = Math.max(0, Math.min(100, Math.floor(count) || 0))
  if (safeCount === 0) return getStats()

  statsWriteChain = statsWriteChain
    .catch(() => ({ date: todayKey(), total: 0 }))
    .then(async () => {
      const current = await readStats()
      const today = todayKey()
      const next: FilterStats = {
        date: today,
        total: (current.date === today ? current.total : 0) + safeCount
      }
      cachedStats = next
      await new Promise<void>((resolve) => {
        try {
          chrome.storage.local.set({ [STATS_KEY]: next }, () => resolve())
        } catch {
          resolve()
        }
      })
      return next
    })
  return statsWriteChain
}

export async function resetStats(): Promise<void> {
  // Join the write queue so an in-flight increment cannot resurrect the count
  // after the reset.
  statsWriteChain = statsWriteChain
    .catch(() => ({ date: todayKey(), total: 0 }))
    .then(async () => {
      const zero: FilterStats = { date: todayKey(), total: 0 }
      cachedStats = zero
      try {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ [STATS_KEY]: zero }, () => resolve())
        })
      } catch {
        // Ignore — stats are non-critical.
      }
      return zero
    })
  await statsWriteChain.catch(() => undefined)
}
