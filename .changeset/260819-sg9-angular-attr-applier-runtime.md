---
"@rozie/runtime-angular": minor
"@rozie-ui/captcha-angular": patch
"@rozie-ui/combobox-angular": patch
"@rozie-ui/cropper-angular": patch
"@rozie-ui/date-picker-angular": patch
"@rozie-ui/dialog-angular": patch
"@rozie-ui/embla-angular": patch
"@rozie-ui/flatpickr-angular": patch
"@rozie-ui/lexical-angular": patch
"@rozie-ui/listbox-angular": patch
"@rozie-ui/number-field-angular": patch
"@rozie-ui/otp-angular": patch
"@rozie-ui/pagination-angular": patch
"@rozie-ui/pdf-angular": patch
"@rozie-ui/popover-angular": patch
"@rozie-ui/resizable-angular": patch
"@rozie-ui/slider-angular": patch
"@rozie-ui/sortable-list-angular": patch
"@rozie-ui/switch-angular": patch
"@rozie-ui/tags-angular": patch
"@rozie-ui/toast-angular": patch
"@rozie-ui/wavesurfer-angular": patch
---

`@rozie/runtime-angular` now exports `createRozieAttrApplier` and
`createRozieHostAttrsReader` alongside the existing `RozieSlot`,
`rozieDisplay`, `rozieAttr`, and `rozieToken` exports. The Angular target
used to inline a copy of the `r-bind`/`$attrs` spread attribute applier and
host-attribute reader (~85 lines: three `WeakMap` prev-state caches, the
class/style merge logic, and the host-attribute fold) as a private-field
IIFE pair in *every* emitted component that used `r-bind` spread or read
`$attrs` — 158 tracked emitted files, of which 23 are shipped
`@rozie-ui/*-angular` leaf sources across 21 leaves.

The emitted component keeps performing both `inject(Renderer2)` /
`inject(ElementRef)` calls itself, in the same class-field initializer
position; it now passes the resolved instance into the runtime factory
(`createRozieAttrApplier(inject(Renderer2))`) instead of resolving it
internally. Neither factory ever calls `inject()` or names an Angular
type — both accept a structural interface (`RozieAttrRenderer`,
`RozieHostRef`) — so this package still never resolves an Angular DI token
itself, and the peer-keyed cross-package instance-identity hazard
(`71dff1d5`) is structurally unreachable rather than merely tested against.

Merge semantics, applied DOM output, and evaluation order are unchanged: a
wrapper's own static `class` survives a spread that also sets `class`; a
dropped `class`/`style` key removes only the tokens/properties this applier
previously applied; an applied style still lands with `!important` priority,
winning the last-write race against Angular's own `[ngClass]`/`ɵɵstyleMap`
re-apply.

A component using neither `r-bind` spread nor `$attrs` carries no new
reference to `@rozie/runtime-angular` — the import gate is keyed on whether
the emitter actually pushed the corresponding field declaration, independent
of the two Tier-1 gates (`rozieDisplay`/`rozieAttr`/`rozieToken`,
`RozieSlot`).
