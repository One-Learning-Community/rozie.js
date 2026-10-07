# @rozie-ui/chartjs-svelte

## 0.1.7

### Patch Changes

- c362398: The npm package now includes `CHANGELOG.md`. It was written for every release but left out of the tarball, because npm no longer adds a changelog by itself, so a behaviour change recorded there (such as the 0.7.0 combobox Ctrl/Cmd/Alt+Enter change) was invisible to anyone reading the installed package.
- Updated dependencies [c362398]
  - @rozie/runtime-svelte@0.9.0

## 0.1.6

### Patch Changes

- a9d67cb: Typed public surface, phase 1: a component can now declare real TypeScript types for its events, slot parameters and imperative handle, and a consumer on any target sees them instead of `any`. See the new guide, "Typed public surface".

  Four opt-in authoring features (a component that uses none of them compiles exactly as before; all are types-only, with no runtime change on any target):
  - `<types>` block: type-only statements (`import type`, `interface`, `type`, and `export` of those) hoisted into every target and re-exported from the package entry. Anything else is an error (ROZ019, ROZ020). A `<types>` import that clashes with a `<script>` import is ROZ024; an identical duplicate is dropped silently. A `<types>` name that collides with a generated name (`<Name>Props`, `<Name>Handle`, `Rozie<Name>EventMap`, slot context interfaces, …), with a name the compiled module imports (a `<components>` key, its `<Local>Handle`, or a framework / `@rozie/runtime-*` import such as `ReactNode` or `TemplateRef`, reserved on every target), or with a top-level `<script>` declaration is ROZ025.
  - `<emits>` block: `{ name: { payload?: '<type>', docs?: {...} } }`. When present it is the complete list: an undeclared `$emit` is an error (ROZ151), reported at the `$emit` call, and a declared event that is never emitted is a warning (ROZ152), reported at its `<emits>` entry. A `$emit` whose argument count does not match the declared payload is a warning (ROZ157), reported at the call. Invalid entries (including a repeated event name or `payload`/`docs` key), types and docs are ROZ021, ROZ022 and ROZ023. React and Solid get `onX?: (payload: P) => void`, Vue a typed `defineEmits`, Svelte a lowercase `onx` callback, Angular `output<P>()`, and Lit a `CustomEvent<P>` with a generated `Rozie<Name>EventMap` and typed `addEventListener`/`removeEventListener` overloads.
  - `<slot :param-types="{ row: 'Row' }">` types a slot parameter (unknown key ROZ153, malformed value ROZ154).
  - `$expose(verbs, signatures)`: a compile-time-only second argument typing the handle (unknown verb ROZ155, malformed ROZ156). The signature strings are stripped from every emitted module. A verb without a signature keeps its implementation's own types when it has them (a return-type annotation or an annotated `const`, in `<script lang="ts">`) on every target; only a fully untyped verb is `(...args: any[]) => any`.

  Also in this release:
  - The component manifest (`rozie-manifest.json`) is schema v2 and carries emit payloads, expose signatures, the `<types>` text and slot `:param-types`. The reader still accepts v1, so composing an already-published v1 package keeps working. Composing a package whose leaves ship a v2 manifest (`@rozie-ui/popover`, `@rozie-ui/combobox`, …) from your own `.rozie` requires `@rozie/*` at or above this release; a compiler that is too old now says so in ROZ988 (upgrade the toolchain) instead of advising a reinstall of the primitive.
  - `.d.rozie.ts` sidecars now carry `<types>` and type slots and events exactly as each compiled module does. Apart from `<types>`, these changes apply to every component, not only to ones that use the new features: Solid `<slot>Slot` props and JSX.Element shapes; Svelte Snippet shapes and lowercase handler names; no spurious `render<X>` props on Vue, Angular and Lit (Lit declares its slot receivers on the element class instead); no `on<X>` props on Lit; and on Angular, every component with events loses its spurious `on<Event>` props, and the declared class gets typed `OutputEmitterRef<T>` outputs from the same derivation as the compiled `output()` fields (`T` is the declared payload, otherwise `void`, or `unknown` when an untyped `$emit` passes a payload). The `<Name>Handle` of an `$expose` component now keeps the type of a verb declared as an annotated `const` (`const add: AddFn = …`) instead of `(...args: any[]) => any` (or the implementation's own signature). A Solid scoped default slot now accepts a function child.
  - Text such as `<script`, `<style`, `<title` or `<textarea` inside a `<types>`, `<emits>`, `<props>`, `<data>`, `<listeners>` or `<components>` body (in a comment, a docs string, or a generic like `Array<Style>`) no longer desynchronises the block splitter. Those bodies are now opaque to the HTML tokenizer.

  Untyped-handler convergence (the one planned typing change for components that do not opt in; the sidecar fixes above reach them too): an untyped event handler is now `(...args: any[]) => void` on every target. The shared `.d.ts` sidecar, Solid and Svelte used to emit `unknown[]`, which rejected handlers written with a concrete parameter type; React already used `any[]`. The generated sources of the Solid and Svelte leaves (and the React `.d.ts`) change accordingly, hence the patch bumps. `@rozie-ui/sortable-list-solid` and `@rozie-ui/switch-solid` also pick up the scoped-default-slot function-child fix.

  `@rozie-ui/popover-*` and `@rozie-ui/fullcalendar-*` adopt the features and are bumped minor, because typed events can reject a previously accepted wrong-typed handler:
  - popover: the `anchor` slot context is typed (including the new `panelId: string`) and the handle (`show`, `hide`, `toggle`, `reposition`) is typed. Its open state's change event is the `open` model's (Lit: `open-change`, now in `RoziePopoverEventMap` as `CustomEvent<boolean>`).
  - fullcalendar: 11 typed events (for example `eventClick` with `jsEvent: MouseEvent | KeyboardEvent`, and `unselect` with `jsEvent: UIEvent | null`), 10 typed portal slot arguments and 16 typed handle verbs. The `<types>` names are re-exported from every package entry, and the package barrels re-export the handle types and Lit event maps.
  - Both families generate their README event tables from `<emits>` and no longer ship `scripts/event-manifest.mjs`.
  - @rozie/runtime-svelte@0.8.0

## 0.1.5

### Patch Changes

- ba42bc2: On React, Angular, and Lit, the synthesized `$portals` closure now lives at COMPONENT scope
  (React: the hook section; Angular/Lit: a private class field) instead of being declared
  inside the mount-phase lifecycle hook body. Vue, Svelte, and Solid already did the right
  thing and are unaffected in shape (Vue/Svelte additionally now declare the closure BEFORE
  the user script, matching Solid, closing a secondary TDZ hazard for a top-level invocation).

  This closes a silent parity bug: a `<script>` top-level helper reading `$portals.<name>`
  previously compiled on three targets and failed on the other three — `TS2304 Cannot find
name 'portals'` on the bundled-leaf strict typecheck, `ReferenceError: portals is not
defined` at runtime, with zero diagnostics. Three failure shapes are fixed:
  1. A top-level helper reading `$portals.<name>`, called from `$onMount`.
  2. A top-level helper reading `$portals.<name>`, with NO `$onMount` at all — previously
     the whole closure was emitted NOWHERE on React (it was attached unconditionally to the
     first mount-phase hook; no hook meant it was silently dropped).
  3. A `$portals.<name>` read from a `$watch` body — broken on all three targets, and the
     shape driving most of the corpus workarounds this closes the door on.

  React additionally synthesizes a dispose-only effect (`[]` deps) for a component that has
  portals but no mount-phase lifecycle hook at all, so portal roots still bulk-dispose on
  unmount in that shape. Angular and Lit now lower `$portals.<name>` to a `this.`-qualified
  member read (the closure is a class field, not a same-method-only `const`); the
  reactive-handle `interface ReactivePortalHandle` moved to module scope on both (a TS
  `interface` cannot live inside a class body).

  A new diagnostic, ROZ149, now flags a `$portals.<name>` reference genuinely evaluated
  during setup/render — `<script>` Program top level, a `$computed` body, a `$watch` GETTER,
  or a template binding/directive/`r-for`-iterable/interpolation — since the portal anchor
  does not exist yet at those positions on any target, even after this fix. It does NOT fire
  on an ordinary function/arrow body (the shape this fix makes correct), `$onMount` /
  `$onUnmount` / `$onUpdate` bodies, a `$watch` CALLBACK, or event handlers.

  `.rozie` authors do not need to change anything for code that already calls `$portals` from
  inside `$onMount` — a hook-scope const / class field is visible from the method that used to
  declare it, so nothing that compiled before stops compiling. Emitted output is NOT
  byte-identical for any component with a portal slot — the closure text moves and, on
  Angular/Lit, gains a `this.` qualifier — so `@rozie-ui/chartjs`, `@rozie-ui/codemirror`,
  `@rozie-ui/fullcalendar`, `@rozie-ui/maplibre`, and `@rozie-ui/rete` (the shipped leaf
  packages whose `.rozie` sources declare a portal slot) take a patch bump alongside
  `@rozie/core`.

  The workaround bridges those five packages carry to route `$portals` calls into mount scope
  (null-let bridges, a "must not be called before mount" invariant, a relocated code block)
  are now unnecessary and can be unwound at leisure as an independent, opt-in follow-up — not
  part of this change.

  **Changeset scope note.** The six `@rozie-ui/<family>` umbrella packages are `private: true` and the repo sets `privatePackages.version: false`, so listing them alone versions nothing. The published, consumer-installed artifacts are the per-framework pre-compiled leaves (`@rozie-ui/<family>-<target>`), and they carry no dependency on `@rozie/core` — a core bump does not cascade to them. Since this change rewrites their emitted source, they are bumped explicitly. `@rozie-ui/maplibre-*` is omitted deliberately: those leaves are in the changeset config's `ignore` list. `-solid` leaves are omitted because Solid already emitted the closure at component scope and its output is unchanged.

  **Why no `@rozie-ui/<family>` umbrella entries.** Those six packages are `private: true`, so changesets treats them as ignored; a changeset that mixes ignored and non-ignored packages is rejected outright (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), failing `changeset status` and any release run. Only the published, consumer-installed per-framework leaves are listed.

- eb280c9: No API change. Internal helpers that read `$portals.<name>` now live at component scope
  instead of inside the mount-phase lifecycle hook, now that quick 260829-cd4 hoists the
  emitter-synthesized `$portals` closure to component scope on all six targets.

  This unwinds the `$portals` mount-scope workarounds in three shipped `@rozie-ui`
  components (of the five originally targeted — see the CodeMirror note below) carried
  before that emitter fix landed:
  - **`@rozie-ui/tiptap`** — `makeNodeView`/`makeNodeViewExtensions` read `$portals.nodeView`
    directly instead of taking it as an injected parameter.
  - **`@rozie-ui/rete`** (`NodeType`) — the `#body` portal-mount closure is a top-level
    function instead of a null-let bridge assigned inside `$onMount`.
  - **`@rozie-ui/chartjs`** (and its 8 per-type variants, generated from the same source) —
    `buildConfig` and its click/hover/tooltip helpers are top-level; `$onMount` now only
    captures the canvas ref, constructs the `Chart` instance, and tears it down.

  `@rozie-ui/maplibre`'s per-framework leaves are changesets-ignored (deliberately
  unpublished) even though the marker/popup/interactive-layer reconcile unwind landed and
  is included in the source diff — no leaf version bump applies.

  `@rozie-ui/rete`'s sibling `FlowCanvas` component was investigated and found
  correct-by-design (its reconcilers are rooted in a `$refs` read that must stay
  `$onMount`-scoped under ROZ123) — only its stale comment was corrected, no behavior change.

  **`@rozie-ui/codemirror` REVERTED, not shipped.** The relocation was implemented, gated
  green (build/test/typecheck), and committed, but the full Docker VR union caught a
  React-only regression it introduced: the CM6 `Compartment` instances (`themeCompartment`
  et al.) lost their `useMemo(() => new Compartment(), [])` wrapping and became a
  per-render `new Compartment()` once `buildState` (which reads them) moved out of
  `$onMount` to a top-level `useCallback` — an emitter memoization-heuristic gap, not a
  `.rozie`-source-fixable issue (SCOPE FENCE: no emitter code changed in this quick). Two
  React `code-mirror.spec.ts` tests failed (theme-toggle class never changing; an
  extensions-toggle readOnly reconfigure never taking effect) while all five other targets
  stayed green. The commit was reverted; CodeMirror.rozie and its six leaves are unchanged
  from `main` before this quick. Recorded as a follow-up for the emitter team, not
  worked around here.

  Several stale comments across the touched files claimed `$emit` and/or `$slots` also
  forced mount scope. Neither ever did, on any target — those comments are corrected too.

  No emitter code changed in this patch. `@rozie/core` is not bumped.

  **Why no `@rozie-ui/<family>` umbrella entries.** Those six packages are `private: true`, so changesets treats them as ignored; a changeset that mixes ignored and non-ignored packages is rejected outright (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), failing `changeset status` and any release run. Only the published, consumer-installed per-framework leaves are listed.
  - @rozie/runtime-svelte@0.7.0

## 0.1.4

### Patch Changes

- @rozie/runtime-svelte@0.6.0

## 0.1.3

### Patch Changes

- Debut release of `@rozie-ui/chartjs` — Rozie's cross-framework port of [Chart.js](https://www.chartjs.org/), the most-used canvas charting library on the web. One `.rozie` source ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit components with no per-framework wrapper boilerplate.

  Each of the six packages exports **nine components**: the generic `Chart` — whose `type` prop switches the chart kind across the whole Chart.js controller set (`line`/`bar`/`pie`/`doughnut`/`radar`/`polarArea`/`scatter`/`bubble`) — plus eight **per-type components** (`Line`, `Bar`, `Pie`, `Doughnut`, `PolarArea`, `Radar`, `Scatter`, `Bubble`), each pinning its own `type` and registering only its own Chart.js controller/element/scale set so importing one is tree-shakable by construction. The compiled React/Solid/Lit packages additionally expose a per-variant deep-import subpath (`@rozie-ui/chartjs-react/line`, etc.) for guaranteed chunk isolation; the source-shipped Vue/Svelte/Angular packages tree-shake per-type imports natively.

  Surface: 11 props (`data`/`options`/`type`/`height`/`width`/`plugins`/`updateMode`/`redraw`/`ariaLabel`/`datasetIdKey`/`destroyDelay`), 3 structured events (`click`/`hover`/`datasetClick`, composed over any consumer-supplied `options.onClick`/`onHover` without clobbering it), a 15-verb imperative handle (lifecycle/redraw verbs plus dataset-visibility, active-element, and metadata verbs — including the marquee `toBase64Image` PNG export), and two slots (a non-portal `fallback` slot for in-canvas a11y content, and an external-HTML `tooltip` portal slot driven by Chart.js's external-tooltip handler). `data` reconciles in place (tweening point-to-point); `type`/`plugins` changes — and `data` changes when `redraw` is set — re-create the instance, since Chart.js has no stable runtime type/plugin-swap.

  Requires the `chart.js` engine (`^4`) as a required peer dependency alongside the framework peer.

  A deep pre-release audit (`.planning/quick/260810-usc-chartjs-debut-shore-up/AUDIT.md`) traced the full surface against all four docs pages and all four VR specs before this release: two DOCS-DRIFT findings were fixed (a stale "auto-registers every controller" claim in `docs/components/chartjs.md` that contradicted both the source and the rest of the same page, and a stale hand-counted `Chart.rozie` header comment), and several COVERAGE-GAP findings were closed by a new family test suite (`packages/ui/chartjs/tests/{surface,sidecars}.test.ts`, replacing the previously test-less `vitest run --passWithNoTests`) and new VR legs exercising the imperative handle and the composed-`onClick` contract. Zero SOURCE-BUG and zero EMITTER-BACKLOG findings — no public surface changed, so this debut ships as a patch.

  The `-vue` leaf ships a JetBrains `web-types.json` and the `-lit` leaf ships a Custom Elements Manifest (`custom-elements.json`), both covering all nine components and both generated by the family codegen from the same lowered IR the READMEs use.

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-svelte@0.2.0
