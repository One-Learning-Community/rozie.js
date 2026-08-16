# Components

The `@rozie-ui` families are pre-compiled component packages for React, Vue, Svelte, Angular, Solid, and Lit: the same component, with the same API, in whichever of the six frameworks you use. Most wrap a battle-tested vanilla-JS engine whose existing framework wrappers are uneven, partial, or entirely missing; thirteen families (**Listbox**, **Slider**, **Combobox**, **CommandPalette**, and friends) are headless, fully-accessible components with no engine at all.

Install only the package for your framework. There is no build step and no Rozie toolchain to add — just the compiled output for the framework you already use, plus a small [tree-shaken `@rozie/runtime-*` helper package](/guide/output-and-runtime) that most (not all) builds pull in.

Every family below ships six packages (`-react`, `-vue`, `-svelte`, `-angular`, `-solid`, `-lit`), a showcase-and-API page, a libraries-comparison page against the incumbents on each framework, and a live demo.

## The families

Grouped by what they do. Most wrap a vanilla-JS engine; the **headless** group at the end carries no engine at all.

### Data, tables & lists

| Family | Wraps | Showcase |
| --- | --- | --- |
| **DataTable** | [@tanstack/table-core](https://tanstack.com/table) — sorting, filtering, pagination, selection, full column management; **table _and_ WAI-ARIA `role="grid"` modes** | [/components/data-table](/components/data-table) |
| **SortableList** | [SortableJS](https://sortablejs.github.io/Sortable/) drag-and-drop lists | [/components/sortable-list](/components/sortable-list) |

### Editors

| Family | Wraps | Showcase |
| --- | --- | --- |
| **CodeMirror** | [CodeMirror 6](https://codemirror.net/) code editor | [/components/codemirror](/components/codemirror) |
| **TipTap** | [TipTap](https://tiptap.dev/) rich-text editor (ProseMirror) | [/components/tiptap](/components/tiptap) |
| **Lexical** | [Lexical](https://lexical.dev/) rich-text editor (Meta) | [/components/lexical](/components/lexical) |

### Dates & scheduling

| Family | Wraps | Showcase |
| --- | --- | --- |
| **Flatpickr** | [flatpickr](https://flatpickr.js.org/) date / time picker | [/components/flatpickr](/components/flatpickr) |
| **FullCalendar** | [FullCalendar](https://fullcalendar.io/) event calendar | [/components/fullcalendar](/components/fullcalendar) |

### Charts, maps & graphs

| Family | Wraps | Showcase |
| --- | --- | --- |
| **Chart.js** | [Chart.js](https://www.chartjs.org/) canvas charts | [/components/chartjs](/components/chartjs) |
| **MapLibre** | [MapLibre GL](https://maplibre.org/) interactive maps | [/components/maplibre](/components/maplibre) |
| **FlowCanvas** | [Rete.js](https://retejs.org/) node-flow editor | [/components/rete](/components/rete) |

### Media

| Family | Wraps | Showcase |
| --- | --- | --- |
| **Cropper** | [Cropper.js](https://fengyuanchen.github.io/cropperjs/) image cropping | [/components/cropper](/components/cropper) |
| **Waveform** | [wavesurfer.js](https://wavesurfer.xyz) audio waveform + playback | [/components/wavesurfer](/components/wavesurfer) |
| **PdfViewer** | [pdf.js](https://mozilla.github.io/pdf.js/) PDF rendering | [/components/pdf](/components/pdf) |
| **Carousel** | [Embla Carousel](https://www.embla-carousel.com) carousel engine | [/components/embla](/components/embla) |

### Security & forms

| Family | Wraps | Showcase |
| --- | --- | --- |
| **Captcha** | [reCAPTCHA](https://www.google.com/recaptcha/) / [hCaptcha](https://www.hcaptcha.com/) / [Turnstile](https://www.cloudflare.com/products/turnstile/) bot protection | [/components/captcha](/components/captcha) |

### Overlays

| Family | Wraps | Showcase |
| --- | --- | --- |
| **Popover** | [Floating UI](https://floating-ui.com/) tooltip + popover positioning | [/components/popover](/components/popover) |

### Headless primitives (no engine)

Authored from scratch in a single `.rozie` file — no third-party engine, fully accessible.

| Family | Wraps | Showcase |
| --- | --- | --- |
| **Listbox** | *(no engine)* headless WAI-ARIA listbox / combobox | [/components/listbox](/components/listbox) |
| **Slider** | *(no engine)* headless accessible slider / range | [/components/slider](/components/slider) |
| **Otp** | *(no engine)* headless accessible one-time-code / PIN input | [/components/otp](/components/otp) |
| **Combobox** | *(no engine)* headless WAI-ARIA combobox / autocomplete | [/components/combobox](/components/combobox) |
| **Toaster** | *(no engine)* headless accessible toast / notification host | [/components/toast](/components/toast) |
| **Dialog** | *(native `<dialog>`)* headless accessible modal dialog | [/components/dialog](/components/dialog) |
| **Tags** | *(no engine)* headless accessible token / tags input | [/components/tags](/components/tags) |
| **NumberField** | *(no engine)* headless accessible number field / stepper | [/components/number-field](/components/number-field) |
| **Pagination** | *(no engine)* headless accessible pagination | [/components/pagination](/components/pagination) |
| **DatePicker** | *(no engine)* headless accessible calendar (single + range modes) | [/components/date-picker](/components/date-picker) |
| **Switch** | *(no engine)* headless accessible toggle / switch | [/components/switch](/components/switch) |
| **Resizable** | *(no engine)* headless accessible two-panel splitter / resizable pane | [/components/resizable](/components/resizable) |
| **CommandPalette** | *(no engine)* headless accessible cmdk-style command menu | [/components/command-palette](/components/command-palette) |

## Why these exist

Each family targets a real cross-framework gap: an engine that does its heavy lifting in vanilla JS, but whose framework bindings are either divergent across React/Vue/Svelte/Solid, single-maintainer community efforts for Angular, or simply nonexistent for Lit and web components. Rozie compiles one source into six idiomatic, version-current wrappers — eliminating the per-framework wrapper maintenance that dominates the budget of cross-framework UI libraries.

For the why-and-how of Rozie itself, start with the [Guide](/guide/why).
