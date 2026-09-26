---
"@rozie-ui/captcha-solid": patch
---

Fixed: the hidden reCAPTCHA v3 container's inline `display: none` now merges with any consumer-supplied `style` (via `parseInlineStyle`) instead of silently discarding it, bringing this leaf in line with the other five targets.
