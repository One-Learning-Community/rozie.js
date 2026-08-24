# @rozie-ui/rete-angular

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

- f3266db: `@rozie/runtime-angular` now exports `rozieDisplay`, `rozieAttr`, and `rozieToken`
  alongside the existing `RozieSlot` marker directive. The Angular target used to
  inline a copy of these three helpers (and, for `rozieToken`, its
  `globalThis`-backed cross-package registry) as module-scope declarations in
  _every_ emitted component that wrapped an interpolation or used the
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

- Updated dependencies [f3266db]
- Updated dependencies [78d5b5b]
- Updated dependencies [ae824bd]
  - @rozie/runtime-angular@0.6.0

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/rete` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps. Carries `tslib` only, no `@rozie` runtime dependency.

  **The FlowCanvas family** — a controlled node-graph canvas over the `rete` engine:
  - `<FlowCanvas>` — 21 props, 12 events and a 27-verb imperative handle, with `graph`, `zoom` and `mode` as two-way models. Built-in Controls and MiniMap, labeled + styled edges, undo/redo, auto-arrange (elkjs), marquee select, a node toolbar slot, and the `background` pattern variants (`dots` / `lines` / `cross` / `none`).
  - `<NodeType>` — render-by-type node bodies through a reactive `body` portal slot, with per-type `resizable` plus min/max width and height.
  - `<Port>` — the typed directional port schema (`output` / `input`, `type`, `label`, `multiple`, `position`), declared against the enclosing `<NodeType>`.
  - Four `themes/*.css` token presets ship in the tarball (`base`, `shadcn`, `material`, `bootstrap`).
