## 2024-06-25 - Avoiding Unnecessary Memory Allocations in DOM Observation
**Learning:** In high-frequency execution paths like `MutationObserver` callbacks, creating intermediate objects (like `Set` or using `Array.from()` to cast a `NodeList`) adds significant garbage collection pressure without providing value. The elements returned by `querySelectorAll` are already unique, making a `Set` entirely redundant.
**Action:** Iterate directly over `NodeList` using a traditional `for` loop or `forEach` when querying the DOM in tight loops, and avoid creating extraneous arrays or sets.
