---
"@rozie-ui/popover-react": minor
"@rozie-ui/popover-vue": minor
"@rozie-ui/popover-svelte": minor
"@rozie-ui/popover-angular": minor
"@rozie-ui/popover-solid": minor
"@rozie-ui/popover-lit": minor
---

Add a `popupRole` prop for a popover that hosts a menu (or a listbox, tree or grid), from oinbox dogfooding.

- **`popupRole`** (`'dialog'` by default, or `'menu'`, `'listbox'`, `'tree'`, `'grid'`; any other value is treated as `'dialog'`) is the `aria-haspopup` a `click` popover's anchor wrapper announces. It was hardcoded to `"dialog"`, so a menu button had to switch to `trigger="manual"` with its own ARIA and lost the click trigger's focus return.
- **The `anchor` slot passes `popupRole`** alongside `open` and `panelId`, so your own focusable trigger can carry `aria-haspopup` / `aria-expanded` / `aria-controls`. It is `null` for the tooltip triggers (`'hover'` / `'focus'`), which claim no popup. It is typed `PopoverPopupRole | null`, and the new `PopoverPopupRole` union is exported from every package entry, so it binds straight to `aria-haspopup` under strict React and Solid types.

Default popovers are unchanged.
