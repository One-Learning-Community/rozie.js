# Command palette — comparison

The "⌘K" command palette is a staple of modern apps (VS Code, Linear, Raycast, GitHub), and there is a good per-framework library for *most* frameworks — but each is a separate dependency with its own API, and several frameworks are left out entirely. `@rozie-ui/command-palette` ships the same headless, accessible behavior to all six from one source.

## What it replaces

| Framework | Typical library | Notes |
| --- | --- | --- |
| React | [`cmdk`](https://cmdk.paco.me/) | The de-facto React command menu (used by shadcn/ui's `Command`). React-only. |
| Vue | [`vue-command-palette`](https://github.com/xiaoluoboding/vue-command-palette) | A community port of cmdk's ideas. Vue-only. |
| Svelte | [`cmdk-sv`](https://cmdk-sv.com/) | A community Svelte port. Svelte-only. |
| Solid | [`solid-cmdk`](https://github.com/) / hand-rolled | Sparse; often hand-rolled. |
| Angular | [`ngx-command-palette`](https://www.npmjs.com/) / CDK `Dialog` + `Listbox` | No dominant option; usually assembled from Angular CDK primitives. |
| Lit / web components | *(effectively none)* | No maintained headless command palette for Lit. |

Each is a distinct package with its own props, slots, and accessibility quality. A design system that ships React **and** Vue **and** Angular wrappers maintains three different command-menu integrations that must stay behaviorally in lockstep — exactly the cross-framework duplication Rozie exists to eliminate.

## What `@rozie-ui/command-palette` gives you instead

- **One source, six idiomatic packages.** `CommandPalette.rozie` compiles to `@rozie-ui/command-palette-{react,vue,svelte,angular,solid,lit}`. Install only your framework's.
- **The same accessibility everywhere.** `role="dialog"` overlay, `role="combobox"` search field, `role="listbox"` / `role="option"` results, `aria-activedescendant` roving highlight, Enter-to-select, Escape/backdrop to dismiss — authored once, identical across targets.
- **Idiomatic two-way state.** `r-model:open` / `v-model:open` / `bind:open` / `[(open)]` and the same for `query` — no per-framework controlled/uncontrolled glue.
- **Token-themed.** Every visual value is a `--rozie-command-palette-*` custom property; shadcn/Material/Bootstrap bridges ship in the box.
- **A web-component build.** The Lit leaf gives plain HTML / web-component consumers a real `<rozie-command-palette>` element — a tier that has essentially no off-the-shelf option today.

## What it deliberately does not do (v1)

- **It is not a fuzzy-ranking search engine.** The filter is a case-insensitive substring match over `label` + `keywords`, preserving source order. For fuzzy ranking (fzf-style), pre-rank your `items` and feed the ordered list in (the `query` model + a `select` handler give you the hook); a scoring engine is out of scope for a headless primitive.
- **It does not own a global keyboard shortcut.** Bind ⌘K / Ctrl-K yourself and call `show()` (or set the `open` model) — the palette stays unopinionated about how it is summoned.
- **It does not group rows under headings automatically.** Items carry an optional `group` field surfaced per-row (and in the `item` slot scope); rendering sticky group headers is left to the consumer via the `item` slot.
