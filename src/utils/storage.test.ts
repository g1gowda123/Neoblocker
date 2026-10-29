import { beforeEach, describe, expect, it } from "vitest"

import { resetMockStorage } from "../../vitest.setup"
import {
  DEFAULT_SETTINGS,
  addBlockedCount,
  getSettings,
  getStats,
  resetSettings,
  resetStats,
  sanitizeSettings,
  saveSettings,
  todayKey
} from "./storage"

describe("sanitizeSettings", () => {
  it("fills defaults for missing or corrupt values", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(
      sanitizeSettings({
        enabled: "yes",
        toxicityThreshold: 5,
        biasThreshold: -2,
        theme: "neon",
        filterMode: "explode",
        deepScan: "nope"
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      toxicityThreshold: 0.95,
      biasThreshold: 0.05
    })
  })

  it("keeps valid values", () => {
    const result = sanitizeSettings({
      enabled: false,
      enableToxicity: false,
      enableBias: false,
      theme: "light",
      filterMode: "remove",
      bannedKeywords: "crypto",
      exceptions: "trusted channel",
      deepScan: false,
      racismThreshold: 0.4
    })

    expect(result.enabled).toBe(false)
    expect(result.theme).toBe("light")
    expect(result.filterMode).toBe("remove")
    expect(result.bannedKeywords).toBe("crypto")
    expect(result.racismThreshold).toBe(0.4)
  })
})

describe("todayKey", () => {
  it("uses local date parts", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05")
    expect(todayKey(new Date(2026, 11, 31))).toBe("2026-12-31")
  })
})

describe("settings persistence", () => {
  beforeEach(() => {
    resetMockStorage()
  })

  it("serializes overlapping patches instead of clobbering them", async () => {
    await resetSettings()
    await Promise.all([
      saveSettings({ toxicityThreshold: 0.7 }),
      saveSettings({ biasThreshold: 0.62 }),
      saveSettings({ bannedKeywords: "gambling" })
    ])

    const settings = await getSettings()
    expect(settings.toxicityThreshold).toBe(0.7)
    expect(settings.biasThreshold).toBe(0.62)
    expect(settings.bannedKeywords).toBe("gambling")
  })
})

describe("daily stats", () => {
  beforeEach(() => {
    resetMockStorage()
  })

  it("increments the count and resets it", async () => {
    await resetStats()
    await addBlockedCount(2)
    await addBlockedCount(3)

    expect((await getStats()).total).toBe(5)

    await resetStats()
    expect((await getStats()).total).toBe(0)
  })

  it("clamps absurd increments", async () => {
    await resetStats()
    await addBlockedCount(100_000)
    expect((await getStats()).total).toBe(100)
  })
})
