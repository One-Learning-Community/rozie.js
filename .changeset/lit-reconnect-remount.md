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
"@rozie-ui/pdf-lit": patch
"@rozie-ui/popover-lit": patch
"@rozie-ui/rete-lit": patch
"@rozie-ui/select-lit": patch
"@rozie-ui/text-field-lit": patch
"@rozie-ui/tiptap-lit": patch
"@rozie-ui/wavesurfer-lit": patch
---

Lit: a component that is removed from the page and added back works again. Its mount code (`$onMount`) runs again after a real teardown, as on the other targets, so listeners, observers and engine instances are set up again instead of staying torn down. Moving an element within the same task (remove and re-append before it has torn down) keeps the running instance, as before. Mount code and top-level script statements that run again see the element's retained property values.

Lit: a prop typed with a `<types>` alias made only of string literals (or only of number literals) is now a plain reflected attribute, so `<my-el mode="compact">` works in HTML. It used to be an `Object` property whose attribute value was parsed as JSON, which failed and left the prop `null`.

The `@rozie-ui/*-lit` packages listed here are rebuilt with the first fix; none of them has a string-union prop.
