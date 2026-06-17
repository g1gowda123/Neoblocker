
## 2024-05-18 - [Robust JSON Parsing over Regex]
**Vulnerability:** Used non-greedy regex `/.+?/` to extract `ytInitialPlayerResponse` JSON from HTML strings. Attackers could bypass this by injecting `};` inside a string (e.g. video title), truncating the JSON and causing a parse failure or Denial of Service.
**Learning:** Regex is not suitable for parsing complex nested structures like JSON, especially when they can contain arbitrary user input that mimics structural delimiters.
**Prevention:** Use a robust, brace-matching algorithmic parser that tracks state (in-string, escaped characters, brace depth) to safely extract nested JSON blocks from larger strings.

## 2025-02-18 - [Secure Message Passing]
**Vulnerability:** Missing input validation on background script message listeners. The `analyze` and `analyzeVideoId` endpoints accepted unbound strings from content scripts, posing DoS risks (large payloads) and potential SSRF risks via unrestricted video ID parameters used in network requests. Unsanitized error messages were also leaked.
**Learning:** Chrome extension message listeners act as security boundaries. Content scripts must be treated as untrusted, meaning all inputs into background scripts must be validated before processing.
**Prevention:** Strictly validate input data types and implement length constraints for strings to prevent resource exhaustion. Apply strict regex matching (e.g. `^[a-zA-Z0-9_-]{11}$`) for parameters like IDs used in API calls. Never expose raw error strings or stack traces to the caller.
