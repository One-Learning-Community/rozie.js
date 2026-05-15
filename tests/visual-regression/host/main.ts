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
