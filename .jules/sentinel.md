
## 2024-05-18 - [Robust JSON Parsing over Regex]
**Vulnerability:** Used non-greedy regex `/.+?/` to extract `ytInitialPlayerResponse` JSON from HTML strings. Attackers could bypass this by injecting `};` inside a string (e.g. video title), truncating the JSON and causing a parse failure or Denial of Service.
**Learning:** Regex is not suitable for parsing complex nested structures like JSON, especially when they can contain arbitrary user input that mimics structural delimiters.
**Prevention:** Use a robust, brace-matching algorithmic parser that tracks state (in-string, escaped characters, brace depth) to safely extract nested JSON blocks from larger strings.

## 2024-06-18 - Input Validation and SSRF Prevention on IPC boundaries
**Vulnerability:** IPC boundaries (`chrome.runtime.onMessage`) were missing type checking and input limits. Large texts could cause DoS of ML models, and unrestricted Video IDs allowed potential SSRF/malformed fetches. Stack traces were also leaked on error.
**Learning:** `onMessage` listeners should act as security perimeters. Since the sender is technically trusted (our content script), it's easy to overlook validation, but defense-in-depth requires strict type checks, bounds limits, and regex constraints.
**Prevention:** Always validate and constrain inputs immediately at the boundary. Use fixed regexes for identifiers (e.g., `/^[a-zA-Z0-9_-]{11}$/` for YouTube IDs). Never leak raw `err` objects back across the boundary.
