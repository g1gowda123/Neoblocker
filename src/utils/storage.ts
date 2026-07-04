// Neoblocker extension settings, persisted via chrome.storage.local.
// chrome.storage.local is a cross-browser standard — works on Chrome, Edge, Brave, Firefox, and any MV3 browser.

export interface ExtensionSettings {
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
}

const STORAGE_KEY = "neoblocker_settings"

const DEFAULT_SETTINGS: ExtensionSettings = {
  enableToxicity: true,
  enableBias: true,
  toxicityThreshold: 0.5,
  biasThreshold: 0.5,
  theme: "dark",
  exceptions: "",
  enableObscene: true,
  racismThreshold: 0.25,
  filterMode: "blur",
  bannedKeywords: ""
}

// Bolt Optimization: Cache the settings promise to prevent duplicate concurrent
// storage reads, and keep it updated via onChanged listener.
let cachedSettingsPromise: Promise<ExtensionSettings> | null = null

if (
  typeof chrome !== "undefined" &&
  chrome.storage &&
  chrome.storage.onChanged
) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      const newValue = changes[STORAGE_KEY].newValue
      if (newValue) {
        cachedSettingsPromise = Promise.resolve({
          ...DEFAULT_SETTINGS,
          ...newValue
        })
      } else {
        cachedSettingsPromise = Promise.resolve(DEFAULT_SETTINGS)
      }
    }
  })
}

export function getSettings(): Promise<ExtensionSettings> {
  if (!cachedSettingsPromise) {
    cachedSettingsPromise = new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const saved = result[STORAGE_KEY]
        if (saved) {
          resolve({ ...DEFAULT_SETTINGS, ...saved })
        } else {
          resolve(DEFAULT_SETTINGS)
        }
      })
    })
  }
  return cachedSettingsPromise
}

export async function saveSettings(
  settings: Partial<ExtensionSettings>
): Promise<void> {
  const current = await getSettings()
  const next = { ...current, ...settings }
  // Update local cache optimistically
  cachedSettingsPromise = Promise.resolve(next)
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: next }, resolve)
  })
}
