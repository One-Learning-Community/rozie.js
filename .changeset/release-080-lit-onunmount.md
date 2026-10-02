---
"@rozie/core": patch
"@rozie-ui/combobox-lit": patch
"@rozie-ui/command-palette-lit": patch
"@rozie-ui/data-table-lit": patch
"@rozie-ui/toast-lit": patch
---

Lit: a standalone `$onUnmount(() => { … })` now runs when the element is removed. The Lit emitter spliced the callback into `disconnectedCallback` as an uncalled arrow, so the teardown never ran on Lit (the other five targets were unaffected, as was an `$onMount` cleanup return or an `$onUnmount` paired with an `$onMount(fn)`). The body now runs as its own function, so an early `return` in it cannot skip the remaining teardown.

Leaves regenerated with the fix: `combobox-lit` now tears down its list virtualizer on removal, `command-palette-lit` clears its pending search debounce timer, `data-table-lit` removes its document `pointerdown` listener, and `toast-lit` stops its auto-dismiss timers (which could otherwise fire against a removed element).
