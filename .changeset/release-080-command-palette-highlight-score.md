---
"@rozie-ui/command-palette-react": minor
"@rozie-ui/command-palette-vue": minor
"@rozie-ui/command-palette-svelte": minor
"@rozie-ui/command-palette-angular": minor
"@rozie-ui/command-palette-solid": minor
"@rozie-ui/command-palette-lit": minor
---

Two additions for a row that is not an ordinary match, such as a synthetic "Create '…'" row pinned below the results (from oinbox dogfooding):

- **`score` receives the built-in scorer as its third argument:** `(item, query, defaultScore) => number | null`. A hook can now adjust the default ranking instead of reimplementing fuzzy matching: pin a row last with `item.id === 'create' ? -Infinity : defaultScore(item, query)`, or add a recency boost with `const base = defaultScore(item, query); return base === null ? null : base + bonus`. The `query` passed in is trimmed. Existing two-argument hooks are unaffected.
- **An item's `highlight` field overrides the marked characters** in its label. `false` marks none (the default marks the query's first subsequence match in the label, so a `Create 'ea'` row marked letters of "Create"), and an array of `[start, end)` index pairs into `label` marks those instead (clamped to the label; overlapping ranges are merged). The same ranges reach the `#option` slot as `matches`. Items without the field are unchanged.
