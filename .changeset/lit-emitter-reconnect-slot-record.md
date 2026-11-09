---
"@rozie/core": patch
"@rozie-ui/captcha-lit": patch
"@rozie-ui/chartjs-lit": patch
"@rozie-ui/codemirror-lit": patch
"@rozie-ui/combobox-lit": patch
"@rozie-ui/command-palette-lit": patch
"@rozie-ui/cropper-lit": patch
"@rozie-ui/data-table-lit": patch
"@rozie-ui/date-picker-lit": patch
"@rozie-ui/dialog-lit": patch
"@rozie-ui/embla-lit": patch
"@rozie-ui/flatpickr-lit": patch
"@rozie-ui/fullcalendar-lit": patch
"@rozie-ui/number-field-lit": patch
"@rozie-ui/otp-lit": patch
"@rozie-ui/pagination-lit": patch
"@rozie-ui/pdf-lit": patch
"@rozie-ui/popover-lit": patch
"@rozie-ui/rete-lit": patch
"@rozie-ui/select-lit": patch
"@rozie-ui/slider-lit": patch
"@rozie-ui/switch-lit": patch
"@rozie-ui/tags-lit": patch
"@rozie-ui/text-field-lit": patch
"@rozie-ui/tiptap-lit": patch
"@rozie-ui/toast-lit": patch
"@rozie-ui/wavesurfer-lit": patch
---

Lit: a component that is removed from the page and added back works again. Its mount code (`$onMount`) runs again after a real teardown, as on the other targets, so listeners, observers and engine instances are set up again instead of staying torn down. Moving an element within the same task (remove and re-append before it has torn down) keeps the running instance, as before. Mount code and top-level script statements that run again see the element's retained property values.

Lit: a prop typed with a `<types>` alias made only of string literals (or only of number literals) is now a plain reflected attribute, so `<my-el mode="compact">` works in HTML. It used to be an `Object` property whose attribute value was parsed as JSON, which failed and left the prop `null`.

Lit: a plain-HTML or Lit consumer (not compiled by Rozie) can fill ANY slot that passes params through the element's `rozieSlots` property, keyed by the slot name (`default` for the default slot): ``el.rozieSlots = { default: ({ item }) => html`<span>${item.label}</span>` }``. The record was only read for dynamically named slots and names that are not identifiers, so an entry for an ordinary scoped slot was silently ignored. It is now tried first for every scoped slot (portal slots excepted), and a component's `$slots.<name>` check counts a record fill as filled, so content gated by `r-if="$slots.<name>"` (for example command-palette's `icon` / `actions` / `trailing` row slots) renders for a record-only fill. A Rozie consumer's fill and the native `<slot>` fallback work as before.

The `@rozie-ui/*-lit` packages listed here are rebuilt with one or both of the first and third fixes; none of them has a string-union prop.
