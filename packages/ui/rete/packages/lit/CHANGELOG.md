# @rozie-ui/rete-lit

## 0.1.4

### Patch Changes

- 5fe5876: `<FlowCanvas>` no longer ships the auto-arrange engine to consumers who never arrange.

  `rete-auto-arrange-plugin` and `elkjs` have always been declared optional peers, but the
  import was static and the plugin was constructed at mount, so `elk.bundled.js` — 1.5 MB of
  GWT-transpiled Java in one opaque non-tree-shakeable blob — was resolved into the main chunk
  of every `<FlowCanvas>` consumer. Optional to install is not the same as optional to ship.

  `autoArrange()` now loads the engine with a dynamic import on its first call and reuses it
  afterwards. No API change: the verb was already `async` and already a no-op before mount.

  What changes for you:
  - If you never call `autoArrange()`, the engine and its elkjs payload never enter your bundle.
  - If you do, the first call additionally pays a chunk fetch; later calls are as before.
  - If the optional peers are not installed, the returned promise now rejects instead of silently
    doing nothing — you asked to arrange, so a rejection is the honest answer.

  Also fixed alongside it: the teardown now nulls the area handle after destroying it. Every
  imperative verb already opened with an `if (!area) return` guard, but that only ever caught
  the before-mount window — after unmount the handle stayed truthy and pointed at a destroyed
  scope. Calling a verb on an unmounted canvas is now the no-op the guards always implied.

## 0.1.3

### Patch Changes

- @rozie/runtime-lit@0.6.0

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/rete` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps.

  **The FlowCanvas family** — a controlled node-graph canvas over the `rete` engine:
  - `<FlowCanvas>` — 21 props, 12 events and a 27-verb imperative handle, with `graph`, `zoom` and `mode` as two-way models. Built-in Controls and MiniMap, labeled + styled edges, undo/redo, auto-arrange (elkjs), marquee select, a node toolbar slot, and the `background` pattern variants (`dots` / `lines` / `cross` / `none`).
  - `<NodeType>` — render-by-type node bodies through a reactive `body` portal slot, with per-type `resizable` plus min/max width and height.
  - `<Port>` — the typed directional port schema (`output` / `input`, `type`, `label`, `multiple`, `position`), declared against the enclosing `<NodeType>`.
  - Four `themes/*.css` token presets ship in the tarball (`base`, `shadcn`, `material`, `bootstrap`).

  Ships a Custom Elements Manifest (`custom-elements.json`, `customElements` package.json field) covering `<rozie-flow-canvas>`, `<rozie-node-type>` and `<rozie-port>` — read by both VS Code (lit-plugin) and JetBrains.

- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
