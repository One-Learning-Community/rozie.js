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
declare module '@tiptap/extension-image';
declare module '@tiptap/extension-character-count';
declare module '@tiptap/starter-kit';
declare module 'flatpickr';
declare module '@uppy/core';
declare module '@uppy/xhr-upload';
// MapLibre (Phase 35). The MapLibre.rozie wrapper does `import maplibregl from
// 'maplibre-gl'` and constructs `new maplibregl.Map(...)` / `.Marker(...)` /
// `.Popup(...)` / `.NavigationControl(...)` etc. This gate verifies the emitted
// scaffolding type-checks, not that maplibre-gl is correctly typed, so the
// default export resolves to `any`. (The REAL maplibre type validation is the
// leaf strict typecheck over the emitted per-target output.)
declare module 'maplibre-gl';

// `sortablejs` is declared with a minimal REAL shape (not bare `any`) because
// the typed engine-wrapper fixture `examples/typed/SortableList.rozie` annotates
// its engine instance `let instance: SortableJS | null = null` and
// `examples/typed/TypedCard.rozie` does `import type { Options } from
// 'sortablejs'`. A bare `declare module 'sortablejs';` makes the default import
// a value-only binding that cannot be used as a type (TS2709). The default
// export is therefore a class — usable as BOTH a constructor value and a type —
// with permissive `any` members so the UNTYPED `SortableList` example (whose
// emitted instance is typed `any`) still type-checks unchanged.
// Cropper (cropperjs v1) — Cropper.rozie does `import CropperEngine from
// 'cropperjs'` and `new CropperEngine(img, opts)`; the instance is held untyped
// (null-let), so the default export resolves to `any`.
declare module 'cropperjs';

// Chart.js — Chart.rozie does `import { Chart as ChartJS } from 'chart.js'` and
// `new ChartJS(canvas, cfg)`; untyped null-let instance.
declare module 'chart.js';
declare module 'chart.js/auto';

// CodeMirror 6 — CodeMirror.rozie imports many named values from the
// @codemirror/* packages (EditorView/EditorState/Compartment/… as constructors,
// StateField/RangeSet/etc.). `class extends GutterMarker` / `extends WidgetType`
// extend an `any`-typed import, which TS permits, so bare `any` modules suffice —
// the gate verifies the emitted scaffolding, not CodeMirror's own types.
declare module '@codemirror/state';
declare module '@codemirror/view';
declare module '@codemirror/commands';
declare module '@codemirror/lang-javascript';
declare module '@codemirror/theme-one-dark';
declare module 'codemirror';

// FullCalendar — FullCalendar.rozie does `import { Calendar } from
// '@fullcalendar/core'` + default-import plugins; untyped null-let instance.
declare module '@fullcalendar/core';
declare module '@fullcalendar/daygrid';
declare module '@fullcalendar/timegrid';
declare module '@fullcalendar/interaction';

// PDF.js — PdfViewer.rozie dynamically `import('pdfjs-dist')` in $onMount
// (pdfjsLib held as a null-let → `any`), so getDocument / .TextLayer /
// .GlobalWorkerOptions are unchecked. The dynamic import resolves against this stub.
declare module 'pdfjs-dist';

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
