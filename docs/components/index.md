# Components

The `@rozie-ui` families are Rozie's flagship demonstration: pre-compiled, per-framework component packages where **one `.rozie` source compiles to idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers**. Most wrap a battle-tested vanilla-JS engine whose existing framework wrappers are uneven, partial, or — for Lit and friends — entirely missing. Two newer families (**Listbox** and **Slider**) carry no engine at all: they are headless, fully-accessible components authored from scratch in a single `.rozie` file, proving Rozie carries rich interaction on its own.

Consumers install only the package for their framework. No Rozie toolchain, no build-time compile step, no `@rozie/*` runtime dependency — just the compiled output for the framework they already use.

Every family below ships six packages (`-react`, `-vue`, `-svelte`, `-angular`, `-solid`, `-lit`), a showcase-and-API page, a libraries-comparison page that shows the cross-framework wedge, and a live demo.

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
| **PdfViewer** | [pdf.js](https://mozilla.github.io/pdf.js/) PDF rendering | [/components/pdf](/components/pdf) |
| **Carousel** | [Embla Carousel](https://www.embla-carousel.com) carousel engine | [/components/embla](/components/embla) |

### Security & forms

| Family | Wraps | Showcase |
| --- | --- | --- |
| **Captcha** | [reCAPTCHA](https://www.google.com/recaptcha/) / [hCaptcha](https://www.hcaptcha.com/) / [Turnstile](https://www.cloudflare.com/products/turnstile/) bot protection | [/components/captcha](/components/captcha) |

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

## Why these exist

Each family targets a real cross-framework gap: an engine that does its heavy lifting in vanilla JS, but whose framework bindings are either divergent across React/Vue/Svelte/Solid, single-maintainer community efforts for Angular, or simply nonexistent for Lit and web components. Rozie compiles one source into six idiomatic, version-current wrappers — eliminating the per-framework wrapper maintenance that dominates the budget of cross-framework UI libraries.

For the why-and-how of Rozie itself, start with the [Guide](/guide/why).
