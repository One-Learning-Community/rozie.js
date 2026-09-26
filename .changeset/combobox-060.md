---
"@rozie-ui/combobox-react": minor
"@rozie-ui/combobox-vue": minor
"@rozie-ui/combobox-svelte": minor
"@rozie-ui/combobox-solid": minor
"@rozie-ui/combobox-lit": minor
"@rozie-ui/combobox-angular": minor
---

Two virtualization correctness fixes, shared with `@rozie-ui/listbox`, plus this release's
theming fix and a token removal.

**Fixed: a virtual list scrolled to the end now actually stays at the end.** With
variable-height options, a scroll-to-end pin was being overwritten mid-`ResizeObserver`-batch by
virtualizer writes computed from a stale offset, and browser scroll anchoring could independently
move `scrollTop` when the leading spacer's height changed — both looked identical to "the user
scrolled away" and cleared the pin. Measured before the fix: the last option was cut off by up to
126px depending on target. Fixed the same way in both hosts.

**Fixed (N-05): the option remeasure sweep now waits for the recycled virtualization window to
actually commit** before handing rendered options to `measureElement`. React and Angular commit
their recycled window one tick later than the other four targets; with variable-height options,
the previous single-`requestAnimationFrame` sweep could measure the *old* window and only catch
up on virtual-core's own 150ms idle tick — visibly moving the list after the user had already
seen it. The sweep now re-checks coverage and re-runs (bounded) until the committed options match
the virtualizer's current window.

**Theming — design-system bridges now yield to an ancestor's own tokens, and apply correctly on
Lit.** Same fix as every other themed family in this release — see the `@rozie-ui/data-table`
changeset in this release for the full description of the bridge-scoping defect and its fix.

**BREAKING (if you set it) — the `--rozie-combobox-list-z` token is removed.** It has had no
effect since the popup moved into the composed `@rozie-ui/popover` leaf (an earlier release):
the popup's stacking is controlled by `--rozie-popover-z` (default `1000`) instead. If you were
setting `--rozie-combobox-list-z` to control the popup's stacking order, set `--rozie-popover-z`
in the same scope instead.

**Solid packaging.** `@rozie-ui/combobox-solid` ships the same compiled-JS-by-default,
JSX-under-the-`solid`-condition packaging shape as every other published Solid leaf this release
— see the dedicated Solid packaging changeset for the full description. No API change.
