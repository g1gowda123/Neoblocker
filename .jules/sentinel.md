
## 2024-05-18 - [Robust JSON Parsing over Regex]
**Vulnerability:** Used non-greedy regex `/.+?/` to extract `ytInitialPlayerResponse` JSON from HTML strings. Attackers could bypass this by injecting `};` inside a string (e.g. video title), truncating the JSON and causing a parse failure or Denial of Service.
**Learning:** Regex is not suitable for parsing complex nested structures like JSON, especially when they can contain arbitrary user input that mimics structural delimiters.
**Prevention:** Use a robust, brace-matching algorithmic parser that tracks state (in-string, escaped characters, brace depth) to safely extract nested JSON blocks from larger strings.

## 2024-05-18 - [Background Script Input Validation & Error Leakage]
**Vulnerability:** The `chrome.runtime.onMessage` listener in `src/background.ts` lacked input validation for `request.text` and `request.videoId`. It also leaked internal stack traces via `String(err)` back to the content script. This exposed the extension to DoS attacks via massive strings, potential SSRF via manipulated `videoId`s, and information disclosure.
**Learning:** Background scripts act as a security boundary. Any message from a content script (even our own) must be treated as untrusted input. Error responses should never leak internal implementation details.
**Prevention:** Strictly validate input types, enforce length limits, validate specific formats (like YouTube video IDs with regex), and always return generic error messages across security boundaries.
