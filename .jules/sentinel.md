## 2024-05-18 - [Secure JSON Parsing in HTML]
**Vulnerability:** [Non-greedy regex matching `({.+?})` for parsing nested JSON strings can easily be bypassed or truncated by attackers injecting the terminating sequence `};` inside a string payload.]
**Learning:** [Using regex to extract nested JSON object is insecure because regex isn't capable of safely counting nested structures or distinguishing string payloads from object bounds.]
**Prevention:** [Implement a brace-matching parser function that correctly tracks brace depth and string boundaries, ignoring `{` or `}` characters found within escaped sequences or string enclosures.]
