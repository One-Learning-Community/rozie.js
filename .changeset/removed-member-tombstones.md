---
"@rozie/core": minor
---

Removed-member tombstones: a `<props>` or `<emits>` entry can now be `name: { removed: '<message>' }` to keep a removed or renamed member visible to typed consumers for a release.

- **React, Solid and Svelte:** the props interface gains the old key typed `never` under a `@deprecated <message>` note (`onChange?: never` on React/Solid, `onchange?: never` on Svelte for a removed `change` event; `oldName?: never` for a removed prop), and the key is left out of the `Omit<…>` native-attributes base. Before this, a removed event's handler on a component with attribute fallthrough type-checked as the native DOM handler (`<Popover onChange>`) and never fired. The `.d.rozie.ts` sidecar carries the same members.
- **No runtime presence** on any target: no event, output, prop, input or property is generated for a tombstone. Vue, Angular and Lit output is unchanged.
- **ROZ158** (error): the component itself `$emit`s a removed event, or reads or writes `$props.x` / `$model.x` of a removed prop. **ROZ159** (error): a tombstone is not exactly `{ removed: '<non-empty message>' }`. A removed event is not reported as declared-but-never-emitted (ROZ152).
- Tombstones are not written to `rozie-manifest.json` (schema stays v2) and don't appear in generated props and events tables.
