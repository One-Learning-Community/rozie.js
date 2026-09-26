---
"@rozie-ui/toast-svelte": patch
---

Fixed two pre-release defects in the `action`/`data` API above before its first publish:
- An action's `onClick` that threw an error used to leave its toast stuck forever (the
  dismiss never ran). `runAction` now dismisses with reason `'action'` in a `finally` block —
  the dismiss always happens, and the error itself still propagates (never silently
  swallowed).
- The auto-dismiss timer now pauses on keyboard focus, not just pointer hover: tabbing to a
  toast's action (or close) button pauses it with the same exact-remainder precision as
  hover, so a keyboard user reading or acting on a toast never loses it to the timeout
  mid-interaction (WCAG 2.2.1). Hover-pause and focus-pause compose — leaving one does not
  resume the timer while the other is still active — and this is unconditional, not gated by
  `disablePauseOnHover`.
