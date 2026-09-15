---
"@rozie-ui/captcha-angular": patch
"@rozie-ui/captcha-lit": patch
"@rozie-ui/captcha-react": patch
"@rozie-ui/captcha-solid": patch
"@rozie-ui/chartjs-angular": patch
"@rozie-ui/chartjs-lit": patch
"@rozie-ui/chartjs-solid": patch
"@rozie-ui/codemirror-angular": patch
"@rozie-ui/codemirror-lit": patch
"@rozie-ui/codemirror-react": patch
"@rozie-ui/codemirror-solid": patch
"@rozie-ui/combobox-angular": patch
"@rozie-ui/combobox-lit": patch
"@rozie-ui/combobox-react": patch
"@rozie-ui/command-palette-angular": patch
"@rozie-ui/command-palette-lit": patch
"@rozie-ui/command-palette-react": patch
"@rozie-ui/cropper-angular": patch
"@rozie-ui/cropper-lit": patch
"@rozie-ui/cropper-react": patch
"@rozie-ui/cropper-solid": patch
"@rozie-ui/date-picker-angular": patch
"@rozie-ui/date-picker-lit": patch
"@rozie-ui/date-picker-react": patch
"@rozie-ui/embla-angular": patch
"@rozie-ui/embla-lit": patch
"@rozie-ui/embla-react": patch
"@rozie-ui/flatpickr-angular": patch
"@rozie-ui/flatpickr-lit": patch
"@rozie-ui/flatpickr-react": patch
"@rozie-ui/flatpickr-solid": patch
"@rozie-ui/fullcalendar-angular": patch
"@rozie-ui/fullcalendar-lit": patch
"@rozie-ui/fullcalendar-react": patch
"@rozie-ui/fullcalendar-solid": patch
"@rozie-ui/otp-angular": patch
"@rozie-ui/otp-lit": patch
"@rozie-ui/otp-react": patch
"@rozie-ui/otp-solid": patch
"@rozie-ui/pdf-angular": patch
"@rozie-ui/pdf-lit": patch
"@rozie-ui/pdf-react": patch
"@rozie-ui/pdf-solid": patch
"@rozie-ui/popover-angular": patch
"@rozie-ui/popover-lit": patch
"@rozie-ui/popover-react": patch
"@rozie-ui/rete-angular": patch
"@rozie-ui/rete-lit": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/sortable-list-angular": patch
"@rozie-ui/sortable-list-lit": patch
"@rozie-ui/sortable-list-react": patch
"@rozie-ui/tags-angular": patch
"@rozie-ui/tags-lit": patch
"@rozie-ui/tags-react": patch
"@rozie-ui/tiptap-angular": patch
"@rozie-ui/tiptap-lit": patch
"@rozie-ui/tiptap-react": patch
"@rozie-ui/toast-angular": patch
"@rozie-ui/toast-lit": patch
"@rozie-ui/toast-react": patch
"@rozie-ui/wavesurfer-angular": patch
"@rozie-ui/wavesurfer-lit": patch
"@rozie-ui/wavesurfer-react": patch
"@rozie-ui/wavesurfer-solid": patch
---

Declare `@rozie/runtime-*` as `workspace:^` instead of `workspace:*`.

`workspace:*` publishes as an **exact** pin on the runtime version, so every toolchain bump forced a republish of every leaf that carried one — 76 of the 92 packages in the previous release wave had no source change at all. `workspace:^` publishes as `^<version>`, which a later patch-level runtime still satisfies, so an unchanged leaf stays valid instead of being dragged along.

This is not a new policy: it is the caret policy already documented and applied by nine family codegen scripts ("bake the caret policy now so `workspace:*` is normalized to `workspace:^`"). It was simply never applied to the leaves whose codegen does not write `package.json`. The Svelte leaves were already fully aligned; the Vue leaves were aligned apart from three. This brings the React, Solid, Lit, and Angular leaves in line, so all six targets now state the dependency the same way.

The `@rozie/*` toolchain packages keep `workspace:*` deliberately — they are a changesets `fixed` group and always version in lockstep, so an exact pin is correct there.

This release still republishes these leaves, because their published `package.json` genuinely changes. The benefit is on every release after it.
