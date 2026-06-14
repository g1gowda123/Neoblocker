## 2024-06-14 - Fix Regex JSON Extraction Risk
**Vulnerability:** The regex `/ytInitialPlayerResponse\s*=\s*({.+?});/` in `src/background.ts` relies on `.+?` to match a JSON object. This regex terminates matching at the first `};` it encounters. If the JSON payload contains `};` inside a string (e.g. video title or description), the matched substring will be truncated and `JSON.parse()` will throw an error, preventing the extension from successfully scanning the video. While not an RCE or XSS vulnerability by itself, it constitutes a DoS vector/logic flaw whereby an attacker can bypass the extension entirely by including `};` in their video title.

**Learning:** Regex parsing of complex nested structures (like JSON) using non-greedy wildcards is fragile and easily breaks when the terminator sequence appears within strings inside the payload.

**Prevention:** To parse nested braces, consider executing the regex to find the start index of the JSON payload and then walking the string to match braces. Or more simply, since we know `ytInitialPlayerResponse = ` occurs, use a more robust regex or parse it differently.
