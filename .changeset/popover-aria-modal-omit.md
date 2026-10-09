---
"@rozie-ui/popover-react": patch
"@rozie-ui/popover-vue": patch
"@rozie-ui/popover-svelte": patch
"@rozie-ui/popover-angular": patch
"@rozie-ui/popover-solid": patch
"@rozie-ui/popover-lit": patch
---

The floating panel no longer carries `aria-modal` unless it is a dialog. `aria-modal` is only valid on `role="dialog"` / `alertdialog`, yet every panel rendered `aria-modal="false"`, including the default role-neutral click popover (also when `bare`, hosting your own `role="dialog"` content) and `role="tooltip"` panels, which axe reports as `aria-allowed-attr`. The attribute is now omitted there. With `modal` set, the panel still renders `role="dialog"` and `aria-modal="true"`.
