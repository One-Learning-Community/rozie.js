---
"@rozie-ui/combobox-react": patch
"@rozie-ui/data-table-react": patch
---

Regenerated with the React `@change` fix: the combobox text input and the data-table date editor attach the DOM `change` event through their `ref` instead of React's per-keystroke `onChange`. Both components already stopped or ignored that event, so behaviour is unchanged.
