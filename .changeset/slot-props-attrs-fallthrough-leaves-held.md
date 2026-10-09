---
"@rozie-ui/dialog-react": patch
"@rozie-ui/lexical-react": patch
"@rozie-ui/lexical-solid": patch
"@rozie-ui/listbox-react": patch
"@rozie-ui/maplibre-react": patch
"@rozie-ui/pagination-react": patch
"@rozie-ui/resizable-react": patch
"@rozie-ui/slider-react": patch
"@rozie-ui/switch-react": patch
---

React and Solid: slot props passed to the component are no longer part of the attribute pass-through spread onto its root element. On Solid a slot render function passed as `<name>Slot` (or a `slots` record) was written to the DOM as an attribute holding the function source; on React the slot members (`render<Name>`, `children`, `slots`) were left in the rest bucket. Regenerated with the compiler fix; no API change.
