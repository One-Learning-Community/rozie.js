---
"@rozie-ui/combobox-svelte": patch
---

Packaging fixes bundled with this release:
- the generated README's `## Slots` table listed some slots more than once — once per internal template branch that declares the same logical slot (e.g. the virtualized vs. non-virtualized rendering path). The generator now dedupes by slot identity before rendering. Docs/packaging only; no runtime behavior changed.
- the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/combobox-svelte`, this package's own.
