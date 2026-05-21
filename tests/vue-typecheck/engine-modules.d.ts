// Ambient stubs for the vanilla-JS engine modules that the engine-wrapper
// example `<script>` blocks import (TipTap → `@tiptap/*`, Uppy → `@uppy/*`,
// SortableList → `sortablejs`, Flatpickr → `flatpickr`).
//
// This gate verifies that ROZIE'S EMITTED component scaffolding type-checks —
// not that the engine libraries are correctly typed — so the engine modules
// resolve to `any` here. That keeps the gate dependency-free: no need to
// install @tiptap/core, sortablejs, … into every per-target typecheck
// workspace just to exercise the engine-wrapper emit path.
declare module '@tiptap/core';
declare module '@tiptap/starter-kit';
declare module 'sortablejs';
declare module 'flatpickr';
declare module '@uppy/core';
declare module '@uppy/xhr-upload';
