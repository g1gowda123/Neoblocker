## 2024-05-19 - Parsed Settings Caching & MutationObserver Throttling
**Learning:** In highly dynamic SPAs like YouTube, running expensive operations (like `String.split` on settings and unthrottled `document.querySelectorAll` within a `MutationObserver`) causes significant CPU overhead and layout thrashing.
**Action:** Always parse/cache user settings when they change, rather than on every invocation. Use `requestAnimationFrame` or `setTimeout` to debounce/throttle `MutationObserver` callbacks in content scripts that query the DOM extensively.
