# @rozie/runtime-angular

## 0.6.0

### Minor Changes

- f3266db: `@rozie/runtime-angular` now exports `rozieDisplay`, `rozieAttr`, and `rozieToken`
  alongside the existing `RozieSlot` marker directive. The Angular target used to
  inline a copy of these three helpers (and, for `rozieToken`, its
  `globalThis`-backed cross-package registry) as module-scope declarations in
  _every_ emitted component that wrapped an interpolation or used the
  `$provide`/`$inject` context primitive — duplicating the same ~40 lines across 21
  `@rozie-ui/*-angular` leaves. The emitter now imports the helpers from
  `@rozie/runtime-angular` instead.

  Behavior is unchanged: the delegating `rozieDisplay`/`rozieAttr` class methods
  Angular templates call are untouched, `rozieToken`'s `globalThis`-backed identity
  guarantee is preserved verbatim, and a component using none of the three continues
  to carry no reference to `@rozie/runtime-angular` at all. `number-field` and `otp`
  (previously the only two Angular leaves with no existing `@rozie/runtime-angular`
  dependency) now declare it in both `package.json` and `ng-package.json`'s
  `allowedNonPeerDependencies`.

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

- ae824bd: Angular consumers filling a producer's **record-path** slot — a dynamically-named
  slot (`<slot :name="...">`), a non-identifier statically-named slot
  (`<slot name="cell-status">`), or a `matchedFamily`-routed slot — now do it with a
  keyed `[rozieSlot]` marker directive on the fill's own `<ng-template>`, instead of
  the old `@ViewChild(..., { static: true })` + class-body `templates` getter path.

  This closes two silent-wrong-render bugs the old mechanism could not express
  correctly:
  - **A fill inside a conditional or a loop** (`r-if` / `r-for`) used to be silently
    dropped — a static `@ViewChild` query resolves once, before change detection, and
    never sees a `<ng-template>` that only exists inside an `@if`/`@for` block.
  - **Two sibling producers on one page** used to collide — the emitter's synthetic
    template-reference-variable naming reset per producer tag, so both producers'
    fills shared the same reference name and the class-body `templates` getter only
    ever emitted an entry for the first producer, silently dropping the second.

  Both are now correct: the producer collects keyed fills via a signal
  `contentChildren(RozieSlot, { descendants: true })` content query, which — unlike a
  static view query — re-evaluates on every change-detection pass and sees content
  regardless of which conditional or loop iteration it lives inside.

  **A third, related bug is fixed in the same release: a consumer's dynamic
  `#[expr]` fill used to be silently dropped whenever its target producer's own
  slots were all plain static names** (e.g. `<slot name="header">`), because the
  producer's keyed-fill intake — and, one layer up, the structural `r-if` gate
  deciding whether the wrapper element carrying that slot renders at all — only
  activated for producers that themselves declared a dynamically- or
  non-identifier-named slot. Both gates now activate for every producer that
  declares at least one slot of any kind, so a dynamic consumer fill reaches its
  target regardless of how that target names its own slots.

  **Hand-written Angular consumers get the same capability in one line of markup, no
  class-body code required:**

  ```html
  <my-producer>
    <ng-template [rozieSlot]="'cell-status'">...</ng-template>
  </my-producer>
  ```

  with `RozieSlot` imported from the new `@rozie/runtime-angular` package. The
  `templates` input survives unchanged as the documented programmatic escape hatch —
  nothing that used it needs to change.

  **`@rozie/runtime-angular` is a new published package.** Emitted Angular output
  imports it whenever a component declares **at least one slot of any kind** —
  record-path or plain static-named — since either shape can now receive a keyed
  fill; a component that declares no slots at all gets no new runtime dependency.
  It ships Ivy partial-compilation output (the standard library-authoring format,
  linked into your app by the Angular CLI's own build pipeline) and joins the
  `fixed` changesets group with the other five `@rozie/runtime-*` packages, so it
  versions in lockstep. Concretely, this release adds the dependency to every
  shipped `@rozie-ui` Angular component package that declares a slot.

  (As with prior releases, the six `@rozie/target-*` emitter packages are private
  workspace packages, never published on their own — `@rozie/core`'s emitters are
  what's inlined into every public entry point that compiles `.rozie` source: this
  CLI, the unplugin build-tool adapter, and the Babel plugin. Only the Angular target
  changes with this release; the other five targets are byte-identical.)
