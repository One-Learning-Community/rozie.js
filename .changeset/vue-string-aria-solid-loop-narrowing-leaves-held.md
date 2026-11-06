---
"@rozie-ui/lexical-vue": patch
---

Regenerated with the Vue string-ARIA fix: a nullable value bound to a string ARIA attribute (for example `aria-label`) on an HTML element is emitted with an `undefined` fallback, so a strict TypeScript consumer compiling the component's `.vue` source typechecks. Rendered markup is unchanged.
