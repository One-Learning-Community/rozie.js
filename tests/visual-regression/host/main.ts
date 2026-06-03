/*
 * Phase 7 Plan 02 — shared host harness logic (D-09 / D-10).
 *
 * This module is the single source of truth for:
 *   1. parsing `?example=<Name>&target=<target>` out of `location.search`
 *   2. the canonical 8-example list (verbatim from tests/dist-parity/parity.test.ts)
 *   3. the kebab-cased `<rozie-*>` custom-element tag per example (for the Lit cell)
 *   4. resolving the chrome-reset `[data-testid="rozie-mount"]` wrapper
 *
 * The six per-target `entry.<target>.ts` files import from here, then perform
 * the framework-specific mount into the wrapper. Routing is by URL query
 * (RESEARCH Pattern 1) — never by build-time switch — so one built artifact
 * per target serves all 8 of that target's cells.
 */

export const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  // Phase 07.2 Plan 06 — ModalConsumer dogfood mount (consumer-side fills).
  'ModalConsumer',
  // Phase 07.2 Plan 06 follow-ups (closed post-Phase 07.3.2.1):
  // standalone demos used by the dynamic-slot-name + lit-scoped-fill-firstpaint
  // specs to exercise runtime behaviors not covered by the matrix screenshots.
  // No canonical examples/<Name>.rozie sibling exists for these — the loader
  // falls through to `examples/demos/<Name>Demo.rozie` only. The tag-naming
  // convention still applies: LIT_TAGS[example] + '-demo' = the demo's tag.
  'DynamicSlotName',
  'LitScopedFillFirstpaint',
  // Spike 003 portal-slot primitive — VR coverage of the runtime mount
  // path. Loader resolves to `examples/demos/PortalListDemo.rozie` (which
  // imports `../PortalList.rozie`); the wrapper instantiates an inline
  // vanilla-JS engine and mounts each row's content through `$portals.item`.
  'PortalList',
  // FullCalendar (added 2026-05-19) — real-third-party-engine portal-slot
  // smoke. Loader resolves to `examples/demos/FullCalendarDemo.rozie`
  // (which imports `../FullCalendar.rozie`). The wrapper boots a real
  // FullCalendar 6.x instance; consumer's `<template #event>` fills mount
  // through `$portals.event` into engine-owned event cells. Validates the
  // portal-slot primitive against a real third-party JS engine,
  // complementing PortalList's synthetic in-line engine coverage.
  'FullCalendar',
  // LineChart (added 2026-05-19) — non-portal engine-wrapper runtime
  // smoke. Loader resolves to `examples/demos/LineChartDemo.rozie`
  // (which imports `../LineChart.rozie`). Validates that the compiler
  // does NOT activate portal machinery when no `<slot portal />` is
  // declared — Chart.js paints to a `<canvas>` the framework never
  // touches. Also exercises the Lit updated() shim on
  // `$watch(() => $props.data, ...)` where data is a
  // `{ labels, datasets: [{ data: [] }] }` ChartData object — a richer
  // all-`$props` getterDep shape than FullCalendar's flat events array.
  'LineChart',
  // CodeMirror (added 2026-05-19) — r-model:value two-way binding
  // through a non-input contenteditable engine. Existing model:true
  // examples in the suite wrap form inputs (Counter, SearchInput,
  // SortableList items). CodeMirror reflects user edits via an
  // `EditorView.updateListener` extension, not a DOM input event —
  // the archetypal engine-mediated two-way case. The demo binds two
  // editors to the same `$data.code` signal, so an edit in one round-
  // trips through the model emit path to the other.
  'CodeMirror',
  // PortalListStyled (added 2026-05-20, quick-task 260520-8iu) — Spike 004
  // string-`:style` + `@portal` VR coverage. Loader resolves to
  // `examples/demos/PortalListStyledDemo.rozie` (which imports
  // `../PortalListStyled.rozie`). The consumer fills the `@portal`-scoped
  // `#item` slot with rows carrying BOTH an object-form `:style` (the
  // `.swatch` color) and a dynamic-string `:style` (the `.row` opacity) —
  // exercising the Part-A string-`:style` lowering visually, and giving the
  // `@portal` primitive its visual/runtime VR coverage to complement the
  // structural dist-parity coverage landed by 260519-vyv.
  'PortalListStyled',
  // Engine-wrapper demos (added 2026-05-20, quick-task 260520-hus) — standing
  // VR coverage for the 6-demo render-confirm sweep. Each loader-resolves to
  // `examples/demos/<Name>Demo.rozie` (which imports its canonical sibling
  // `../<Name>.rozie`). SortableList/Flatpickr/TipTap/Uppy + the already-wired
  // Table are baseline-gated screenshot cells in matrix.spec.ts; LeafletMap is
  // behavioral-only (live OSM tiles are non-deterministic — see
  // leaflet-map.spec.ts). All 6 build clean on all 6 targets.
  'SortableList',
  // SortableList family — drag-between (`SortableListPair`) and Kanban-nesting
  // (`SortableListNested`) demos paired with the canonical reorder demo. They
  // exercise SortableList's onAdd/onRemove + module-level transfer slot
  // (cross-list drag) and SortableList composing with itself + the
  // KanbanColumn wrapper (cross-column card drag with reorderable columns).
  'SortableListPair',
  'SortableListNested',
  // SortableList showcase trio (added 2026-05-27, quick-task 260526-uj3) —
  // dedicated marketing surface for the SortableList family.
  // SortableListClone exercises the new `cloneable: true` prop +
  // useSortableJS's onClone stash bridge + handleCommit pullMode='clone'
  // short-circuit (palette → canvas, source stays intact). SortableListFilter
  // exercises the new `filter` pass-through prop with a `[data-locked]`
  // attribute-selector pattern (data-* survives all 6 targets identically).
  // SortableListShowcase is the marquee piece — every prop wired into a
  // live control panel, construction-time knobs (forceFallback/swapThreshold/
  // cloneable) trigger remount via `:key` recomputation.
  'SortableListClone',
  'SortableListFilter',
  'SortableListShowcase',
  'Flatpickr',
  'LeafletMap',
  'TipTap',
  'Uppy',
  'Table',
  // Phase 14 — ThemedButtonConsumer is the dist-parity dogfood for the
  // attribute-fallthrough feature (D-05/D-06). The consumer mounts a
  // ThemedButton (default auto-fallthrough) + ThemedButtonManual
  // (`inherit-attrs="false"` + manual `r-bind="$attrs"`) side by side and
  // forwards id / aria-* / data-* / type / extra class + a `style="--btn-bg: …"`
  // CSS-custom-property override onto each. Wired into the VR matrix here +
  // covered by structural assertions in themed-button.spec.ts (fallthrough
  // attributes on the rendered <button>s; the cross-target class/style merge
  // applied — auto and manual modes produce equivalent DOM).
  'ThemedButtonConsumer',
  // Phase 15 — listener-side sibling wrappers + ROnProbe (D-04 / D-05 / D-07).
  // ThemedButtonListenersManual / ThemedButtonAllManual are PRODUCER fixtures
  // mounted in isolation (no inner consumer). ROnProbe is a single-file probe
  // exercising the literal modifier-bearing `r-on`, dynamic spread, and R6
  // same-event source-order merge codegen across the 6 targets.
  'ThemedButtonListenersManual',
  'ThemedButtonAllManual',
  'ROnProbe',
  // Phase 17 — PartCardConsumer is the `::part()` cross-shadow-DOM dogfood.
  // A multi-rozie consumer (precedent: ThemedButtonConsumer) that embeds
  // <PartCard> via a <components> block and styles the child's `part="body"`
  // shadow element across the boundary with a `PartCard::part(body)` rule.
  // Base example — loader resolves directly to examples/PartCardConsumer.rozie
  // (no demo sibling); its <components> import of PartCard.rozie is resolved
  // by the unplugin at build time. On Lit the styled effect is visible across
  // the shadow boundary; on the 5 non-Lit targets the rule is a no-op.
  'PartCardConsumer',
  // Phase 21 — ExposeProbe is the $expose imperative-handle dogfood. A typed
  // input exposing reset()/focus(); base example, loader resolves directly to
  // examples/ExposeProbe.rozie (no demo sibling). The per-target entry shims
  // grab the native handle (React ref / Vue template ref / Svelte bind:this /
  // Angular viewChild / Solid ref callback / Lit element query) and render a
  // "reset via handle" button — the external-caller harness (D-07) the
  // expose-probe.spec drives to assert the exposed method clears the input.
  'ExposeProbe',
  // Quick 260601-x2p — FlatpickrBehavior is the behavioral-only gap-2/3/4 demo.
  // Loader resolves to examples/demos/FlatpickrBehaviorDemo.rozie (which imports
  // ../../packages/ui/flatpickr/src/Flatpickr.rozie). Built for all 6 targets
  // but NOT a screenshot cell — covered by flatpickr-behavior.spec.ts
  // (structural assertions for :disable / :locale / :plugins), deliberately NOT
  // in matrix.spec.ts EXAMPLES. Distinct from the existing 'Flatpickr' wrapper
  // screenshot cell (FlatpickrDemo.rozie), which stays byte-untouched.
  'FlatpickrBehavior',
  // Phase 24 (security-self-test-battery) D-11 — base example; the loader
  // resolves directly to examples/RHtml.rozie (no demo sibling). Its String
  // `content` prop has a non-empty static-HTML default, so the cell renders raw
  // HTML (the bold "safe") without a parent supplying props.
  'RHtml',
] as const;

export type Example = (typeof EXAMPLES)[number];

export const TARGETS = [
  'vue',
  'react',
  'svelte',
  'angular',
  'solid',
  'lit',
] as const;

export type Target = (typeof TARGETS)[number];

/** Kebab-cased `<rozie-*>` custom-element tag for each example (Lit cell). */
export const LIT_TAGS: Record<Example, string> = {
  Counter: 'rozie-counter',
  SearchInput: 'rozie-search-input',
  Dropdown: 'rozie-dropdown',
  TodoList: 'rozie-todo-list',
  Modal: 'rozie-modal',
  TreeNode: 'rozie-tree-node',
  Card: 'rozie-card',
  CardHeader: 'rozie-card-header',
  ModalConsumer: 'rozie-modal-consumer',
  DynamicSlotName: 'rozie-dynamic-slot-name',
  LitScopedFillFirstpaint: 'rozie-lit-scoped-fill-firstpaint',
  PortalList: 'rozie-portal-list',
  FullCalendar: 'rozie-full-calendar',
  LineChart: 'rozie-line-chart',
  CodeMirror: 'rozie-code-mirror',
  PortalListStyled: 'rozie-portal-list-styled',
  // Engine-wrapper demos — canonical kebab tag; the lit entry appends `-demo`.
  SortableList: 'rozie-sortable-list',
  SortableListPair: 'rozie-sortable-list-pair',
  SortableListNested: 'rozie-sortable-list-nested',
  SortableListClone: 'rozie-sortable-list-clone',
  SortableListFilter: 'rozie-sortable-list-filter',
  SortableListShowcase: 'rozie-sortable-list-showcase',
  Flatpickr: 'rozie-flatpickr',
  LeafletMap: 'rozie-leaflet-map',
  TipTap: 'rozie-tip-tap',
  Uppy: 'rozie-uppy',
  Table: 'rozie-table',
  // Phase 14 ThemedButton dogfood — kebab tag for the Lit cell. The Lit
  // entry will append `-demo` if a `examples/demos/<Name>Demo.rozie` is
  // present; ThemedButtonConsumer is a base example (no `<Name>Demo` sibling),
  // so the loader resolves directly to `examples/ThemedButtonConsumer.rozie`.
  ThemedButtonConsumer: 'rozie-themed-button-consumer',
  // Phase 15 — kebab tags for the three new dogfood fixtures.
  ThemedButtonListenersManual: 'rozie-themed-button-listeners-manual',
  ThemedButtonAllManual: 'rozie-themed-button-all-manual',
  ROnProbe: 'rozie-r-on-probe',
  // Phase 17 — base example, loader resolves examples/PartCardConsumer.rozie.
  PartCardConsumer: 'rozie-part-card-consumer',
  // Phase 21 — $expose dogfood. The Lit cell queries this tag to grab the
  // element handle and call reset() (the external-caller harness).
  ExposeProbe: 'rozie-expose-probe',
  // Quick 260601-x2p — the lit entry appends '-demo' → tag
  // 'rozie-flatpickr-behavior-demo' = kebab of FlatpickrBehaviorDemo.
  FlatpickrBehavior: 'rozie-flatpickr-behavior',
  // Phase 24 — kebab tag for the r-html fixture (matches the Lit-emitted
  // @customElement('rozie-r-html') in RHtml.lit.ts).
  RHtml: 'rozie-r-html',
};

export interface HostQuery {
  example: Example;
  target: Target;
}

export const DEFAULT_PROPS: Record<Example, Record<string, unknown>> = {
  Counter: { value: 0, min: 0, max: 10 },
  SearchInput: { placeholder: 'Search...' },
  Dropdown: { open: true },
  // `items` is `model: true` — passing here gives correct first-render
  // state; the rig has no parent listener for `update:items`, so any user
  // interaction inside the component won't persist (acceptable for a
  // screenshot). Shape per template: { id, text, done } — `toggle/remove`
  // look up by id, the row reads `.text`, the strikethrough class reads
  // `.done`. Strings would silently render blank.
  TodoList: {
    items: [
      { id: 't1', text: 'Buy groceries', done: false },
      { id: 't2', text: 'Walk the dog', done: true },
      { id: 't3', text: 'Write the report', done: false },
    ],
    title: 'Todo List',
  },
  Modal: { open: true, title: 'Modal Title' },
  TreeNode: { node: { id: 'root', label: 'Root', children: [
        { id: 'child1', label: 'Child 1', children: [] },
          { id: 'child2', label: 'Child 2', children: [
              { id: 'grandchild1', label: 'Grandchild 1', children: [] },
                { id: 'grandchild2', label: 'Grandchild 2', children: [] },
            ] },
      ] } },
  Card: { title: 'Card Title' },
  CardHeader: { title: 'Card Header' },
  ModalConsumer: { title: 'Confirm action' },
  // Both follow-up demos are self-contained — no props needed; the consumer's
  // `<data>` block holds all reactive state (slotName for DynamicSlotName;
  // none for LitScopedFillFirstpaint).
  DynamicSlotName: {},
  LitScopedFillFirstpaint: {},
  // PortalListDemo carries its item array in <data>; no props needed.
  PortalList: {},
  // FullCalendarDemo carries events + view in <data> and seeds them in
  // `$onMount`; no parent-supplied props needed. (FullCalendar itself
  // has `events`, `view`, `weekends`, etc. props but the demo wrapper is
  // self-contained.)
  FullCalendar: {},
  // LineChartDemo seeds its own state in `<data>` (points array + live-feed
  // flag); the LineChart wrapper itself takes `data` / `options` / `type` /
  // `height` props but the demo wrapper is self-contained.
  LineChart: {},
  // CodeMirrorDemo seeds the `code` string and `theme` in `<data>`; the
  // CodeMirror wrapper itself takes `value` (model: true) / `theme` / etc.
  // but the demo wrapper is self-contained.
  CodeMirror: {},
  // PortalListStyledDemo carries its 4-item array in <data>; no props needed.
  PortalListStyled: {},
  // Engine-wrapper demos — each <Name>Demo carries its reactive state in
  // <data> (and seeds it in `$onMount` where needed); the wrappers themselves
  // expose props, but the demo consumers are self-contained, so `{}`.
  SortableList: {},
  SortableListPair: {},
  SortableListNested: {},
  // SortableList showcase trio — each Demo carries its reactive state in
  // <data> (palette/canvas arrays for Clone, filter+items for Filter, the
  // full control-panel state for Showcase); the wrappers themselves expose
  // props, but the demo consumers are self-contained, so `{}`.
  SortableListClone: {},
  SortableListFilter: {},
  SortableListShowcase: {},
  Flatpickr: {},
  LeafletMap: {},
  TipTap: {},
  Uppy: {},
  Table: {},
  // ThemedButtonConsumer is self-contained — it forwards a hardcoded set of
  // attributes onto its two ThemedButton wrapper instances (id, aria-*,
  // data-*, type, style="--btn-bg: …", extra class). No parent-side props
  // are needed.
  ThemedButtonConsumer: {},
  // Phase 15 listener-side wrappers + R6 probe. ThemedButtonListenersManual
  // and ThemedButtonAllManual are PRODUCER fixtures (no consumer); each takes
  // a `label` prop. ROnProbe takes no props (single-file probe).
  ThemedButtonListenersManual: { label: 'Listeners Manual' },
  ThemedButtonAllManual: { label: 'All Manual' },
  ROnProbe: {},
  // PartCardConsumer is self-contained — its template hardcodes
  // `<PartCard :title="'Hello'">` and styles it via `PartCard::part(body)`.
  // No parent-side props needed.
  PartCardConsumer: {},
  // ExposeProbe is self-contained — its <data> value drives the input; no
  // parent-side props. The exposed reset()/focus() handle is driven by the
  // per-target VR external-caller shim, not props.
  ExposeProbe: {},
  // Quick 260601-x2p — self-contained; all reactive state lives in the demo's
  // <data> (picked / disableWeekends / lang / rangeValue / rangeEnabled).
  FlatpickrBehavior: {},
  // Phase 24 — RHtml is self-contained: its `content` String prop has a
  // non-empty static-HTML default ('<strong>safe</strong>'), so no parent props
  // are needed for the cell to render visible raw HTML.
  RHtml: {},
};

/**
 * `model: true` prop keys per example — the props the host must mount
 * UNCONTROLLED on strict-controllable targets (React, Solid). See
 * `toUncontrolledProps` below. Examples absent from this map have no model
 * prop and are mounted with `DEFAULT_PROPS` verbatim.
 */
export const MODEL_PROPS: Partial<Record<Example, readonly string[]>> = {
  Counter: ['value'],
  Dropdown: ['open'],
  TodoList: ['items'],
  Modal: ['open'],
};

/**
 * Rewrite a `DEFAULT_PROPS` entry so every `model: true` prop is passed via the
 * uncontrolled-default seed prop (`default<Key>` — `defaultValue`, `defaultOpen`,
 * `defaultItems`) instead of its controlled value name.
 *
 * Why: React (`useControllableState`) and Solid (`createControllableSignal`)
 * implement strict Radix-style controllable state — when a controlled value is
 * supplied WITHOUT a change listener, every internal write is silently dropped
 * and the value stays frozen at what the parent passed. The VR host wires no
 * parent listener, so on those two targets Counter/TodoList/Modal/Dropdown are
 * completely inert (TodoList: Add clears the box but appends nothing; toggling
 * a checkbox snaps straight back; Remove does nothing).
 *
 * Mounting uncontrolled hands state ownership to the component itself, so the
 * compare.html 6-up is fully interactive. First paint is identical (the seed
 * value is the same either way), so `matrix.spec.ts` screenshots are unaffected.
 *
 * Both targets emit the same `default<Key>` seed-prop name (the React emitter
 * keys it to the model identifier just like Solid), so this helper is shared
 * verbatim by `entry.react.ts` and `entry.solid.ts`.
 *
 * Vue (`defineModel`) / Svelte (`$bindable`) / Angular (`model()`) / Lit keep
 * local state even when the controlled prop is supplied without a listener, so
 * those entries pass `DEFAULT_PROPS` unchanged.
 */
export function toUncontrolledProps(
  example: Example,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const modelKeys = MODEL_PROPS[example];
  if (!modelKeys || modelKeys.length === 0) return props;
  const seedKey = (k: string): string =>
    `default${k.charAt(0).toUpperCase()}${k.slice(1)}`;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    out[modelKeys.includes(key) ? seedKey(key) : key] = value;
  }
  return out;
}

/** Parse `?example=&target=` from the current URL, falling back to defaults. */
export function parseQuery(): HostQuery {
  const params = new URLSearchParams(location.search);
  const exampleParam = params.get('example') ?? 'Counter';
  const targetParam = params.get('target') ?? 'vue';
  const example = (EXAMPLES as readonly string[]).includes(exampleParam)
    ? (exampleParam as Example)
    : 'Counter';
  const target = (TARGETS as readonly string[]).includes(targetParam)
    ? (targetParam as Target)
    : 'vue';
  return { example, target };
}

/** The chrome-reset wrapper element Playwright clips its screenshot to. */
export function mountWrapper(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-testid="rozie-mount"]');
  if (!el) {
    throw new Error(
      'visual-regression host: missing [data-testid="rozie-mount"] wrapper',
    );
  }
  return el;
}

/**
 * Phase 21 D-07 — append the ExposeProbe external-caller harness button OUTSIDE
 * `rozie-mount`. The button is VR scaffolding (it drives the grabbed imperative
 * handle), NOT component output, so it MUST live outside the screenshot-clipped
 * mount: keeping it inside coupled the shared matrix baseline to the button's
 * cross-target rendering, and Lit's shadow-DOM custom-element host sized the
 * button row 4px wider than the other 5 targets, breaking the D-10 byte-identity
 * matcher. Appending to `document.body` (a sibling of rozie-mount) keeps it
 * clickable + locatable-by-testid for the behavioral expose-probe.spec while
 * excluding it from `toHaveScreenshot(rozie-mount)`, so the ExposeProbe matrix
 * cell now renders byte-identical across all 6 targets (like SearchInput).
 * Shared across all 6 entry shims so the handle-grab differs per target but the
 * button is identical everywhere.
 */
export function appendExternalCallerButton(onClick: () => void): void {
  const btn = document.createElement('button');
  btn.textContent = 'reset via handle';
  btn.setAttribute('data-testid', 'reset-via-handle');
  btn.addEventListener('click', onClick);
  document.body.appendChild(btn);
}
