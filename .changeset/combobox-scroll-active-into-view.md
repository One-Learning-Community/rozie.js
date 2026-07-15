---
"@rozie-ui/combobox-react": patch
"@rozie-ui/combobox-vue": patch
"@rozie-ui/combobox-svelte": patch
"@rozie-ui/combobox-angular": patch
"@rozie-ui/combobox-solid": patch
"@rozie-ui/combobox-lit": patch
---

fix: keep the active option scrolled into view during keyboard navigation in non-virtual lists

Arrow-key navigation in a plain (non-`virtual`) popup previously moved
`activeIndex`/`aria-activedescendant` but never scrolled the option list
container, so the active option could walk out of view in a long list
taller than the popup's max-height (visible in `@rozie-ui/command-palette`'s
longer command lists). `scrollActiveIntoView()` now also resolves the active
option element and calls `scrollIntoView({ block: 'nearest' })` on it when
not windowing. The `virtual` (windowed) path is unchanged — it still routes
through the virtualizer's `scrollToIndex`.
