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
};

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
