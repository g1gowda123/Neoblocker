## 2026-06-13 - Debounced MutationObserver for YouTube UI
**Learning:** Calling `document.querySelectorAll` continuously via a `MutationObserver` without debouncing leads to severe main thread blocking and performance issues in heavily dynamic applications like YouTube.
**Action:** Always debounce DOM querying mechanisms attached to generic mutation observers with a 100ms or appropriate timeout window to batch events together, preventing excessive DOM traversals.
