# @rozie-ui/embla-react

## 0.1.10

### Patch Changes

- @rozie/runtime-react@0.7.2

## 0.1.9

### Patch Changes

- @rozie/runtime-react@0.7.1

## 0.1.8

### Patch Changes

- 6274a5f: React's `useMemo` stabilization of an escaping top-level `const` was discovered by a
  ONE-LEVEL, NON-TRANSITIVE scan of `Listener.deps` / `LifecycleHook.setupDeps` — a
  `new X()` an effect reached only THROUGH a top-level helper (`buildState() ->
gutterCompartment.of(...)`) was invisible to that scan and never got `useMemo`, so React
  rebuilt it fresh every render. For an identity-keyed engine object (a CodeMirror6
  `Compartment`, a Map/WeakMap/Set used as cross-render scratch state) this silently no-ops
  any imperative API keyed on that instance's identity — CodeMirror's
  `scheduleReconfigure(compartment, ...)` against an `EditorState` that never saw the fresh
  Compartment being the corpus shape that surfaced this. All four turbo gates (build, test,
  dist-parity, typecheck) stayed green while the bug was live; only visual regression testing
  caught it.

  `computeEscapingNames` (`packages/targets/react/src/emit/computeEscapingNames.ts`) now runs
  a worklist-to-fixpoint over top-level helper bodies: a helper name reached by an
  effect/listener seed is walked (its body inspected for further references) but never itself
  promoted into the escaping set — only a non-function top-level `const` binder reached at any
  depth through that walk is added. This bound is deliberate: promoting a helper NAME into the
  escaping set would flip a hoisted `function` declaration back into a non-hoisted
  `useCallback` const, reopening the temporal-dead-zone class the emitter's plain-hoist branch
  exists to close, across 860+ shipped `function` declarations corpus-wide. The duplicated seed
  computation (previously maintained independently in two places in `emitScript.ts`) is now
  one shared computation, so the `useMemo`/`useCallback` wrap decision and the seam-3 staleness
  classification can never silently diverge.

  The CodeMirror unwind quick 260829-gbs had to revert (`5d48f9156`, because the two
  `code-mirror [react]` VR cells failed all retries under the pre-fix emitter) is re-landed:
  all six leaves regenerated from the fixed emitter, all ten CM6 `Compartment` instances now
  emit as `useMemo(() => new Compartment(), [])` on React, and the five non-React leaves are
  byte-identical to the original unwind (`61bf99340`) — the emitter fix itself is React-only.

  Four other shipped React leaves carried a const of this exact shape and changed wrap form as
  an expected consequence, each individually inspected (correct empty dep array on a
  non-reactive initializer, no reactive-read case regressed to `[]`, no `.current`-read freeze
  hazard, and zero helper `function` declarations flipped form anywhere in the corpus):
  `@rozie-ui/data-table-react` (`GRID_PAGE_STEP`, `DATA_WRITE_TOKEN_KEY`, `SELECT_COL_ID`,
  `EXPANDER_COL_ID`), `@rozie-ui/rete-react` (`RESIZE_MIN_FALLBACK`, `CONN_WARN_SETTLE_MS`,
  `HISTORY_CAP`, `ZOOM_STEP`), and `@rozie-ui/toast-react` (`EXIT_FAILSAFE_MS`). Every one is a
  bare literal initializer reading nothing, so `[]` is the correct and complete dep array.

  **Emitted-comment fidelity — two structural fixes.** The component-scope emission loop mixes
  statements emitted as hand-built STRINGS (four `tryWrap*` passes) with statements emitted
  through a per-statement `@babel/generator` call, each of the latter carrying its own
  printed-comment dedup set. Because Babel attaches a comment sitting BETWEEN two statements to
  BOTH neighbours at once, a shared comment printed TWICE (both neighbours rendered it) or ZERO
  times (neither did), depending purely on which pass claimed each side — and both failures
  were live in the shipped corpus simultaneously. No per-wrap rule can be right for both sides,
  so the decision moved to a block-wide printed-comment ledger keyed on comment object
  identity, which prints every comment exactly once in source order regardless of which pass
  claims either neighbour. This mirrors the single-dedup-set precedent `genBlockInner` and
  `genImportsBlock` already set for their own scopes.

  Separately, `hoistModuleLet` removed a hoisted `let`'s declaration from the component body
  and took the author's comment on that declaration with it. Those leading comments are now
  re-homed onto the nearest surviving neighbour before removal. This one was invisible from
  inside a single component: an inline host kept such a comment (its neighbour is one parse
  away and carries it as `trailingComments`) while the byte-identical `<script src>`
  partial-inlined host — whose spliced node comes from a DIFFERENT parse with no comments
  attached — lost it. `dist-parity`'s Phase 56-R8 / R11 partial-vs-inline byte-identity cells
  are what caught it.

  Net effect across the shipped React corpus: 2110 comment lines restored, 187 duplicate
  prints removed, and **zero** comments dropped and **zero** non-comment bytes changed —
  verified line-by-line against the pre-change corpus. Fifteen further React leaves are bumped
  here for that comment-fidelity restoration alone, with no code change:
  `@rozie-ui/captcha-react`, `chartjs-react`, `combobox-react`, `command-palette-react`,
  `cropper-react`, `date-picker-react`, `embla-react`, `flatpickr-react`, `otp-react`,
  `pdf-react`, `popover-react`, `sortable-list-react`, `tags-react`, `tiptap-react`, and
  `wavesurfer-react`.

  Nine more React leaves drifted the same comment-only way but are deliberately OMITTED from
  the front matter: `@rozie-ui/dialog-react`, `lexical-react`, `listbox-react`,
  `maplibre-react`, `number-field-react`, `pagination-react`, `resizable-react`,
  `slider-react` and `switch-react` are all in `.changeset/config.json`'s `ignore` list, and
  listing an ignored package alongside a non-ignored one makes `changeset status` fail
  outright — the exact breakage `8865e96df` repaired, not reintroduced here.

- 4a2de54: React dropped the author's leading comments on any top-level `const f = () => {…}`. The
  emitter rebuilds those as `function f() {…}` so the binding hoists (a real TDZ fix), but it
  returned the bare synthetic node — no source position and no comments attached — so
  `@babel/generator` printed the declaration and silently discarded everything documenting it.
  Measured against the shipped corpus, that was 683 of React's 899 lost comments; Solid, whose
  identically-named `tryHoistArrowToFunction` has always ended with `t.inherits(fn, stmt)`,
  lost none. React simply never got that line.

  Restoring it alone is only half the mechanism, and the half on its own is a regression. A
  comment authored between a hoisted module-`let` and the declaration below it survives on the
  inline path (one parse attaches the comment object to both neighbours, so the successor still
  carries it) but not across a `<script src>` partial boundary, where the spliced successor
  comes from a different parse with nothing attached. There the comment lives only on the
  removed `let`'s trailing side and dies with the statement — so the inline host printed a
  comment the partial-inlined host could not, and the two stopped being byte-identical.

  Quick task 260829-j18 re-homed a removed statement's LEADING comments onto a surviving
  neighbour but deliberately skipped the trailing side, on the reasoning that a removed
  statement's trailing comments are the same objects Babel attached as the next statement's
  leading comments, so that side already had an owner. That holds for an inline-authored
  `<script>` and fails at a splice boundary. `hoistModuleLet` now re-homes the trailing side
  too, onto the nearest following survivor, deduped by comment object IDENTITY — which is what
  keeps the inline case from double-printing, since there the object is already present on the
  successor.

  The two changes ship together and are asserted together: `dist-parity`'s multi-boundary
  "DataTable-shaped permanent guard" goes red with either half missing, and green with both.

  Across the 38 regenerated React leaves this restores **2655 comments, with zero comments
  dropped and zero non-comment bytes changed** — verified by parsing each file before and
  after, comparing the parser's own comment list as a multiset, and comparing
  `generate(ast, { comments: false })` on both sides, rather than by reading the diff. The
  dist-parity fixture rebless was verified the same way (55 comments restored, no code delta).

  One cosmetic wart, not fixed here: in `@rozie-ui/data-table-react` a single restored comment
  prints on the same line as the preceding function's closing brace (`} // …`) instead of
  starting its own line, because it is re-homed as the previous statement's trailing comment.
  The block still reads immediately above the declaration it documents and the AST is
  unaffected. Output prettiness stays a v2 concern.

  Nine further React leaves drifted the same comment-only way but are deliberately absent from
  the front matter — `@rozie-ui/dialog-react`, `lexical-react`, `listbox-react`,
  `maplibre-react`, `number-field-react`, `pagination-react`, `resizable-react`,
  `slider-react` and `switch-react` are all in `.changeset/config.json`'s `ignore` list, and
  listing an ignored package beside a non-ignored one makes `changeset status` fail outright.
  - @rozie/runtime-react@0.7.0

## 0.1.7

### Patch Changes

- @rozie/runtime-react@0.6.0

## 0.1.6

### Patch Changes

- `@rozie/runtime-lit` gains a new public export, `RozieSlotDistributor` — a reactive
  controller that performs manual slot assignment for a Lit shadow root, used wherever a
  component needs to route projected children into loop-generated `<slot>` targets
  (e.g. carousel slides). Adopting manual `slotAssignment` turns OFF the browser's
  automatic Text-node projection for that shadow root: raw text children must now be
  assigned to a slot explicitly, and any code reading `assignedNodes()` needs to guard
  for the manual-assignment case. A host that adopts the controller needs its
  `shadowRootOptions` typed as `ShadowRootInit`.

  `@rozie/core` adds two new compile-time diagnostics and one new template sigil:
  - **ROZ148** — flags a prop whose name collides with an emitted callback name, before
    it becomes a runtime shadowing bug on a target that lowers the prop to a method.
  - **ROZ210** — flags a reserved slot name so it can't silently collide with an
    internally-generated one.
  - **`$slotted`** — a new member sigil authors can read inside a loop to get the live,
    reactively-assigned elements projected into that iteration's slot.

  `@rozie/{cli,unplugin,babel-plugin}` bundle `@rozie/core`'s compiler, so this release
  carries the same diagnostics and `$slotted` lowering through to every consumer of
  those packages — the compiler itself moved even though none of these three changed
  their own source. `$slotted` lowers to a reactive assigned-elements signal on the Lit
  target (backed by `RozieSlotDistributor`, gated behind a new `shouldDistributeSlots`
  check so it only emits where a loop actually needs manual slot assignment) and to a
  plain `[]` on the five hostless targets (React, Vue, Svelte, Solid, Angular), where
  there's no shadow root to distribute into.

  `@rozie/runtime-{react,vue,svelte,solid,keynav-core}` are version-aligned to 0.5.0 by
  the changesets `fixed` group riding the `runtime-lit` minor above — this is a
  version-alignment release only; none of these five packages has a source or behavior
  change in this wave.

  `@rozie-ui/date-picker-*` (all six targets) — day and caption labels are now derived
  from `Intl`, with a new `labels` prop for overriding them; range-span selections now
  validate against `disabled` dates; and the calendar header adds drill-in/drill-out
  navigation verbs.

  `@rozie-ui/embla-*` (all six targets) adopts `$slotted` for its carousel slides. On
  the Lit target specifically, this closes a real projection gap: raw `slot="slide"`
  children are now distributed per-iteration instead of only the first iteration
  claiming them.

  `@rozie-ui/{combobox,command-palette,data-table,sortable-list,tags,toast}-lit` are
  regenerated against the new Lit emitter output above — each already used a loop-slot
  pattern that now runs through `RozieSlotDistributor` / `$slotted` instead of the prior
  ad hoc approach, with no observable behavior change for existing consumers of these
  specific leaves.

- Updated dependencies
  - @rozie/runtime-react@0.5.0

## 0.1.5

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  Two read kinds landed here:
  - **`$emit` handler props** (4) — `onPointerDown`, `onReInit`, `onSelect`, `onSettle`. Embla's callbacks are registered once against the engine at mount, so before this fix a consumer that swapped any of these handlers after mount kept getting the original one called. They now dispatch to the current handler.
  - **Helper calls** (4) — `emblaPluginsFromProps`, `initialOptions`, `reinitOptions`, `thumbsOptionsFromProps`, so a re-init picks up current options and plugins.

- No API surface change.
- @rozie/runtime-react@0.2.3

## 0.1.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.1`. The public `.d.ts`'s `renderSlide`/`renderThumb` params are unaffected (`slide`/`index` are `r-for` loop vars, correctly still `unknown`) — no CR-02-attributable change to this leaf's slot-callable types. The `startIndex` prop's JSDoc now correctly says "Init-only" instead of the stale "Runtime-updatable" (WR-01) — the D1 init-only contract shipped in 0.1.3, but the prop's own doc comment (copied verbatim into the `.d.ts` and IDE hover) was missed. No runtime behavior change.

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The selected index now survives `reInit`: `startIndex` is stripped from every reInit payload after the raw `options` spread, so a runtime option flip (e.g. toggling `loop`) no longer teleports the carousel back to `startIndex`. **Deliberate behavior change to a published verb:** no-arg `reInitCarousel()` now preserves position instead of resetting to `startIndex` — documented in `embla.md`. Scheduled mount work (two `requestAnimationFrame` handles + a macrotask) is now cancelled on teardown, and both engines are nulled after `destroy()`, so all 14 `$expose` verbs fall through their guards after unmount. A runtime `thumbnails` toggle now actually builds the thumb engine (deferred/idempotent double-schedule).
- The `useEffect` dependency for the derived-getter `$watch` on `.length` now deps on the tracked read path (the derived length) rather than the base `slides` array identity — it previously deps'd on `[props.slides]`, which could miss a length change that didn't also change array identity.
- Declared emit handlers no longer also land in the root DOM fallthrough spread — previously a consumer's handler fired twice per emit.
- The public `.d.ts` no longer types unresolved `r-for` slot-context params (`slide`/`index` on the `slide`/`thumb` render props) as callable (`() => void`) — they're now `unknown`, matching what the runtime actually hands the caller.
- Docs truth pass: the runtime-updatable contract (17 of 20 props; `startIndex`/`plugins`/`options` marked construction-only, with reasons), the five previously-missing handle verbs (`scrollProgress`/`slidesInView`/`slidesNotInView`/`previousScrollSnap`/`getPlugins`), a Slots section (`renderSlide`/`renderThumb` render props), and a filled Events table.
- No API surface change.
- @rozie/runtime-react@0.2.2

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/embla` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` on-disk numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps, not release history.

  `embla-carousel ^8.6` and `embla-carousel-autoplay ^8.6` are `peerDependencies` — the consumer installs them; nothing is bundled. There is no engine CSS to import: the carousel skeleton ships scoped and tokenised inside the component.

  The `@rozie/runtime-react` dependency now resolves to `0.2.2` (array-form `:style` merge).

  Two built-in navigation fixes are now VR-locked in this release: Embla's `slides` option is pinned to `.rozie-embla__slide` (Lit's trailing declarative-mode `<slot/>` used to be counted as a phantom slide, collapsing `scrollSnapList()` to one snap), and `selectThumb` no longer calls the Embla-8-removed `clickAllowed()`.

- @rozie/runtime-react@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-react@0.2.0
