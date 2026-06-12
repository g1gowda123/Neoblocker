import { useEffect, useState } from "react"
import { getSettings, saveSettings } from "~utils/storage"
import type { ModelStatuses } from "~utils/ai-router"
import extensionIcon from "url:../assets/icon.png"
import "~style.css"

// ─── Types ────────────────────────────────────────────────────────────────────
type ModelStatus = "idle" | "loading" | "loaded" | "error"

// ─── Main Popup ───────────────────────────────────────────────────────────────
function IndexPopup() {
  const [enableToxicity, setEnableToxicity] = useState(true)
  const [enableBias, setEnableBias] = useState(true)
  const [toxicityThreshold, setToxicityThreshold] = useState(0.50)
  const [biasThreshold, setBiasThreshold] = useState(0.50)
  const [racismThreshold, setRacismThreshold] = useState(0.25)
  const [exceptions, setExceptions] = useState("")
  const [enableObscene, setEnableObscene] = useState(true)
  const [filterMode, setFilterMode] = useState<"blur" | "remove">("blur")
  const [bannedKeywords, setBannedKeywords] = useState("")
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [statuses, setStatuses] = useState<ModelStatuses>({ toxicity: "idle", bias: "idle" })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSettings().then((s) => {
      setEnableToxicity(s.enableToxicity)
      setEnableBias(s.enableBias)
      setToxicityThreshold(s.toxicityThreshold)
      setBiasThreshold(s.biasThreshold)
      setRacismThreshold(s.racismThreshold ?? 0.25)
      setTheme(s.theme || "dark")
      setExceptions(s.exceptions || "")
      setEnableObscene(s.enableObscene ?? true)
      setFilterMode(s.filterMode || "blur")
      setBannedKeywords(s.bannedKeywords || "")
      setLoaded(true)
    })

    chrome.runtime
      .sendMessage({ action: "getModelStatus" })
      .then((res) => {
        if (res) setStatuses(res)
      })
      .catch(() => { })

    const listener = (msg: { action: string; statuses?: ModelStatuses }) => {
      if (msg.action === "modelStatus" && msg.statuses) {
        setStatuses(msg.statuses)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  useEffect(() => {
    if (loaded) {
      // Chromium native background colors
      const bg = theme === "dark" ? "#202124" : "#ffffff"
      document.documentElement.style.backgroundColor = bg
      document.body.style.backgroundColor = bg
    }
  }, [theme, loaded])

  const handleToxicityToggle = (val: boolean) => {
    setEnableToxicity(val)
    saveSettings({ enableToxicity: val })
  }

  const handleBiasToggle = (val: boolean) => {
    setEnableBias(val)
    saveSettings({ enableBias: val })
  }

  const handleToxicityThresholdChange = (val: number) => {
    setToxicityThreshold(val)
    saveSettings({ toxicityThreshold: val })
  }

  const handleBiasThresholdChange = (val: number) => {
    setBiasThreshold(val)
    saveSettings({ biasThreshold: val })
  }

  const handleRacismThresholdChange = (val: number) => {
    setRacismThreshold(val)
    saveSettings({ racismThreshold: val })
  }

  const handleExceptionsChange = (val: string) => {
    setExceptions(val)
    saveSettings({ exceptions: val })
  }

  const handleObsceneToggle = (val: boolean) => {
    setEnableObscene(val)
    saveSettings({ enableObscene: val })
  }

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    saveSettings({ theme: nextTheme })
  }

  const handleFilterModeToggle = () => {
    const next = filterMode === "blur" ? "remove" : "blur"
    setFilterMode(next)
    saveSettings({ filterMode: next })
  }

  const handleBannedKeywordsChange = (val: string) => {
    setBannedKeywords(val)
    saveSettings({ bannedKeywords: val })
  }

  if (!loaded) {
    return (
      <div className="plasmo-w-[360px] plasmo-h-[400px] plasmo-bg-[#202124] plasmo-flex plasmo-items-center plasmo-justify-center">
        <div className="plasmo-w-8 plasmo-h-8 plasmo-rounded-full plasmo-border-[3px] plasmo-border-[#8ab4f8] plasmo-border-t-transparent plasmo-animate-spin" />
      </div>
    )
  }

  // Chromium native design tokens
  const isDark = theme === "dark"
  const bgColor = isDark ? "plasmo-bg-[#202124]" : "plasmo-bg-white"
  const cardBg = isDark ? "plasmo-bg-[#292a2d]" : "plasmo-bg-[#f1f3f4]"
  const textColor = isDark ? "plasmo-text-[#e8eaed]" : "plasmo-text-[#202124]"
  const secTextColor = isDark ? "plasmo-text-[#9aa0a6]" : "plasmo-text-[#5f6368]"
  const borderColor = isDark ? "plasmo-border-[#3c4043]" : "plasmo-border-[#dadce0]"

  // Classic Chromium Blue
  const activeSwitchBg = isDark ? "plasmo-bg-[#8ab4f8]" : "plasmo-bg-[#1a73e8]"
  const inactiveSwitchBg = isDark ? "plasmo-bg-[#5f6368]" : "plasmo-bg-[#e8eaed]"

  // Chrome handles toggle thumbs differently in dark mode
  const activeDot = isDark ? "plasmo-bg-[#202124]" : "plasmo-bg-white"
  const inactiveDot = isDark ? "plasmo-bg-[#dadce0]" : "plasmo-bg-white"

  const sliderAccent = isDark ? "accent-[#8ab4f8]" : "accent-[#1a73e8]"

  const isModelLoading = statuses.toxicity === "loading" || statuses.bias === "loading"

  return (
    <div className={`plasmo-w-[360px] ${bgColor} ${textColor} plasmo-font-sans plasmo-select-none plasmo-transition-colors plasmo-duration-300 plasmo-p-5 plasmo-rounded-[16px] plasmo-shadow-lg plasmo-overflow-hidden`}>

      {/* Header */}
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-pb-4 plasmo-border-b border-inherit">
        <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
          <img src={extensionIcon} className="plasmo-w-7 plasmo-h-7 plasmo-rounded-md" alt="Neoblocker Logo" />
          <div className="plasmo-flex plasmo-flex-col">
            <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
              <span className="plasmo-text-lg plasmo-font-medium plasmo-tracking-tight">Neoblocker</span>
              {isModelLoading && (
                <span className={`plasmo-w-2 plasmo-h-2 plasmo-rounded-full ${isDark ? "plasmo-bg-[#8ab4f8]" : "plasmo-bg-[#1a73e8]"} plasmo-animate-pulse`} title="Model is loading..." />
              )}
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={handleThemeToggle}
          className={`plasmo-p-2 plasmo-rounded-full plasmo-transition-all plasmo-duration-200 ${isDark ? "hover:plasmo-bg-[#3c4043] text-[#9aa0a6] hover:text-[#e8eaed]" : "hover:plasmo-bg-[#e8eaed] text-[#5f6368] hover:text-[#202124]"}`}
          title="Toggle Theme"
        >
          {isDark ? (
            <svg className="plasmo-w-5 plasmo-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          ) : (
            <svg className="plasmo-w-5 plasmo-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      {/* Main Settings List */}
      <div className="plasmo-mt-5 plasmo-space-y-4">

        {/* Toxicity Section Group */}
        <div className={`${cardBg} plasmo-p-4 plasmo-rounded-[12px] ${borderColor} plasmo-border plasmo-transition-colors plasmo-duration-300`}>
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <span className="plasmo-text-sm plasmo-font-medium">Toxicity Shield</span>
            <button
              onClick={() => handleToxicityToggle(!enableToxicity)}
              className={`plasmo-relative plasmo-inline-flex plasmo-h-[22px] plasmo-w-10 plasmo-items-center plasmo-rounded-full plasmo-transition-colors plasmo-duration-300 plasmo-shrink-0 ${enableToxicity ? activeSwitchBg : inactiveSwitchBg}`}
            >
              <span className={`plasmo-absolute plasmo-h-4 plasmo-w-4 plasmo-rounded-full plasmo-shadow-sm plasmo-transition-all plasmo-duration-300 plasmo-top-[3px] ${enableToxicity ? `plasmo-right-[3px] ${activeDot}` : `plasmo-left-[3px] ${inactiveDot}`}`} />
            </button>
          </div>

          {enableToxicity && (
            <div className="plasmo-space-y-5 plasmo-mt-4 plasmo-pt-4 plasmo-border-t border-inherit">

              {/* General Toxicity Limit Slider — inverted: right = more sensitive = lower threshold */}
              <div className="plasmo-space-y-2">
                <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-text-xs">
                  <span className={secTextColor}>General Toxicity Sensitivity</span>
                  <span className="plasmo-font-medium plasmo-font-mono">{(1.0 - toxicityThreshold).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={(1.0 - toxicityThreshold)}
                  onChange={(e) => handleToxicityThresholdChange(parseFloat((1.0 - parseFloat(e.target.value)).toFixed(2)))}
                  className={`plasmo-w-full plasmo-h-1 plasmo-bg-[#dadce0] dark:plasmo-bg-[#3c4043] plasmo-rounded-lg plasmo-appearance-none plasmo-cursor-pointer ${sliderAccent} plasmo-outline-none`}
                />
              </div>

              {/* Racism & Hate Speech Slider — inverted: right = more sensitive = lower threshold */}
              <div className="plasmo-space-y-2">
                <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-text-xs">
                  <span className={secTextColor}>Racism & Hate Speech Sensitivity</span>
                  <span className="plasmo-font-medium plasmo-font-mono">{(0.55 - racismThreshold).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.50"
                  step="0.05"
                  value={(0.55 - racismThreshold)}
                  onChange={(e) => handleRacismThresholdChange(parseFloat((0.55 - parseFloat(e.target.value)).toFixed(2)))}
                  className={`plasmo-w-full plasmo-h-1 plasmo-bg-[#dadce0] dark:plasmo-bg-[#3c4043] plasmo-rounded-lg plasmo-appearance-none plasmo-cursor-pointer ${sliderAccent} plasmo-outline-none`}
                />
              </div>

              {/* Obscene toggle switch */}
              <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
                <span className={`plasmo-text-xs ${secTextColor}`}>Obscene Language Filter</span>
                <button
                  onClick={() => handleObsceneToggle(!enableObscene)}
                  className={`plasmo-relative plasmo-inline-flex plasmo-h-[18px] plasmo-w-8 plasmo-items-center plasmo-rounded-full plasmo-transition-colors plasmo-duration-300 plasmo-shrink-0 ${enableObscene ? activeSwitchBg : inactiveSwitchBg}`}
                >
                  <span className={`plasmo-absolute plasmo-h-3.5 plasmo-w-3.5 plasmo-rounded-full plasmo-shadow-sm plasmo-transition-all plasmo-duration-300 plasmo-top-[2px] ${enableObscene ? `plasmo-right-[2px] ${activeDot}` : `plasmo-left-[2px] ${inactiveDot}`}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bias Section Group */}
        <div className={`${cardBg} plasmo-p-4 plasmo-rounded-[12px] ${borderColor} plasmo-border plasmo-transition-colors plasmo-duration-300`}>
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <span className="plasmo-text-sm plasmo-font-medium">Bias & Clickbait Filter</span>
            <button
              onClick={() => handleBiasToggle(!enableBias)}
              className={`plasmo-relative plasmo-inline-flex plasmo-h-[22px] plasmo-w-10 plasmo-items-center plasmo-rounded-full plasmo-transition-colors plasmo-duration-300 plasmo-shrink-0 ${enableBias ? activeSwitchBg : inactiveSwitchBg}`}
            >
              <span className={`plasmo-absolute plasmo-h-4 plasmo-w-4 plasmo-rounded-full plasmo-shadow-sm plasmo-transition-all plasmo-duration-300 plasmo-top-[3px] ${enableBias ? `plasmo-right-[3px] ${activeDot}` : `plasmo-left-[3px] ${inactiveDot}`}`} />
            </button>
          </div>

          {enableBias && (
            <div className="plasmo-space-y-2 plasmo-mt-4 plasmo-pt-4 plasmo-border-t border-inherit">
              <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-text-xs">
                <span className={secTextColor}>Sensitivity</span>
                <span className="plasmo-font-medium plasmo-font-mono">{(1.0 - biasThreshold).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={(1.0 - biasThreshold)}
                onChange={(e) => handleBiasThresholdChange(parseFloat((1.0 - parseFloat(e.target.value)).toFixed(2)))}
                className={`plasmo-w-full plasmo-h-1 plasmo-bg-[#dadce0] dark:plasmo-bg-[#3c4043] plasmo-rounded-lg plasmo-appearance-none plasmo-cursor-pointer ${sliderAccent} plasmo-outline-none`}
              />
            </div>
          )}
        </div>

        {/* Filter Mode Row */}
        <div className={`${cardBg} plasmo-p-4 plasmo-rounded-[12px] ${borderColor} plasmo-border plasmo-transition-colors plasmo-duration-300`}>
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <div className="plasmo-flex plasmo-flex-col plasmo-gap-0.5">
              <span className="plasmo-text-sm plasmo-font-medium">Remove Mode</span>
              <span className={`plasmo-text-[11px] ${secTextColor}`}>
                Remove filtered content
              </span>
            </div>
            <button
              onClick={handleFilterModeToggle}
              className={`plasmo-relative plasmo-inline-flex plasmo-h-[22px] plasmo-w-10 plasmo-items-center plasmo-rounded-full plasmo-transition-colors plasmo-duration-300 plasmo-shrink-0 ${filterMode === "remove" ? activeSwitchBg : inactiveSwitchBg}`}
            >
              <span className={`plasmo-absolute plasmo-h-4 plasmo-w-4 plasmo-rounded-full plasmo-shadow-sm plasmo-transition-all plasmo-duration-300 plasmo-top-[3px] ${filterMode === "remove" ? `plasmo-right-[3px] ${activeDot}` : `plasmo-left-[3px] ${inactiveDot}`}`} />
            </button>
          </div>
        </div>

        {/* Bypass Keywords Row */}
        <div className="plasmo-space-y-2.5 plasmo-px-1">
          <div className="plasmo-flex plasmo-flex-col plasmo-gap-1">
            <span className="plasmo-text-sm plasmo-font-medium">Bypass Keywords</span>
            <span className={`plasmo-text-[11px] ${secTextColor}`}>Always allow matching titles, creators or topics (comma-separated)</span>
          </div>
          <input
            type="text"
            value={exceptions}
            placeholder="e.g. mrbeast, nvidia, ludwig"
            onChange={(e) => handleExceptionsChange(e.target.value)}
            className={`plasmo-w-full plasmo-text-sm plasmo-px-3.5 plasmo-py-2.5 plasmo-rounded-lg plasmo-border plasmo-outline-none plasmo-transition-all plasmo-duration-200 ${isDark
              ? "plasmo-bg-[#202124] plasmo-border-[#3c4043] plasmo-text-[#e8eaed] focus:plasmo-border-[#8ab4f8]"
              : "plasmo-bg-[#ffffff] plasmo-border-[#dadce0] plasmo-text-[#202124] focus:plasmo-border-[#1a73e8]"
              }`}
          />
        </div>

        {/* Banned Keywords Row */}
        <div className="plasmo-space-y-2.5 plasmo-px-1 plasmo-mt-4">
          <div className="plasmo-flex plasmo-flex-col plasmo-gap-1">
            <span className="plasmo-text-sm plasmo-font-medium">Banned Keywords</span>
            <span className={`plasmo-text-[11px] ${secTextColor}`}>Block/hide matching titles, creators or topics (comma-separated)</span>
          </div>
          <input
            type="text"
            value={bannedKeywords}
            placeholder="e.g. copilot, spoiler, reaction"
            onChange={(e) => handleBannedKeywordsChange(e.target.value)}
            className={`plasmo-w-full plasmo-text-sm plasmo-px-3.5 plasmo-py-2.5 plasmo-rounded-lg plasmo-border plasmo-outline-none plasmo-transition-all plasmo-duration-200 ${isDark
              ? "plasmo-bg-[#202124] plasmo-border-[#3c4043] plasmo-text-[#e8eaed] focus:plasmo-border-[#8ab4f8]"
              : "plasmo-bg-[#ffffff] plasmo-border-[#dadce0] plasmo-text-[#202124] focus:plasmo-border-[#1a73e8]"
              }`}
          />
        </div>

      </div>
    </div>
  )
}

export default IndexPopup