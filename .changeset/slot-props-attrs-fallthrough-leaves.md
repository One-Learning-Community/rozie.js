---
"@rozie-ui/chartjs-solid": patch
"@rozie-ui/codemirror-solid": patch
"@rozie-ui/combobox-react": patch
"@rozie-ui/combobox-solid": patch
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/data-table-solid": patch
"@rozie-ui/date-picker-react": patch
"@rozie-ui/date-picker-solid": patch
"@rozie-ui/dialog-solid": patch
"@rozie-ui/embla-react": patch
"@rozie-ui/embla-solid": patch
"@rozie-ui/listbox-solid": patch
"@rozie-ui/maplibre-solid": patch
"@rozie-ui/pagination-solid": patch
"@rozie-ui/resizable-solid": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/slider-solid": patch
"@rozie-ui/sortable-list-react": patch
"@rozie-ui/sortable-list-solid": patch
"@rozie-ui/switch-solid": patch
"@rozie-ui/tags-react": patch
"@rozie-ui/tags-solid": patch
---

React and Solid: slot props passed to the component are no longer part of the attribute pass-through spread onto its root element. On Solid a slot render function passed as `<name>Slot` (or a `slots` record) was written to the DOM as an attribute holding the function source; on React the slot members (`render<Name>`, `children`, `slots`) were left in the rest bucket. Regenerated with the compiler fix; no API change.
