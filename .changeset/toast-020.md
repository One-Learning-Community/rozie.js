---
"@rozie-ui/toast-react": minor
"@rozie-ui/toast-vue": minor
"@rozie-ui/toast-svelte": minor
"@rozie-ui/toast-solid": minor
"@rozie-ui/toast-lit": minor
"@rozie-ui/toast-angular": minor
---

A toast can now carry an action and pass-through data, from a dogfooding report: `show()`
whitelisted `id`/`message`/`type`/`duration` and silently dropped everything else, so an "Undo"
toast previously needed the `#toast` slot plus a side map from toast id to action.

- `show({ action: { label, onClick } })` renders an action button in the default toast;
  clicking it calls `onClick({ id, data })` and dismisses with a new dismiss reason, `'action'`.
  An action with no `onClick` function is dropped — no dead button ships.
- `show({ data })` carries any payload through untouched, available in the `#toast` slot's scope
  (`toast.data`), the `dismissed` payload, and the action callback.
- `patch(id, { action, data })` can update both, so a promise-toast can gain its "Undo" action
  once it resolves.
- The action button inherits the toast's own colour, matching every type variant. No new public
  theming token yet.

Purely additive: `dismissed` can now also report reason `'action'`; existing consumers of
`show()`/`patch()` are unaffected.

**Theming — design-system bridges now yield to an ancestor's own tokens, and apply correctly on
Lit.** Same fix as every other themed family in this release — see the `@rozie-ui/data-table`
changeset in this release for the full description of the bridge-scoping defect and its fix.

**Solid packaging.** `@rozie-ui/toast-solid` ships the same compiled-JS-by-default,
JSX-under-the-`solid`-condition packaging shape as every other published Solid leaf this release
— see the dedicated Solid packaging changeset for the full description. No API change.
