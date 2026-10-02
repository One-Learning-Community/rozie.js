---
"@rozie-ui/fullcalendar-lit": patch
"@rozie-ui/data-table-lit": patch
---

Regenerated with the union-aware Lit attribute converter. On `<rozie-full-calendar>`, a numeric `height` attribute (`height="600"`) now arrives as the number `600`; on `<rozie-column>`, a numeric `width` attribute (`width="120"`) now arrives as the number `120`. A CSS string such as `height="auto"` or `width="120px"` still arrives as a string. Rendering is unchanged, because both components already treated a numeric string as pixels.
