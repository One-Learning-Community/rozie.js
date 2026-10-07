// Ambient `any` stubs for the vanilla-JS engine modules an engine-wrapper
// leaf's emitted `<script>` body might import (sortablejs, flatpickr, …). The
// pure-Rozie canary leaves (combobox/slider/listbox) import none of these, but
// the stub keeps the strict harness dependency-free for engine-wrapper leaves
// added to a later baseline — mirrors tests/vue-typecheck/engine-modules.d.ts.
//
// This gate verifies ROZIE'S EMITTED scaffolding type-checks under strict flags,
// not that the engine libraries are correctly typed, so engine modules resolve
// to `any` here.
declare module 'sortablejs';
declare module 'flatpickr';
// @tiptap/core is a block, not a shorthand module: TipTap's `<types>` imports
// `Editor` as a TYPE (the `ready` payload), and a shorthand ambient module's
// names cannot be used as types (TS2709). Every name stays `any`.
declare module '@tiptap/core' {
  export const Editor: any;
  export type Editor = any;
  export const Node: any;
  export type Node = any;
  export const Extension: any;
}
declare module 'maplibre-gl';
