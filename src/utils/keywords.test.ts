import { describe, expect, it } from "vitest"

import {
  addKeyword,
  getKeywordRegex,
  matchesAnyKeyword,
  parseKeywordList
} from "./keywords"

describe("parseKeywordList", () => {
  it("trims, lowercases and de-duplicates", () => {
    expect(parseKeywordList(" Crypto, gambling ,crypto,, SPOILERS ")).toEqual([
      "crypto",
      "gambling",
      "spoilers"
    ])
  })

  it("handles non-string input", () => {
    expect(parseKeywordList(null)).toEqual([])
    expect(parseKeywordList(42)).toEqual([])
  })
})

describe("matchesAnyKeyword", () => {
  it("matches case-insensitively across several fields", () => {
    expect(matchesAnyKeyword("crypto scam", "A title", "Crypto Scam channel")).toBe(
      true
    )
    expect(matchesAnyKeyword("crypto scam", "A title", "Another channel")).toBe(
      false
    )
  })

  it("escapes regex metacharacters in keywords", () => {
    expect(matchesAnyKeyword("c++ tutorial", "Learn c++ tutorial")).toBe(true)
    expect(matchesAnyKeyword("c++ tutorial", "Learn Java")).toBe(false)
  })

  it("returns false for an empty list", () => {
    expect(matchesAnyKeyword("", "anything")).toBe(false)
    expect(getKeywordRegex("")).toBeNull()
  })
})

describe("addKeyword", () => {
  it("appends without creating duplicates", () => {
    expect(addKeyword("gambling", "Spoilers")).toBe("gambling, spoilers")
    expect(addKeyword("gambling, spoilers", "SPOILERS")).toBe(
      "gambling, spoilers"
    )
    expect(addKeyword("", "  Channel Name  ")).toBe("channel name")
    expect(addKeyword("gambling", "   ")).toBe("gambling")
  })
})
