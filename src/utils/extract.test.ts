import { describe, expect, it } from "vitest"

import {
  decodeHtmlEntities,
  extractJsonBlock,
  isTrustedYouTubeUrl,
  isValidVideoId,
  sampleText
} from "./extract"

describe("isValidVideoId", () => {
  it("accepts 11-character YouTube ids", () => {
    expect(isValidVideoId("dQw4w9WgXcQ")).toBe(true)
    expect(isValidVideoId("_-abcDEF123")).toBe(true)
  })

  it("rejects invalid ids", () => {
    expect(isValidVideoId("short")).toBe(false)
    expect(isValidVideoId("dQw4w9WgXcQx")).toBe(false)
    expect(isValidVideoId(undefined)).toBe(false)
    expect(isValidVideoId("../../etc/passwd")).toBe(false)
  })
})

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry &quot;live&quot;")).toBe(
      'Tom & Jerry "live"'
    )
    expect(decodeHtmlEntities("caf&#233; &#x41;")).toBe("café A")
  })
})

describe("extractJsonBlock", () => {
  it("extracts a balanced object containing nested braces and strings", () => {
    const html = `<script>var ytInitialPlayerResponse = {"a":{"b":"}"},"c":1};</script>`
    expect(extractJsonBlock(html, "ytInitialPlayerResponse")).toBe(
      '{"a":{"b":"}"},"c":1}'
    )
  })

  it("handles whitespace around the equals sign", () => {
    const html = `ytInitialData = {"ok": true};`
    expect(extractJsonBlock(html, "ytInitialData")).toBe('{"ok": true}')
  })

  it("returns null when the variable is missing", () => {
    expect(extractJsonBlock("<html></html>", "ytInitialData")).toBeNull()
  })
})

describe("isTrustedYouTubeUrl", () => {
  it("allows only HTTPS YouTube/googlevideo hosts", () => {
    expect(isTrustedYouTubeUrl("https://www.youtube.com/api/timedtext")).toBe(
      true
    )
    expect(isTrustedYouTubeUrl("https://youtube.com/watch?v=abc")).toBe(true)
    expect(isTrustedYouTubeUrl("https://rr1---sn-abc.googlevideo.com/videoplayback")).toBe(
      true
    )
  })

  it("rejects lookalikes, credentials and non-HTTPS URLs", () => {
    expect(isTrustedYouTubeUrl("https://youtube.com.evil.test/")).toBe(false)
    expect(isTrustedYouTubeUrl("http://www.youtube.com/")).toBe(false)
    expect(isTrustedYouTubeUrl("https://user:pass@youtube.com/")).toBe(false)
    expect(isTrustedYouTubeUrl("https://youtube.com:8443/")).toBe(false)
    expect(isTrustedYouTubeUrl("javascript:alert(1)")).toBe(false)
  })
})

describe("sampleText", () => {
  it("keeps the whole text when it is short", () => {
    expect(sampleText("  hello   world  ", 50)).toBe("hello world")
  })

  it("samples the start, middle and end of long text", () => {
    const text = `START ${"a".repeat(500)} MIDDLE ${"b".repeat(500)} END`
    const sample = sampleText(text, 90)

    expect(sample.length).toBeLessThanOrEqual(96)
    expect(sample.startsWith("START")).toBe(true)
    expect(sample.endsWith("END")).toBe(true)
    expect(sample).toContain(" … ")
  })
})
