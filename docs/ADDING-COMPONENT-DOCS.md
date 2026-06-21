# Adding docs for a new `@rozie-ui` component family

The docs counterpart to [`packages/ui/ADDING-A-FAMILY.md`](../packages/ui/ADDING-A-FAMILY.md). Every family gets a **four-file doc set** plus **four registration points**. Miss a registration point and the page exists but is unreachable (no broken build — just orphaned), so use the checklist at the bottom.

`<slug>` = the family dir name (e.g. `captcha`); `<Name>` = the component (e.g. `Captcha`).

---

## The four-file doc set (`docs/components/`)

| File | Authored | Notes |
| --- | --- | --- |
| `<slug>.md` | **by hand** | Showcase + API. Contains the `### Props` table that codegen **validates against the IR** — see below. |
| `<slug>-comparison.md` | **by hand** | vs the per-framework / per-provider libraries it replaces. |
| `<slug>-demo.md` | **by hand** | `<ClientOnly>` live demo importing the real `-vue` package. |
| `<slug>-usage.md` | **AUTO-GENERATED** — do NOT hand-write | Emitted by `docs/scripts/gen-usage-pages.mjs` from the family's `scripts/readme.mjs` `USAGE` export. Edits are overwritten. |

### `<slug>.md` — the validated Props table

`scripts/codegen.mjs` runs `validateDocsPropsTable(ir, <slug>.md)` and **throws on drift**, so the table is a hard contract, not prose:

- Must have a `### Props` heading; the validator reads rows until the next `#`/`##`/`###`.
- A row is counted only if its **first cell is** `` `name` `` (backticked). The **first three columns must be `Name | Type | Default`** (extra columns — Two-way, Description — are free).
- **Type**: the IR type (e.g. `String`, `Number`, `Object`, `Boolean`, `unknown`) must appear among the doc cell's `|`-split tokens. So `` `String` `` matches, and `` `String \| number` `` also matches `String`.
- **Default** must equal the IR-rendered default *unless* the IR default is `—`:
  - string `'recaptcha'` → `` `"recaptcha"` `` (JSON-quoted), `''` → `` `""` ``
  - `null` → `` `null` ``; number `0` → `` `0` ``; boolean → `` `true` ``/`` `false` ``
  - arrow/object factory `() => ({})` → `` `{}` ``
  - **no default / required** → `—` (the validator skips the default check for these, so any text is allowed — use `—`).
- **Events** and **Imperative handle** tables in the same file are **free prose** — not validated. Still keep them accurate; they mirror `ir.emits` / `ir.expose`.

### `<slug>-demo.md` — live demo

Frontmatter `title:`, then a `<script setup>` importing the **default** export of the `-vue` leaf (`import <Name> from '@rozie-ui/<slug>-vue'`). Wrap the widget in `<ClientOnly>`. Prefer **network-free fixtures** (an inline data-URL/sample) so the demo renders in SSR/CI; if the widget is inherently networked (captcha's provider iframe), say so in a `::: warning` and use the provider's always-pass **test key**. For construction-time props, drive a re-mount with `:key` (the documented retune idiom).

## The four registration points

1. **Sidebar nav** — `docs/.vitepress/config.ts`: add a `{ text: '@rozie-ui/<slug>', collapsed: true, items: [...] }` block under the `/components/` sidebar with the four links (showcase / usage / comparison / demo). Place it near sibling families.
2. **Component index table** — `docs/components/index.md`: add a `| **<Name>** | <wraps> | [/components/<slug>](/components/<slug>) |` row under the right category heading (Editors / Dates / Charts / Media / Security & forms / Headless). Add a new category section if none fits.
3. **Landing-page list** — `docs/index.md`: append `· [<Name>](/components/<slug>)` to the matching bucket (Engine-backed / Hosted widgets / No-engine pure Rozie).
4. **Usage page** — *automatic*: `gen-usage-pages.mjs` does `readdirSync(packages/ui)` and emits `<slug>-usage.md` for every family — **provided** `scripts/readme.mjs` exports a family-specific `USAGE` (and `HANDLE_USAGE`). It **throws** if `USAGE` is missing, so this is also a gate. Nothing to register, but the export must exist.

## Auto behaviors worth knowing

- `gen-usage-pages.mjs` `relatedLinks()` auto-links the comparison and demo pages **iff those files exist** — so create them before relying on the cross-links.
- `displayNameFor()` reads `<Name>` from the generated `packages/react/README.md` line `Idiomatic **react** \`<Name>\``; falls back to the slug. So run codegen (which renders that README) before generating usage pages.
- The usage page carries a `GENERATED … do not edit by hand` banner — respect it; edit `readme.mjs` and re-run.

## Building the docs locally

`docs:build` is **OOM-prone** — Rollup graphs every demo engine at once (~5GB peak). Use the shipped `--max-old-space-size=6144` flag (already wired); do not re-attempt lazy-loading or CDN-externalizing the demos (both measured no-ops / rejected). The demo + usage pages only resolve once the family's `-vue` (and other) leaves are built.

## Checklist

- [ ] `<slug>.md` — showcase with an **IR-exact `### Props` table** (codegen validates it).
- [ ] `<slug>-comparison.md`.
- [ ] `<slug>-demo.md` — `<ClientOnly>` + `-vue` package, network-free fixture or test-key warning.
- [ ] `scripts/readme.mjs` exports family-specific `USAGE` / `HANDLE_USAGE` (→ usage page auto-generates).
- [ ] Nav block in `.vitepress/config.ts`.
- [ ] Row in `docs/components/index.md`.
- [ ] Link in `docs/index.md`.
- [ ] `pnpm --filter @rozie-ui/<slug> build` passes (codegen + docs Props-table validation).
