## 2025-06-27 - [SSRF Protection]
**Vulnerability:** The `/verify` endpoint allows arbitrary URLs to be passed to an async web crawler, potentially exposing internal network resources via Server-Side Request Forgery.
**Learning:** Basic SSRF protection by resolving DNS before executing a crawl using a high-level library does not protect against DNS rebinding (TOCTOU attacks) since the crawler itself performs a separate DNS resolution.
**Prevention:** Proper SSRF protection requires either forcing the downstream HTTP client to use the exact validated IP address or doing validation at the socket level. A basic DNS check is a defense-in-depth step, but its limitations must be understood.
