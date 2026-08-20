---
"@rozie/runtime-angular": minor
"@rozie-ui/combobox-angular": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/data-table-angular": patch
"@rozie-ui/date-picker-angular": patch
"@rozie-ui/embla-angular": patch
"@rozie-ui/otp-angular": patch
"@rozie-ui/popover-angular": patch
"@rozie-ui/rete-angular": patch
"@rozie-ui/sortable-list-angular": patch
"@rozie-ui/tags-angular": patch
"@rozie-ui/tiptap-angular": patch
"@rozie-ui/toast-angular": patch
---

`@rozie/runtime-angular` now exports `rozieDisplay`, `rozieAttr`, and `rozieToken`
alongside the existing `RozieSlot` marker directive. The Angular target used to
inline a copy of these three helpers (and, for `rozieToken`, its
`globalThis`-backed cross-package registry) as module-scope declarations in
*every* emitted component that wrapped an interpolation or used the
`$provide`/`$inject` context primitive — duplicating the same ~40 lines across 21
`@rozie-ui/*-angular` leaves. The emitter now imports the helpers from
`@rozie/runtime-angular` instead.

Behavior is unchanged: the delegating `rozieDisplay`/`rozieAttr` class methods
Angular templates call are untouched, `rozieToken`'s `globalThis`-backed identity
guarantee is preserved verbatim, and a component using none of the three continues
to carry no reference to `@rozie/runtime-angular` at all. `number-field` and `otp`
(previously the only two Angular leaves with no existing `@rozie/runtime-angular`
dependency) now declare it in both `package.json` and `ng-package.json`'s
`allowedNonPeerDependencies`.
