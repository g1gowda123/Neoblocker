
## 2024-05-18 - [Robust JSON Parsing over Regex]
**Vulnerability:** Used non-greedy regex `/.+?/` to extract `ytInitialPlayerResponse` JSON from HTML strings. Attackers could bypass this by injecting `};` inside a string (e.g. video title), truncating the JSON and causing a parse failure or Denial of Service.
**Learning:** Regex is not suitable for parsing complex nested structures like JSON, especially when they can contain arbitrary user input that mimics structural delimiters.
**Prevention:** Use a robust, brace-matching algorithmic parser that tracks state (in-string, escaped characters, brace depth) to safely extract nested JSON blocks from larger strings.
