// Ambient stub for the vanilla-JS engine module imported by the typed
// engine-wrapper fixture (`examples/typed/SortableList.rozie` → `sortablejs`,
// and `examples/typed/TypedCard.rozie`'s `import type { Options } from
// 'sortablejs'`).
//
// This gate verifies that ROZIE'S EMITTED component scaffolding lints/type-checks
// — not that the engine library is correctly typed. `sortablejs` is declared
// with a minimal REAL shape (not bare `any`) because the typed fixture
// annotates its engine instance `let instance: SortableJS | null = null`; a
// bare `declare module 'sortablejs';` makes the default import a value-only
// binding that cannot be used as a type (TS2709). The default export is a
// class — usable as BOTH a constructor value and a type — with permissive
// `any` members. Mirrors the upgraded stub in the react/vue/svelte/angular
// typecheck gates.
declare module 'sortablejs' {
  export interface Options {
    [key: string]: any;
  }
  export default class Sortable {
    constructor(el: any, options?: Options);
    destroy(): void;
    option(name: any, value?: any): any;
  }
}
