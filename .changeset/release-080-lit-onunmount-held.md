---
"@rozie-ui/dialog-lit": patch
"@rozie-ui/listbox-lit": patch
---

Lit: a standalone `$onUnmount(() => { … })` now runs when the element is removed. The Lit emitter spliced the callback into `disconnectedCallback` as an uncalled arrow, so the teardown never ran on Lit (the other five targets were unaffected, as was an `$onMount` cleanup return or an `$onUnmount` paired with an `$onMount(fn)`). The body now runs as its own function, so an early `return` in it cannot skip the remaining teardown. `listbox-lit` now clears its typeahead timer and tears down its virtualizer on removal; `dialog-lit` releases its scroll lock and returns focus when removed while open.
