---
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-lit": patch
---

Fix `groupCap` composition with per-row `actions`: the ⌘K / Right-arrow action menu now always anchors to the exact highlighted VISIBLE row — it previously mis-anchored to the uncapped-order neighbour once any section overflowed its cap. Firing the action key on a "+N more" row is now correctly a no-op (it previously could wrongly open a menu). Composes into the already-staged `0.4.0` minor.
