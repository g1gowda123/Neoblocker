## 2026-06-13 - Debounced MutationObserver for YouTube UI
**Learning:** Calling `document.querySelectorAll` continuously via a `MutationObserver` without debouncing leads to severe main thread blocking and performance issues in heavily dynamic applications like YouTube.
**Action:** Always debounce DOM querying mechanisms attached to generic mutation observers with a 100ms or appropriate timeout window to batch events together, preventing excessive DOM traversals.

## 2026-06-16 - Settings Parsing in DOM Observers
**Learning:** Parsing comma-separated string settings into arrays inside a high-frequency DOM `MutationObserver` loop causes unnecessary string allocations and CPU thrashing.
**Action:** Always pre-parse configuration strings into arrays once and cache them. Update the cache only when the raw string configuration changes.

## 2026-06-25 - Querying unparsed elements
**Learning:** Using JS logic in a hot loop over every single element matching a broad selector is very slow. CSS is processed in native C++, which makes pseudo-selectors incredibly fast compared to JS array filtering.
**Action:** Append `:not([data-neoblocker-blocked="true"]):not([data-neoblocker-revealed="true"])` to any `querySelectorAll` queries targeting unprocessed items to offload the filtering work directly to the browser.
