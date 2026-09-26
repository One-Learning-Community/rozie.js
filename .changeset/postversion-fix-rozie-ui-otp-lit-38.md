---
"@rozie-ui/otp-lit": patch
---

Fixed: the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/otp-lit`, this package's own.
