---
"@rozie-ui/resizable-solid": patch
---

Adds an `ariaLabel` prop (default `"Resize panels"`) to the `role="separator"` handle, which previously had no accessible name — a screen reader announced it as just "separator" with no indication of what it resizes. `aria-valuenow` now reflects the clamped size instead of the raw, possibly out-of-range `size` prop.

Also fixes the README's custom-slot example, which showed React's `renderStart`/`renderEnd` render-prop names for the Solid tab too; Solid's actual props for the `start`/`end`/`handle` slots are `startSlot`/`endSlot`/`handleSlot` (plain JSX-element props, not render functions).
