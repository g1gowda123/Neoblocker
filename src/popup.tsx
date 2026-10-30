import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"

import "~style.css"
import {
  getSettings,
  getStats,
  resetSettings,
  resetStats,
  saveSettings
} from "~utils/storage"
import type { ExtensionSettings, FilterStats } from "~utils/storage"

type ModelState = "idle" | "loading" | "loaded" | "error"

interface ModelStatuses {
  toxicity: ModelState
  bias: ModelState
  progress: { toxicity: number; bias: number }
}

const EMPTY_STATUSES: ModelStatuses = {
  toxicity: "idle",
  bias: "idle",
  progress: { toxicity: 0, bias: 0 }
}

function Switch({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`nb-switch${checked ? " is-on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  )
}

function Slider({
  label,
  hint,
  value,
  disabled,
  onChange
}: {
  label: string
  hint: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const percent = Math.round(value * 100)
  return (
    <div className={`nb-slider-row${disabled ? " nb-disabled" : ""}`}>
      <div className="nb-slider-head">
        <span className="nb-row-label">{label}</span>
        <span className="nb-slider-value">≥ {percent}%</span>
      </div>
      <input
        className="nb-slider"
        type="range"
        min={5}
        max={95}
        step={1}
        value={percent}
        disabled={disabled}
        aria-label={label}
        style={{ "--fill": `${((percent - 5) / 90) * 100}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <p className="nb-hint">{hint}</p>
    </div>
  )
}

function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 20 6v5.4c0 5-3.4 8.7-8 10.1-4.6-1.4-8-5.1-8-10.1V6l8-3.5Z"
        fill="#f5f3ff"
        stroke="#ddd6fe"
        strokeWidth="1"
      />
      <path
        d="M9.2 12.1l1.9 1.9 3.9-4"
        stroke="#6d28d9"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function statusBadge(state: ModelState, progress: number) {
  switch (state) {
    case "loaded":
      return <span className="nb-badge is-ready">Ready</span>
    case "loading":
      return (
        <span className="nb-badge is-loading">
          {progress > 0 ? `${Math.round(progress * 100)}%` : "Loading"}
        </span>
      )
    case "error":
      return <span className="nb-badge is-error">Error</span>
    default:
      return <span className="nb-badge is-idle">Not loaded</span>
  }
}

function Popup() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [stats, setStats] = useState<FilterStats>({ date: "", total: 0 })
  const [statuses, setStatuses] = useState<ModelStatuses>(EMPTY_STATUSES)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [toast, setToast] = useState("")
  const [preloading, setPreloading] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Partial<ExtensionSettings>>({})

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 2600)
  }, [])

  const flush = useCallback(async () => {
    const patch = pending.current
    pending.current = {}
    if (Object.keys(patch).length === 0) return
    setSaveState("saving")
    try {
      await saveSettings(patch)
      setSaveState("saved")
      if (saveStateTimer.current) clearTimeout(saveStateTimer.current)
      saveStateTimer.current = setTimeout(() => setSaveState("idle"), 1500)
    } catch {
      setSaveState("idle")
      showToast("Could not save settings. Try again.")
    }
  }, [showToast])

  const update = useCallback(
    (patch: Partial<ExtensionSettings>, immediate = true) => {
      setSettings((previous) => (previous ? { ...previous, ...patch } : previous))
      pending.current = { ...pending.current, ...patch }
      setSaveState("saving")

      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (immediate) {
        void flush()
      } else {
        saveTimer.current = setTimeout(() => void flush(), 450)
      }
    },
    [flush]
  )

  useEffect(() => {
    void getSettings().then(setSettings)
    void getStats().then(setStats)

    try {
      chrome.runtime.sendMessage({ action: "getModelStatus" }, (response) => {
        if (!chrome.runtime?.lastError && response?.statuses) {
          setStatuses(response.statuses)
        }
      })
    } catch {
      // Popup preview outside an extension context.
    }

    const onMessage = (message: any) => {
      if (message?.action === "modelStatus" && message.statuses) {
        setStatuses(message.statuses)
        setPreloading(false)
      }
    }

    const onStorage = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local") return
      if (changes.neoblocker_settings) void getSettings().then(setSettings)
      if (changes.neoblocker_stats) void getStats().then(setStats)
    }

    // Popups are torn down without a React unmount, so save pending text
    // (keyword lists) on pagehide as well as in the effect cleanup.
    const flushOnClose = () => {
      if (Object.keys(pending.current).length > 0) {
        void saveSettings(pending.current)
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)
    chrome.storage.onChanged.addListener(onStorage)
    window.addEventListener("pagehide", flushOnClose)

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage)
      chrome.storage.onChanged.removeListener(onStorage)
      window.removeEventListener("pagehide", flushOnClose)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      if (saveStateTimer.current) clearTimeout(saveStateTimer.current)
      flushOnClose()
    }
  }, [])

  const preload = () => {
    const enabledLoaded =
      (!settings.enableToxicity || statuses.toxicity === "loaded") &&
      (!settings.enableBias || statuses.bias === "loaded")
    if (enabledLoaded) {
      showToast("Models are already loaded.")
      return
    }
    setPreloading(true)
    showToast("Loading models — the optional bias model can take a few minutes.")
    try {
      chrome.runtime.sendMessage({ action: "warmupModels" }, (response) => {
        if (chrome.runtime?.lastError) {
          showToast("Could not load the models. Check your connection.")
        } else if (response?.statuses) {
          setStatuses(response.statuses)
        }
        setPreloading(false)
      })
    } catch {
      setPreloading(false)
      showToast("Could not reach the extension background worker.")
    }
  }

  const openReadme = () => {
    try {
      chrome.tabs.create({
        url: "https://github.com/g1gowda123/Neoblocker#readme"
      })
    } catch {
      showToast("Open the README from the extension's GitHub page.")
    }
  }

  const restorePage = () => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) {
          showToast("Open a YouTube tab first.")
          return
        }
        chrome.tabs.sendMessage(tab.id, { action: "resetPage" }, () => {
          if (chrome.runtime?.lastError) {
            showToast("Reload the YouTube page to reconnect.")
          } else {
            showToast("Hidden items restored.")
          }
        })
      })
    } catch {
      showToast("Open a YouTube tab first.")
    }
  }

  const doResetSettings = async () => {
    if (!window.confirm("Reset all Neoblocker settings to their defaults?")) return
    // Drop any debounced edits so they cannot overwrite the defaults.
    pending.current = {}
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      const next = await resetSettings()
      setSettings(next)
      showToast("Settings reset to defaults.")
    } catch {
      showToast("Could not reset settings. Try again.")
    }
  }

  const doResetStats = async () => {
    if (!window.confirm("Clear today's filtered count?")) return
    try {
      await resetStats()
      setStats({ date: "", total: 0 })
      showToast("Counter reset.")
    } catch {
      showToast("Could not reset the counter. Try again.")
    }
  }

  if (!settings) {
    return (
      <main className="nb-app" data-theme="dark">
        <div className="nb-header">
          <div className="nb-logo">
            <Logo />
          </div>
          <div>
            <h1 className="nb-title">Neoblocker</h1>
            <p className="nb-subtitle">Local AI content filter</p>
          </div>
        </div>
        <div className="nb-section">
          <p className="nb-hint">Loading settings…</p>
        </div>
      </main>
    )
  }

  const version = (() => {
    try {
      return chrome.runtime.getManifest().version
    } catch {
      return "1.2.0"
    }
  })()

  const active = settings.enabled
  const modelsBusy =
    statuses.toxicity === "loading" || statuses.bias === "loading"

  return (
    <main className="nb-app" data-theme={settings.theme}>
      <header className="nb-header">
        <div className="nb-logo">
          <Logo />
        </div>
        <div>
          <h1 className="nb-title">Neoblocker</h1>
          <p className="nb-subtitle">Local AI content filter for YouTube</p>
        </div>
        <div className="nb-header-actions">
          <button
            type="button"
            className="nb-icon-button is-wide"
            title={
              settings.theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            aria-label="Toggle light or dark theme"
            onClick={() =>
              update({ theme: settings.theme === "dark" ? "light" : "dark" })
            }>
            {settings.theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            className="nb-icon-button"
            title="Help & privacy"
            aria-label="Open the README"
            onClick={openReadme}>
            ?
          </button>
        </div>
      </header>

      <div className="nb-stats">
        <div className="nb-stat">
          <div className="nb-stat-value">{stats.total}</div>
          <div className="nb-stat-label">Filtered today</div>
        </div>
        <div className="nb-stat">
          <div className="nb-stat-value" style={{ textTransform: "capitalize" }}>
            {settings.filterMode === "remove" ? "Hide" : "Blur"}
          </div>
          <div className="nb-stat-label">
            {settings.deepScan ? "Deep scan on" : "Page only"}
          </div>
        </div>
      </div>

      <section className="nb-section">
        <div className="nb-row" style={{ paddingTop: 2 }}>
          <div className="nb-row-text">
            <div className="nb-row-label">Protection</div>
            <div className="nb-row-hint">
              {active ? "Applies to every YouTube tab" : "Paused — nothing is filtered"}
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            label="Enable Neoblocker"
            onChange={(value) => update({ enabled: value })}
          />
        </div>
      </section>

      <div className={active ? "" : "nb-disabled"}>
        <section className="nb-section">
          <div className="nb-section-head">
            <h2 className="nb-section-title">Detection</h2>
            <span className="nb-save-note is-visible" style={{ opacity: saveState === "idle" ? 0 : 1 }}>
              {saveState === "saving" ? "Saving…" : "Saved"}
            </span>
          </div>

          <div className="nb-row">
            <div className="nb-row-text">
              <div className="nb-row-label">Toxicity &amp; hate speech</div>
              <div className="nb-row-hint">Threats, harassment, and abuse</div>
            </div>
            <Switch
              checked={settings.enableToxicity}
              label="Toxicity filtering"
              onChange={(value) =>
                update(
                  value
                    ? { enableToxicity: true }
                    : { enableToxicity: false, enableBias: false }
                )
              }
            />
          </div>
          <Slider
            label="Toxicity threshold"
            hint="Minimum confidence needed to flag. Lower values flag more aggressively; 50% is a good default."
            value={settings.toxicityThreshold}
            disabled={!settings.enableToxicity}
            onChange={(value) => update({ toxicityThreshold: value }, false)}
          />

          <div className="nb-row">
            <div className="nb-row-text">
              <div className="nb-row-label">Hate speech</div>
              <div className="nb-row-hint">Identity attacks and extremist language</div>
            </div>
          </div>
          <Slider
            label="Hate speech threshold"
            hint="Independent of the overall toxicity threshold. Lower values flag more."
            value={settings.racismThreshold}
            disabled={!settings.enableToxicity}
            onChange={(value) => update({ racismThreshold: value }, false)}
          />

          <div className="nb-row">
            <div className="nb-row-text">
              <div className="nb-row-label">Abusive profanity</div>
              <div className="nb-row-hint">Extra check for obscene insults</div>
            </div>
            <Switch
              checked={settings.enableObscene}
              label="Filter abusive profanity"
              disabled={!settings.enableToxicity}
              onChange={(value) => update({ enableObscene: value })}
            />
          </div>

          <div className="nb-row">
            <div className="nb-row-text">
              <div className="nb-row-label">Rage-bait &amp; bias</div>
              <div className="nb-row-hint">
                Optional. Adds an 83 MB model download the first time it runs.
              </div>
            </div>
            <Switch
              checked={settings.enableBias}
              label="Bias filtering"
              disabled={!settings.enableToxicity}
              onChange={(value) => update({ enableBias: value })}
            />
          </div>
          <Slider
            label="Bias threshold"
            hint="Only blocks biased text that also carries toxic signals."
            value={settings.biasThreshold}
            disabled={!settings.enableBias || !settings.enableToxicity}
            onChange={(value) => update({ biasThreshold: value }, false)}
          />
        </section>

        <section className="nb-section">
          <h2 className="nb-section-title" style={{ marginBottom: 8 }}>
            Scanning
          </h2>

          <div className="nb-row">
            <div className="nb-row-text">
              <div className="nb-row-label">Deep scan</div>
              <div className="nb-row-hint">
                Off by default. Fetches the watch page and subtitles for cards
                that stay in view.
              </div>
            </div>
            <Switch
              checked={settings.deepScan}
              label="Deep scan"
              onChange={(value) => update({ deepScan: value })}
            />
          </div>

          {settings.deepScan ? (
            <p className="nb-hint is-warning">
              Deep scan downloads roughly 140 KB per video after it stays in
              view. Leave it off on metered connections.
            </p>
          ) : null}

          <div className="nb-field">
            <span className="nb-label">When something is flagged</span>
            <div className="nb-segment" role="group" aria-label="Filter mode">
              <button
                type="button"
                className={settings.filterMode === "blur" ? "is-active" : ""}
                aria-pressed={settings.filterMode === "blur"}
                onClick={() => update({ filterMode: "blur" })}>
                Blur with reason
              </button>
              <button
                type="button"
                className={settings.filterMode === "remove" ? "is-active" : ""}
                aria-pressed={settings.filterMode === "remove"}
                onClick={() => update({ filterMode: "remove" })}>
                Hide completely
              </button>
            </div>
          </div>

          <div className="nb-actions">
            <button type="button" className="nb-button" onClick={restorePage}>
              Restore hidden items
            </button>
          </div>
        </section>

        <section className="nb-section">
          <h2 className="nb-section-title" style={{ marginBottom: 8 }}>
            Keywords &amp; exceptions
          </h2>

          <div className="nb-field">
            <label className="nb-label" htmlFor="nb-banned">
              Always block
            </label>
            <textarea
              id="nb-banned"
              className="nb-textarea"
              spellCheck={false}
              placeholder="crypto scam, gambling, spoilers"
              value={settings.bannedKeywords}
              onChange={(event) =>
                update({ bannedKeywords: event.target.value }, false)
              }
              onBlur={() => void flush()}
            />
            <p className="nb-hint">Comma-separated. Matched against titles, channels and comments.</p>
          </div>

          <div className="nb-field">
            <label className="nb-label" htmlFor="nb-exceptions">
              Never block
            </label>
            <textarea
              id="nb-exceptions"
              className="nb-textarea"
              spellCheck={false}
              placeholder="Channel name, trusted keyword"
              value={settings.exceptions}
              onChange={(event) =>
                update({ exceptions: event.target.value }, false)
              }
              onBlur={() => void flush()}
            />
            <p className="nb-hint">
              Allowlists a channel or phrase. “Allow channel” on an overlay adds it here.
            </p>
          </div>
        </section>

        <section className="nb-section">
          <div className="nb-section-head">
            <h2 className="nb-section-title">Local models</h2>
            <button
              type="button"
              className="nb-button"
              disabled={preloading || modelsBusy}
              onClick={preload}>
              {preloading || modelsBusy ? "Loading…" : "Preload"}
            </button>
          </div>

          <div className="nb-row">
            <div className="nb-row-text">
              <div className="nb-row-label">Toxicity classifier</div>
              <div className="nb-row-hint">Runs on-device · bundled ~23 MB</div>
            </div>
            {statusBadge(statuses.toxicity, statuses.progress.toxicity)}
          </div>

          <div className="nb-row">
            <div className="nb-row-text">
              <div className="nb-row-label">Bias classifier</div>
              <div className="nb-row-hint">Runs on-device · ~83 MB</div>
            </div>
            {statusBadge(statuses.bias, statuses.progress.bias)}
          </div>

          {statuses.toxicity === "error" ? (
            <p className="nb-hint" style={{ color: "var(--danger)" }}>
              The bundled toxicity model failed to load. Reload the extension
              from chrome://extensions and try again.
            </p>
          ) : statuses.bias === "error" ? (
            <p className="nb-hint" style={{ color: "var(--danger)" }}>
              The optional bias model failed to download. Check your connection,
              then press Preload to retry.
            </p>
          ) : (
            <p className="nb-hint">
              The toxicity model is bundled. Optional bias weights download once
              and are cached locally. Text never leaves your device.
            </p>
          )}
        </section>

        <section className="nb-section">
          <h2 className="nb-section-title" style={{ marginBottom: 8 }}>
            Reset
          </h2>
          <div className="nb-actions" style={{ marginTop: 0 }}>
            <button type="button" className="nb-button" onClick={doResetStats}>
              Clear counter
            </button>
            <button
              type="button"
              className="nb-button is-danger"
              onClick={doResetSettings}>
              Reset all settings
            </button>
          </div>
        </section>
      </div>

      {toast ? (
        <div className="nb-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      <footer className="nb-footer">
        <span>100% local inference · No account</span>
        <span>v{version}</span>
      </footer>
    </main>
  )
}

export default Popup
