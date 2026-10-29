// Shared parsing for the comma-separated "Bypass" and "Banned" keyword lists.
// Both the content script and the classifier use this so matching is consistent.

const MAX_CACHED_LISTS = 20
const regexCache = new Map<string, RegExp | null>()

export function parseKeywordList(raw: unknown): string[] {
  if (typeof raw !== "string") return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of raw.split(",")) {
    const keyword = part.trim().toLowerCase()
    if (!keyword || seen.has(keyword)) continue
    seen.add(keyword)
    result.push(keyword)
  }
  return result
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Compile a keyword list into a single case-insensitive regex.
 * Lists are cached because this runs for every card on every DOM pass.
 */
export function getKeywordRegex(raw: unknown): RegExp | null {
  if (typeof raw !== "string" || !raw.trim()) return null
  const cached = regexCache.get(raw)
  if (cached !== undefined) return cached

  const keywords = parseKeywordList(raw)
  const regex =
    keywords.length > 0
      ? new RegExp(keywords.map(escapeRegex).join("|"), "i")
      : null

  if (regexCache.size >= MAX_CACHED_LISTS) {
    const oldest = regexCache.keys().next().value
    if (oldest !== undefined) regexCache.delete(oldest)
  }
  regexCache.set(raw, regex)
  return regex
}

/** True when any of the supplied texts contains a listed keyword. */
export function matchesAnyKeyword(
  raw: unknown,
  ...texts: (string | undefined | null)[]
): boolean {
  const regex = getKeywordRegex(raw)
  if (!regex) return false
  return texts.some((value) => !!value && regex.test(value))
}

/** Add a keyword without creating duplicates. Returns the new list string. */
export function addKeyword(raw: unknown, keyword: string): string {
  const clean = keyword.trim()
  if (!clean) return typeof raw === "string" ? raw : ""
  const existing = parseKeywordList(raw)
  if (existing.includes(clean.toLowerCase())) {
    return typeof raw === "string" ? raw : ""
  }
  return [...existing, clean.toLowerCase()].join(", ")
}
