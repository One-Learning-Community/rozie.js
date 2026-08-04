# @rozie-ui/rete-react

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/rete` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps.

  **The FlowCanvas family** — a controlled node-graph canvas over the `rete` engine:
  - `<FlowCanvas>` — 21 props, 12 events and a 27-verb imperative handle, with `graph`, `zoom` and `mode` as two-way models. Built-in Controls and MiniMap, labeled + styled edges, undo/redo, auto-arrange (elkjs), marquee select, a node toolbar slot, and the `background` pattern variants (`dots` / `lines` / `cross` / `none`).
  - `<NodeType>` — render-by-type node bodies through a reactive `body` portal slot, with per-type `resizable` plus min/max width and height.
  - `<Port>` — the typed directional port schema (`output` / `input`, `type`, `label`, `multiple`, `position`), declared against the enclosing `<NodeType>`.
  - Four `themes/*.css` token presets ship in the tarball (`base`, `shadcn`, `material`, `bootstrap`).

  `readonly` / `pannable` / `zoomable` / `selectable` / `snapGrid` are runtime-reactive, and `$onMount`-scoped prop reads stay live via synced refs (the MiniMap pointer-pan `pannable` fix) — this leaf debuts with that emitter fix already applied.

- @rozie/runtime-react@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-react@0.2.0
