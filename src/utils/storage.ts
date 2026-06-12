// Neoblocker extension settings, persisted via chrome.storage.local.
// chrome.storage.local is a cross-browser standard — works on Chrome, Edge, Brave, Firefox, and any MV3 browser.

export interface ExtensionSettings {
  enableToxicity: boolean;
  enableBias: boolean;
  toxicityThreshold: number;
  biasThreshold: number;
  theme: "dark" | "light";
  exceptions: string;
  enableObscene: boolean;
  racismThreshold: number;
  filterMode: "blur" | "remove";
  bannedKeywords: string;
}

const STORAGE_KEY = "neoblocker_settings";

const DEFAULT_SETTINGS: ExtensionSettings = {
  enableToxicity: true,
  enableBias: true,
  toxicityThreshold: 0.50,
  biasThreshold: 0.50,
  theme: "dark",
  exceptions: "",
  enableObscene: true,
  racismThreshold: 0.25,
  filterMode: "blur",
  bannedKeywords: "",
};

export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const saved = result[STORAGE_KEY];
      if (saved) {
        resolve({ ...DEFAULT_SETTINGS, ...saved });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    });
  });
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  const next = { ...current, ...settings };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: next }, resolve);
  });
}

