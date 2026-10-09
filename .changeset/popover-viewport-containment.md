---
"@rozie-ui/popover-react": patch
"@rozie-ui/popover-vue": patch
"@rozie-ui/popover-svelte": patch
"@rozie-ui/popover-angular": patch
"@rozie-ui/popover-solid": patch
"@rozie-ui/popover-lit": patch
---

A popover placed to the side of its anchor (`left*` / `right*`) now stays inside the viewport on a narrow screen: when neither side has room it falls back to below or above the anchor, and when nothing fits it slides back into view. It used to stay on the side that overflowed least, cut off by the viewport edge; on a 390px-wide screen a `right-start` panel could end with its right edge past 500px. `top*` / `bottom*` placements are positioned exactly as before.

The panel is never wider than the area it is positioned in. Popover measures that width while it tracks the anchor and publishes it on the panel as `--rozie-popover-available-width`; the built-in `max-width` is the smaller of that and `--rozie-popover-max-width`, and a `bare` panel's own content can use the property for its own cap. `disableShift` turns the measured limit off along with the shift.

The panel is now `box-sizing: border-box`, so the `max-width` cap includes its padding and border (a default panel with long content was 26px wider than the cap, wider than a narrow viewport), and a `matchWidth` panel with its own chrome matches the anchor's width exactly.
