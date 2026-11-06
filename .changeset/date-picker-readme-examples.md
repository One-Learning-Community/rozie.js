---
"@rozie-ui/date-picker-react": patch
"@rozie-ui/date-picker-vue": patch
"@rozie-ui/date-picker-svelte": patch
"@rozie-ui/date-picker-angular": patch
"@rozie-ui/date-picker-solid": patch
"@rozie-ui/date-picker-lit": patch
---

README fixes: Angular examples use the component's `<rozie-date-picker>` selector (the PascalCase tag they showed fails to compile with NG8001); the Svelte theming import is shown as a TypeScript snippet; the Angular `change` / `rangeComplete` handlers take the `unknown` output payload.
