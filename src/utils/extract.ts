// Small, dependency-free helpers used to parse YouTube's watch page safely.

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

export function isValidVideoId(value: unknown): value is string {
  return typeof value === "string" && VIDEO_ID_PATTERN.test(value)
}

function fromCodePoint(value: number): string {
  try {
    return String.fromCodePoint(value)
  } catch {
    // Ignore malformed/out-of-range numeric entities rather than throwing.
    return ""
  }
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

/**
 * Extract a balanced `{...}` JSON object assigned to a variable in a large
 * HTML payload. Uses indexOf + a brace counter instead of a backtracking regex.
 */
export function extractJsonBlock(
  html: string,
  varName: string
): string | null {
  const targetStr1 = varName + " = {"
  const targetStr2 = varName + "={"
  let startIndex = html.indexOf(targetStr1)

  if (startIndex !== -1) {
    startIndex += targetStr1.length - 1
  } else {
    startIndex = html.indexOf(targetStr2)
    if (startIndex !== -1) {
      startIndex += targetStr2.length - 1
    } else {
      const match = new RegExp(`${varName}\\s*=\\s*({)`).exec(html)
      if (!match) return null
      startIndex = match.index + match[0].length - 1
    }
  }

  let depth = 0
  let inString = false
  let escape = false

  for (let i = startIndex; i < html.length; i++) {
    const char = html[i]

    if (inString) {
      if (escape) {
        escape = false
      } else if (char === "\\") {
        escape = true
      } else if (char === '"') {
        inString = false
      }
    } else if (char === '"') {
      inString = true
    } else if (char === "{") {
      depth++
    } else if (char === "}") {
      depth--
      if (depth === 0) return html.slice(startIndex, i + 1)
    }
  }
  return null
}

/** Only youtube.com / googlevideo.com over HTTPS may be fetched. */
export function isTrustedYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value, "https://www.youtube.com")
    if (url.protocol !== "https:") return false
    if (url.username || url.password) return false
    if (url.port && url.port !== "443") return false
    const host = url.hostname.toLowerCase()
    return (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "googlevideo.com" ||
      host.endsWith(".googlevideo.com")
    )
  } catch {
    return false
  }
}

export function isSafeInnerTubeKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{10,128}$/.test(value)
}

export function isSafeContinuationToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4096 &&
    /^[A-Za-z0-9_%=.\-]+$/.test(value)
  )
}

/**
 * Return at most `limit` characters sampled from the start, middle and end of
 * a long transcript. Classifiers only read the first few hundred tokens, so
 * sampling the whole video catches hostile segments that start appears late.
 */
export function sampleText(text: string, limit = 1200): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= limit) return clean

  const part = Math.max(1, Math.floor(limit / 3) - 2)
  const middleStart = Math.max(
    part,
    Math.floor(clean.length / 2 - part / 2)
  )
  const tailStart = Math.max(middleStart + part, clean.length - part)
  return [
    clean.slice(0, part),
    clean.slice(middleStart, middleStart + part),
    clean.slice(tailStart)
  ]
    .filter(Boolean)
    .join(" … ")
}
