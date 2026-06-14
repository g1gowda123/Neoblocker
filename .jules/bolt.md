## 2026-06-13 - Debounced MutationObserver for YouTube UI
**Learning:** Calling `document.querySelectorAll` continuously via a `MutationObserver` without debouncing leads to severe main thread blocking and performance issues in heavily dynamic applications like YouTube.
**Action:** Always debounce DOM querying mechanisms attached to generic mutation observers with a 100ms or appropriate timeout window to batch events together, preventing excessive DOM traversals.
## 2026-06-14 - Pre-parsing settings for MutationObserver loops
**Learning:** Repetitive string operations like `.split(",")` and `.map(...)` inside utility functions called extensively during `MutationObserver` loops (e.g., thousands of times per second on highly dynamic sites like YouTube) can cause significant CPU thrashing and memory allocations.
**Action:** When accessing configurable user settings (like comma-separated exception lists or banned keywords) inside tight DOM iteration loops, pre-parse them into cached arrays exactly once when the settings change, and reference the pre-parsed properties directly during DOM checks.
