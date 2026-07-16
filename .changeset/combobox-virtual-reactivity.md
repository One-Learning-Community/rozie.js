---
"@rozie-ui/combobox-react": minor
"@rozie-ui/combobox-vue": minor
"@rozie-ui/combobox-svelte": minor
"@rozie-ui/combobox-angular": minor
"@rozie-ui/combobox-solid": minor
"@rozie-ui/combobox-lit": minor
---

The `virtual` prop is now **live-flippable at runtime**. Previously the TanStack windowing engine was constructed exactly once in `$onMount`, so a runtime `false→true` flip rendered a blank popup and a `true→false` flip left a live `ResizeObserver` (and stale windowing state) behind.

`buildVirtualizer()`/`teardownVirtualizer()` now share the single construction site `$onMount` also calls, wired to a new lazy watch on `virtual`: flipping to `true` (re)builds the windowing engine (rAF-deferred so the windowed popup has mounted its scroll container first) and resets any expanded-group state; flipping to `false` tears it down immediately, disconnecting the `ResizeObserver` — fixing the leak. During the brief mid-flip frame (virtual on, engine not yet attached) the popup renders the un-windowed full option list rather than going blank.

No prop/model/emit/slot/expose surface change — `virtual` already existed. A `virtual:false` combobox that never flips it, and a `virtual:true`-at-mount combobox that never flips it back, both render byte-identically to before.
