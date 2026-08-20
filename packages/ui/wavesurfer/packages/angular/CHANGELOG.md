# @rozie-ui/wavesurfer-angular

## 0.1.4

### Patch Changes

- 78d5b5b: `@rozie/runtime-angular` now exports `createRozieAttrApplier` and
  `createRozieHostAttrsReader` alongside the existing `RozieSlot`,
  `rozieDisplay`, `rozieAttr`, and `rozieToken` exports. The Angular target
  used to inline a copy of the `r-bind`/`$attrs` spread attribute applier and
  host-attribute reader (~85 lines: three `WeakMap` prev-state caches, the
  class/style merge logic, and the host-attribute fold) as a private-field
  IIFE pair in _every_ emitted component that used `r-bind` spread or read
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

- Updated dependencies [f3266db]
- Updated dependencies [78d5b5b]
- Updated dependencies [ae824bd]
  - @rozie/runtime-angular@0.6.0

## 0.1.3

### Patch Changes

- Debut release of `@rozie-ui/wavesurfer` — an idiomatic cross-framework audio waveform
  player wrapping wavesurfer.js v7, shipping identically for React, Vue, Svelte, Angular,
  Solid, and Lit. Core waveform rendering and full playback control, the two-way
  `currentTime` binding, the Timeline and Hover plugins, and the interactive Regions
  plugin with a two-way `regions` binding.

  A deep pre-release audit (`.planning/quick/260811-kt2-wavesurfer-debut-shore-up/
AUDIT.md`) found no public-surface change from this shore-up wave — no prop, emit,
  model, slot, or expose verb was added, renamed, or removed — so this debut ships as a
  PATCH, aligning all six leaves at one version. The wave closed the family's full
  coverage gap in a single pass: every prop, emit, model, and expose verb now has a
  behavioral runtime assertion executed on all six targets (previously the family's only
  runtime exercise was a single static pixel cell). It also added JetBrains web-types.json
  (Vue) and a Custom Elements Manifest (Lit) IDE sidecars, generated from the same lowered
  IR the READMEs use.
