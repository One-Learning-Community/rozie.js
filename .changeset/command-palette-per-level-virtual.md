---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

Added a per-level `virtual` (long-list windowing) author-side API, threading three new props — `virtual` (Boolean), `virtualMaxHeight` (String), `virtualEstimateRowHeight` (Number) — onto the vendored combobox's own windowing support. Resolved PER LEVEL, exactly like `defaultItems`/`title`/`placeholder`: the top-level props window the ROOT list, while a navigating item's own `virtual`/`virtualMaxHeight`/`virtualEstimateRowHeight` fields window THAT pushed child level (captured onto its frame at push time). This is unblocked by `@rozie-ui/combobox`'s `virtual` prop now being live-flippable at runtime (see that package's own changeset) — a level pushed with `virtual: true` windows immediately, no remount required.

A virtual level renders **flat**: the vendored combobox's `isGrouped` requires `!virtual`, so auto-derived groups, `groupCap`, and the `groupHeading` slot are inactive for that level. This is honestly bidirectional — popping back to a level whose `virtual` resolves `false` restores its non-windowed (and, if applicable, grouped) render.

Surface grows 15 → 18 props (`virtual`/`virtualMaxHeight`/`virtualEstimateRowHeight`, placed after `appendTo`); models/emits/slots/expose are unchanged. All three props unset is byte-behavior-identical to today (`:virtual="false"`, `:max-height="''"`, `:estimate-row-height="36"`).
