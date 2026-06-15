## 2025-02-14 - Replace Regex with Safe Parsing for Embedded JSON extraction
**Vulnerability:** Insecure regex JSON parsing `html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/)` that uses a non-greedy wildcard. An attacker could inject `};` inside a string value (e.g. `{"title": "Hack}; me"}`) in the HTML payload, causing the regex to terminate early and return malformed JSON.
**Learning:** Using regex to extract complex nested structures like JSON from HTML is prone to edge cases where strings contain sequence terminators, potentially causing logic errors or Denial of Service.
**Prevention:** Use a robust, custom brace-matching parsing algorithm that correctly skips escape sequences and string contents to securely extract embedded JSON objects.
