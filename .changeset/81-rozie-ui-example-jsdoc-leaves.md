---
"@rozie-ui/captcha-angular": patch
"@rozie-ui/captcha-lit": patch
"@rozie-ui/captcha-react": patch
"@rozie-ui/captcha-solid": patch
"@rozie-ui/captcha-svelte": patch
"@rozie-ui/captcha-vue": patch
"@rozie-ui/chartjs-angular": patch
"@rozie-ui/chartjs-lit": patch
"@rozie-ui/chartjs-react": patch
"@rozie-ui/chartjs-solid": patch
"@rozie-ui/chartjs-svelte": patch
"@rozie-ui/chartjs-vue": patch
"@rozie-ui/codemirror-angular": patch
"@rozie-ui/codemirror-lit": patch
"@rozie-ui/codemirror-react": patch
"@rozie-ui/codemirror-solid": patch
"@rozie-ui/codemirror-svelte": patch
"@rozie-ui/codemirror-vue": patch
"@rozie-ui/combobox-angular": patch
"@rozie-ui/combobox-lit": patch
"@rozie-ui/combobox-react": patch
"@rozie-ui/combobox-solid": patch
"@rozie-ui/combobox-svelte": patch
"@rozie-ui/combobox-vue": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/command-palette-lit": patch
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/cropper-angular": patch
"@rozie-ui/cropper-lit": patch
"@rozie-ui/cropper-react": patch
"@rozie-ui/cropper-solid": patch
"@rozie-ui/cropper-svelte": patch
"@rozie-ui/cropper-vue": patch
"@rozie-ui/data-table-angular": patch
"@rozie-ui/data-table-lit": patch
"@rozie-ui/data-table-react": patch
"@rozie-ui/data-table-solid": patch
"@rozie-ui/data-table-svelte": patch
"@rozie-ui/data-table-vue": patch
"@rozie-ui/date-picker-angular": patch
"@rozie-ui/date-picker-lit": patch
"@rozie-ui/date-picker-react": patch
"@rozie-ui/date-picker-solid": patch
"@rozie-ui/date-picker-svelte": patch
"@rozie-ui/date-picker-vue": patch
"@rozie-ui/embla-angular": patch
"@rozie-ui/embla-lit": patch
"@rozie-ui/embla-react": patch
"@rozie-ui/embla-solid": patch
"@rozie-ui/embla-svelte": patch
"@rozie-ui/embla-vue": patch
"@rozie-ui/flatpickr-angular": patch
"@rozie-ui/flatpickr-lit": patch
"@rozie-ui/flatpickr-react": patch
"@rozie-ui/flatpickr-solid": patch
"@rozie-ui/flatpickr-svelte": patch
"@rozie-ui/flatpickr-vue": patch
"@rozie-ui/fullcalendar-angular": patch
"@rozie-ui/fullcalendar-lit": patch
"@rozie-ui/fullcalendar-react": patch
"@rozie-ui/fullcalendar-solid": patch
"@rozie-ui/fullcalendar-svelte": patch
"@rozie-ui/fullcalendar-vue": patch
"@rozie-ui/otp-angular": patch
"@rozie-ui/otp-lit": patch
"@rozie-ui/otp-react": patch
"@rozie-ui/otp-solid": patch
"@rozie-ui/otp-svelte": patch
"@rozie-ui/otp-vue": patch
"@rozie-ui/pdf-angular": patch
"@rozie-ui/pdf-lit": patch
"@rozie-ui/pdf-react": patch
"@rozie-ui/pdf-solid": patch
"@rozie-ui/pdf-svelte": patch
"@rozie-ui/pdf-vue": patch
"@rozie-ui/rete-angular": patch
"@rozie-ui/rete-lit": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-vue": patch
"@rozie-ui/sortable-list-angular": patch
"@rozie-ui/sortable-list-lit": patch
"@rozie-ui/sortable-list-react": patch
"@rozie-ui/sortable-list-solid": patch
"@rozie-ui/sortable-list-svelte": patch
"@rozie-ui/sortable-list-vue": patch
"@rozie-ui/tags-angular": patch
"@rozie-ui/tags-lit": patch
"@rozie-ui/tags-react": patch
"@rozie-ui/tags-solid": patch
"@rozie-ui/tags-svelte": patch
"@rozie-ui/tags-vue": patch
"@rozie-ui/tiptap-angular": patch
"@rozie-ui/tiptap-lit": patch
"@rozie-ui/tiptap-react": patch
"@rozie-ui/tiptap-solid": patch
"@rozie-ui/tiptap-svelte": patch
"@rozie-ui/tiptap-vue": patch
"@rozie-ui/wavesurfer-angular": patch
"@rozie-ui/wavesurfer-lit": patch
"@rozie-ui/wavesurfer-react": patch
"@rozie-ui/wavesurfer-solid": patch
"@rozie-ui/wavesurfer-svelte": patch
"@rozie-ui/wavesurfer-vue": patch
---

The `@example` blocks in the types you import now show markup for **your** framework, not the
`.rozie` authoring notation the component was written in.

Before this release, every target read the exact same example, in `.rozie`'s own dialect. A React
consumer of `@rozie-ui/combobox` saw:

```
@example
<Combobox r-model:value="country" :options="countries" />
```

which doesn't typecheck as React and isn't how you'd actually write it. That same prop's example
now reads, per package:

```
// React
<Combobox value={country} onValueChange={setCountry} options={countries} />

// Vue — unchanged, this IS Vue's own v-model: form
<Combobox v-model:value="country" :options="countries" />

// Svelte
<Combobox bind:value={country} options={countries} />

// Solid
<Combobox value={country()} onValueChange={setCountry} options={countries} />

// Angular
<rozie-combobox [(value)]="country" [options]="countries" />

// Lit
<rozie-combobox .value=${country} @value-change=${(e) => country = e.detail} .options=${countries}></rozie-combobox>
```

Two things worth calling out:

- **Angular and Lit also rewrite the tag itself.** Both compile to a custom element under the
  hood, and their examples now show the actual tag you'd write in a template —
  `<rozie-combobox>`, not `<Combobox>`.
- **The Lit example deliberately shows the in-template property/event binding form**
  (`.value=${…}` / `@value-change=${…}`), even though the generated usage page for the same
  component teaches the imperative `el.value = …` / `el.addEventListener(...)` form. Both are
  correct Lit; the JSDoc example favors the form that reads closest to the original `.rozie`
  markup, and the usage page favors the form most Lit consumers reach for first. This divergence
  is intentional, not a drift bug.

**Nothing else changed.** No runtime behavior moved, no prop/event/slot signature changed, no
export was added or removed — every changed line in every regenerated file is a documentation
comment. If you were reading a `docs.description` (the free-text prose above the `@example`
block), that text is byte-identical to before; only the code sample beneath it changed.
