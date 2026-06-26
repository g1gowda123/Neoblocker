## 2026-06-13 - Debounced MutationObserver for YouTube UI
**Learning:** Calling `document.querySelectorAll` continuously via a `MutationObserver` without debouncing leads to severe main thread blocking and performance issues in heavily dynamic applications like YouTube.
**Action:** Always debounce DOM querying mechanisms attached to generic mutation observers with a 100ms or appropriate timeout window to batch events together, preventing excessive DOM traversals.
## 2026-06-16 - Settings Parsing in DOM Observers
**Learning:** Parsing comma-separated string settings into arrays inside a high-frequency DOM `MutationObserver` loop causes unnecessary string allocations and CPU thrashing.
**Action:** Always pre-parse configuration strings into arrays once and cache them. Update the cache only when the raw string configuration changes.
## 2026-06-17 - Native CSS Engine Filtering over JS
**Learning:** In a highly dynamic environment like an infinite-scrolling SPA (e.g., YouTube), calling `document.querySelectorAll()` repeatedly returns an ever-growing NodeList. Iterating through thousands of elements in JavaScript to filter out already-processed nodes (e.g., checking `dataset.blocked`) becomes a severe CPU bottleneck.
**Action:** Always offload large-scale element exclusion filtering to the browser's native C++ rendering engine. Instead of iterating in JS, append `:not([data-attr])` pseudo-classes directly to the `querySelectorAll` string. This reduces O(N) JavaScript operations to O(new_elements), yielding massive performance gains.
## 2026-06-26 - High-Frequency Function Array Allocations
**Learning:** Initializing arrays (like static keyword lists) or parsing settings strings (like `exceptions.split(",")`) directly inside high-frequency functions (e.g., `analyzeContent` triggered on every comment/subtitle frame) causes redundant object allocations, CPU thrashing, and unnecessary garbage collection pressure.
**Action:** Always hoist static arrays to module-level scope and cache parsed configuration strings. Only update the cached arrays when the underlying raw configuration string changes.
