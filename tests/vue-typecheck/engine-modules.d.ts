// Ambient stubs for the vanilla-JS engine modules that the engine-wrapper
// example `<script>` blocks import (TipTap → `@tiptap/*`, Uppy → `@uppy/*`,
// SortableList → `sortablejs`, Flatpickr → `flatpickr`).
//
// This gate verifies that ROZIE'S EMITTED component scaffolding type-checks —
// not that the engine libraries are correctly typed — so most engine modules
// resolve to `any` here. That keeps the gate dependency-free: no need to
// install @tiptap/core, … into every per-target typecheck workspace just to
// exercise the engine-wrapper emit path.
declare module '@tiptap/core';
declare module '@tiptap/extensions';
declare module '@tiptap/extension-bubble-menu';
declare module '@tiptap/extension-floating-menu';
declare module '@tiptap/starter-kit';
declare module 'flatpickr';
declare module '@uppy/core';
declare module '@uppy/xhr-upload';

// `sortablejs` is declared with a minimal REAL shape (not bare `any`) because
// the typed engine-wrapper fixture `examples/typed/SortableList.rozie` annotates
// its engine instance `let instance: SortableJS | null = null` and
// `examples/typed/TypedCard.rozie` does `import type { Options } from
// 'sortablejs'`. A bare `declare module 'sortablejs';` makes the default import
// a value-only binding that cannot be used as a type (TS2709). The default
// export is therefore a class — usable as BOTH a constructor value and a type —
// with permissive `any` members so the UNTYPED `SortableList` example (whose
// emitted instance is typed `any`) still type-checks unchanged.
declare module 'sortablejs' {
  export interface Options {
    [key: string]: any;
  }
  // `SortableEvent` is imported (type-only) by the @rozie-ui/sortable-list
  // package's internal `useSortableJS` helper, staged into the tmp dir for the
  // SortableList engine-wrapper case.
  export interface SortableEvent {
    [key: string]: any;
  }
  export default class Sortable {
    constructor(el: any, options?: Options);
    destroy(): void;
    option(name: any, value?: any): any;
  }
}
