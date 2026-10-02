---
"@rozie-ui/popover-react": patch
"@rozie-ui/popover-vue": patch
"@rozie-ui/popover-svelte": patch
"@rozie-ui/popover-angular": patch
"@rozie-ui/popover-solid": patch
"@rozie-ui/popover-lit": patch
---

`onChange` is now typed `never` with a @deprecated note pointing at `onOpenChange`; it used to type-check as the native change handler and never fire. The `change` event was removed in 0.3.0, but `PopoverProps` extends the root `<div>`'s HTML attributes, so `<Popover onChange={…}>` still compiled as the DOM `change` handler. React and Solid now reject it with the note, and so does Svelte for `onchange` (use `bind:open`). Vue, Angular and Lit are unchanged; they get a version bump only.
