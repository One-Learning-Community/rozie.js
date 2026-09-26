---
"@rozie-ui/slider-solid": patch
---

Fixes a floating-point rounding defect in the `step` quantization math: with a decimal `step` (e.g. `0.1`), committed values could land on a binary-float artifact like `0.30000000000000004` instead of the clean `0.3` a consumer configured — visible in both the two-way `value` and `aria-valuetext`. The result is now rounded to the `step`'s (and `min`'s) own decimal precision.

The README's custom-slot example didn't show the `markSlot`/`bubbleSlot` scoped-slot render props at all; it now includes a worked example for both.
