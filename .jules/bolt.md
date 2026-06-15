## 2026-06-13 - Debounced MutationObserver for YouTube UI
**Learning:** Calling `document.querySelectorAll` continuously via a `MutationObserver` without debouncing leads to severe main thread blocking and performance issues in heavily dynamic applications like YouTube.
**Action:** Always debounce DOM querying mechanisms attached to generic mutation observers with a 100ms or appropriate timeout window to batch events together, preventing excessive DOM traversals.

## 2026-06-15 - Caching Parsed User Settings for DOM Observer
**Learning:** When accessing configurable user settings (like comma-separated exception lists or banned keywords) inside tight, high-frequency DOM iteration loops (e.g., MutationObservers), pre-parse them into cached arrays exactly once when the settings change. Referencing the pre-parsed arrays directly avoids repeated string allocations and CPU thrashing.
**Action:** Pre-parse configurable strings into cached arrays to eliminate redundant string manipulation operations inside frequent observer callbacks.
