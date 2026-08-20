# @rozie-ui/rete-react

## 0.1.4

### Patch Changes

- @rozie/runtime-react@0.6.0

## 0.1.3

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  Only the **`$emit` handler prop** read kind landed here, across 9 of the graph events: `onConnectEnd`, `onConnectionCreated`, `onConnectionRejected`, `onConnectionRemoved`, `onContextMenu`, `onNodeAction`, `onNodeMoved`, `onNodePicked`, `onTranslated`.

  The rete editor's pipeline handlers are installed once at mount, so before this fix a consumer that changed any of these handlers after the canvas mounted kept the original identity being called for the life of the editor — the classic symptom being a graph callback that closes over the initial node/connection state and never sees later edits.

- **Release note:** `rete` debuted at `0.1.2` from commit `56340d74` earlier on 2026-08-04. This fix landed in `cc9927f8`, immediately after that debut publish, so `0.1.2` shipped without it. `0.1.3` is the first published `rete-react` build that carries the seam.
- No prop read or helper call in this component was affected. No API surface change.
- @rozie/runtime-react@0.2.3

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
