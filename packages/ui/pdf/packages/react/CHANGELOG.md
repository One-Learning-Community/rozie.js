# @rozie-ui/pdf-react

## 0.2.8

### Patch Changes

- @rozie/runtime-react@0.7.1

## 0.2.7

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

## 0.2.6

### Patch Changes

- @rozie/runtime-react@0.6.0

## 0.2.5

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  Two read kinds landed here:
  - **Prop read** — `autoFit`. Changing the fit mode after mount is now seen by the mount-registered fit pass.
  - **Helper call** — `applyFit()`, so the fit is applied against the current viewport/zoom state.

- The mount effect's dependency array is now honest, so the `react-hooks/exhaustive-deps` suppression is no longer emitted.
- No `$emit` handler prop was affected. No API surface change.
- @rozie/runtime-react@0.2.3

## 0.2.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. Declared emit handlers were also landing in the root DOM fallthrough spread and firing twice per emit — the emitter now keeps them out of it. No API surface change.

## 0.2.3

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.2.2

### Patch Changes

- @rozie/runtime-react@0.2.0

## 0.2.1

### Patch Changes

- Fix: in `render-all-pages` (continuous) mode, the internal scroll spy no longer fights the user's scroll. Scrolling a multi-page document previously snap-scrolled the view to whichever page had just become most-visible, so pages were skipped on momentum and the view could stick oscillating between two adjacent pages (with a secondary height jitter). The most-visible page still reflects into `page` / the `pagechange` event, but programmatic scroll-into-view now happens only on explicit navigation (`goToPage(n)` / setting `:page`), never from the observer — a timing-independent fix that is correct across all six framework targets.

## 0.2.0

### Minor Changes

- Fixes and additions from a consumer platform team dogfooding `@rozie-ui/pdf-vue` in production:

  **Fixes**
  - `src` given as a `Uint8Array` is now cloned before being handed to `getDocument()`. Previously the buffer was transferred to the PDF.js worker, detaching the caller's array — reusing the same reference (a remount, a re-render with the same `src`, a password retry) then loaded from an empty buffer and threw.
  - `workerSrc` / `standardFontDataUrl` no longer default to a hand-typed CDN version string that could drift from the `pdfjs-dist` actually installed. The default is now built from the installed engine's own `.version`, read at runtime, so it always matches.

  **Additions (additive, non-breaking)**
  - `autoFit: 'width' | 'page'` — opt-in resize-observed auto-refit, removing the need to hand-wire a `ResizeObserver` + `fitWidth()` / `fitPage()` yourself.
  - `pagerendered` event (per page: `{ pageNumber, viewport, scale, rotation, width, height }`) and a `getPageElement(pageNumber)` handle verb — a documented, stable mount point + reactive geometry for building your own per-page overlay (an annotation layer, a watermark) via your framework's native portal (Vue `Teleport`, React `createPortal`, etc.), without reverse-engineering PDF.js's internal `.textLayer` DOM. See the ["DOM contract" and "Overlaying content on a page"](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/components/pdf.md) docs sections.
  - Container `class` / `style` passthrough (already worked via Rozie's attrs fallthrough) is now documented as the recipe for opting out of the internal scroll region — no new prop needed.

  No breaking changes; all existing props, events, and handle verbs are unchanged.
