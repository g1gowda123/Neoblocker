
## 2024-05-18 - [Robust JSON Parsing over Regex]
**Vulnerability:** Used non-greedy regex `/.+?/` to extract `ytInitialPlayerResponse` JSON from HTML strings. Attackers could bypass this by injecting `};` inside a string (e.g. video title), truncating the JSON and causing a parse failure or Denial of Service.
**Learning:** Regex is not suitable for parsing complex nested structures like JSON, especially when they can contain arbitrary user input that mimics structural delimiters.
**Prevention:** Use a robust, brace-matching algorithmic parser that tracks state (in-string, escaped characters, brace depth) to safely extract nested JSON blocks from larger strings.

## 2024-06-20 - [Security Boundary Validation in Background Scripts]
**Vulnerability:** The background script's `chrome.runtime.onMessage` listener accepted parameters (`request.text`, `request.videoId`) directly from content scripts without validation. Additionally, raw error strings were sent back in responses upon failure. This exposed the extension to DoS (via excessively large strings), SSRF (via malformed video IDs used in `fetch`), and information leakage (exposing stack traces or sensitive internal paths in errors).
**Learning:** The boundary between content scripts and background scripts must be treated as a strict security perimeter. Input must always be validated (type, length, regex format) and errors must be sanitized before crossing this boundary.
**Prevention:** Always implement explicit validation blocks at the top of message handlers. Ensure `catch` blocks log raw errors internally but only return generic, sanitized error strings to the sender.
