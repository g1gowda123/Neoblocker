## 2024-05-15 - Module-Level Caching for Analysis Options
**Learning:** Parsing comma-separated user configuration lists (like exceptions) and defining static arrays (like explicit hate keywords) locally inside a highly recurrent function (e.g., `analyzeContent`) leads to redundant string splitting and memory thrashing when the function is called on large numbers of DOM elements.
**Action:** Always pre-parse such settings exactly once, either when updated or via global/module-scoped variables. Store simple static string arrays at module-level to avoid redefining and garbage collecting on every loop.

## 2024-05-20 - Redundant Allocations in High-Frequency DOM Operations
**Learning:** Operations within a fast-firing debounced MutationObserver are extremely sensitive to garbage collection (GC) overhead. Constructing temporary  instances via  to iterate , or passing  results into a  for deduplication (which is unnecessary as  guarantees unique elements), creates immense GC thrashing on pages like YouTube.
**Action:** Avoid intermediate object/array allocations in hot paths entirely. Iterate over  instances directly using standard  loops or .

## 2024-06-30 - Redundant Allocations in High-Frequency DOM Operations
**Learning:** Operations within a fast-firing debounced MutationObserver are extremely sensitive to garbage collection (GC) overhead. Constructing temporary `Array` instances via `Array.from()` to iterate `NodeLists`, or passing `document.querySelectorAll()` results into a `Set` for deduplication (which is unnecessary as `querySelectorAll` guarantees unique elements), creates immense GC thrashing on pages like YouTube.
**Action:** Avoid intermediate object/array allocations in hot paths entirely. Iterate over `NodeList` instances directly using standard `for` loops or `.forEach()`.

## 2026-07-01 - Portal Overlay Memoization
**Learning:** When using `createPortal` inside a mapped array in React, passing inline arrow functions as callbacks (e.g., `onReveal={() => handleReveal(id)}`) forces every single portal to re-render whenever the parent state changes (like when an item is removed), which causes significant lag when blocking many elements.
**Action:** Always wrap portal components in `React.memo` and use stable references with `useCallback` in the parent to pass down event handlers, keeping the child props purely data-driven.
