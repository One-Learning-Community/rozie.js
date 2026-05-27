/**
 * @rozie/runtime-engine-helpers — framework-agnostic runtime helpers for
 * Rozie-emitted engine-wrapper components (SortableJS, FullCalendar,
 * TipTap, Uppy, …).
 *
 * Unlike the per-target `@rozie/runtime-{react,vue,svelte,solid,lit}`
 * packages, this one ships ZERO framework imports. It's pure DOM-meets-
 * third-party-engine glue. The same exported symbol resolves identically
 * across all 6 target builds via the workspace dep.
 *
 * The slate is forward-looking — this package will accrue helpers for the
 * broader engine-wrapper port roadmap (`project_post_v1_killer_component_ports`).
 *
 * @public
 */
export {
  useSortableJS,
  type UseSortableJSOptions,
  type UseSortableJSResult,
  type SortableEventKind,
  type SortableChange,
} from './useSortableJS.js';
