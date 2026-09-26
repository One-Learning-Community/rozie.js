---
"@rozie-ui/combobox-react": patch
---

Fixed: the generated README's `## Slots` table listed some slots more than once — once per internal template branch that declares the same logical slot (e.g. the virtualized vs. non-virtualized rendering path). The generator now dedupes by slot identity before rendering. Docs/packaging only; no runtime behavior changed.
