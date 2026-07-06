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
## 2024-07-02 - Cache stampede prevention in local ML router

**Learning:** When dealing with asynchronous CPU-heavy operations like local ML inferences (via transformers.js), caching the resolved output is often not enough to prevent redundant work. Concurrent rapid requests for identical inputs will all bypass a stale cache, triggering parallel executions and blocking the main thread.
**Action:** Next time you implement a cache for an expensive async operation, cache the `Promise` itself immediately, rather than waiting for the final resolution. Ensure the promise is evicted from the cache upon rejection to allow for retries.
## 2024-07-03 - Extension Storage Caching
**Learning:** Repeated asynchronous IPC calls to `chrome.storage.local.get` in high-frequency functions (like message listeners in background scripts) can cause severe storage I/O bottlenecks and lag.
**Action:** Cache the settings promise in-memory and maintain cache coherence using `chrome.storage.onChanged.addListener` to eliminate redundant storage reads.

## 2024-07-04 - IPC Message Passing Cache
**Learning:** Sending the same text to the background script multiple times via `chrome.runtime.sendMessage` from a `MutationObserver` callback causes severe network overhead and potential race conditions ("thundering herd" problem), slowing down the main thread. Caching just the text is dangerous if the context (e.g., title vs comment) matters to the background script.
**Action:** When caching IPC promises in content scripts, always ensure the cache key contains the necessary contextual prefix (e.g., `t:${text}` or `c:${text}`) to avoid collisions. Limit the cache size to avoid memory leaks, remove promises if they reject to allow retries, and clear the cache completely when local settings change to avoid stale evaluations.
