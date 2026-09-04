# @rozie/core

## 0.7.1

### Patch Changes

- 287dbf2: An emitter fix in the shared public `.d.ts` renderer closes a `TS2300` duplicate-identifier defect that shipped in the published `@rozie-ui/data-table-react` React leaf.

  **`@rozie/core`.** `src/codegen/renderPropsInterface.ts` — the framework-agnostic public `.d.ts` / `.d.rozie.ts` renderer shared by all six targets' `emitTypes.ts` — emitted one `render<Slot>` field (or `children`) per slot OCCURRENCE in `ir.slots` rather than one per DISTINCT slot name. A component that repeats the same named slot across several mutually-exclusive `r-if` render branches therefore minted a public `.d.ts` with duplicate identifiers — a hard TypeScript error, not a lint nit. Now deduped by name, first-occurrence-wins. Every per-target INLINE interface emitter already guarded this same defect class; only the shared public renderer did not.

  **`@rozie-ui/data-table-react`.** The published `0.2.8` tarball's `src/DataTable.d.ts` carried seven duplicated interface members — `renderCell`, `renderColHeader`, `renderDetail`, `renderEditor`, `renderFilter`, `renderSelectAll`, `renderSelectCell` — 14 `error TS2300: Duplicate identifier` occurrences within that file, reproducing the exact renderer defect above. Unpacking the published tarball narrows the blast radius: the duplication lives ONLY in the sidecar `src/DataTable.d.ts`; the package's actual `types` entry is `dist/index.d.mts`, which has one of each field and imports nothing but `react`, and the exports map exposes only `"."` (→ `dist`) and `"./themes/*"` (→ CSS) — `src/DataTable.d.ts` ships inside the tarball but is unreachable through the exports map and unreferenced by the type entry. This is therefore a real defect in the shipped sidecar declarations consumed by IDE and author-side tooling that reads `src/` directly, NOT a break in the ordinary consumer typecheck path (`import` resolution through `dist/index.d.mts` was never affected). This patch republishes the corrected declaration with no runtime or API change.

## 0.7.0

### Patch Changes

- 843ab40: On React, a top-level `.rozie` `<script>` object or array literal const that reads nothing
  reactive (`$props`, `$data`, a computed, or a helper) is now constructed ONCE per component
  instance, matching Vue/Svelte/Angular/Lit/Solid — instead of being rebuilt with a fresh reference
  on every render.

  Before this release, only two narrow shapes were stabilized on React: a member-mutated fresh
  instance (`new X()` / `[...]` / `{...}` later mutated via `.push`/`.add`/etc.) and a const escaping
  into an effect's dependency array. A plain object/array literal outside both shapes — the common
  "engine options" / "plugin list" pattern — silently kept a fresh identity every render, so any
  `$watch` a child component ran on that prop re-fired on every unrelated parent re-render.

  `.rozie` authors do not need to change anything — this is a compiler-side fix. A literal that reads
  anything reactive, or cites a non-stable top-level reference (a helper, a plain `let`, another
  un-stabilized const), is left byte-identical to before: only a literal PROVABLY safe to build once
  gets the new `useMemo(..., [])` wrap.

  No other `@rozie-ui/*-react` leaf package changes: across the full shipped component surface, only
  `@rozie-ui/maplibre-react`'s `PROGRAMMATIC` and `@rozie-ui/tiptap-react`'s
  `STARTERKIT_COLLISION_MAP` qualify for the new stabilization.

  **Changeset scope note.** `@rozie-ui/maplibre-react` was removed from this changeset: it is in the changeset config's `ignore` list, and changesets rejects a changeset that mixes ignored and non-ignored packages (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), which made `changeset status` — and any release run — fail outright. The maplibre leaves are deliberately unpublished, so nothing consumer-facing is lost by the removal.

- 0368a7c: On React, a `$computed` value read bare from inside a `$onMount`-registered callback now
  observes the CURRENT value instead of the first render's frozen snapshot, matching
  Vue/Svelte/Angular/Solid/Lit.

  `$computed` lowers to `const C = useMemo(() => ..., deps)`. `$onMount` lowers to a `[]`-dep
  `useEffect` by contract (mount-once). A long-lived callback registered inside that effect and
  reading `C` bare previously captured the FIRST render's value forever — even though the
  `useMemo` recomputes on every dependency change, React never re-creates a mount-once closure
  to observe the recomputation. The read is now routed through a synced ref
  (`_<C>Ref.current`), the same live-ref treatment already applied to reactive state and model
  props read from a mount body.

  `.rozie` authors do not need to change anything — this is a compiler-side fix. A computed read
  from a non-mount hook (`$onUpdate`), a locally-shadowed name, or a computed read only from the
  template is unaffected, byte-identical.

  No `@rozie-ui/*-react` leaf package requires a version bump from this change: a corpus-wide
  post-lower census (12 `.rozie` files pairing `$computed` with `$onMount`) found zero shipped
  sites that read a computed bare from inside a mount body. The three production workarounds
  this defect otherwise motivated (`FlowCanvas.portTypeOf`, `DataTable.table` /
  `refreshRowModel`, `PdfViewer`'s `$watch` hand-off) all deliberately avoid `$computed` in a
  mount-read position for independent reasons and are left unchanged.

- 4b8a209: ROZ138 (React stale-read) no longer fires when the write it would pair with the read is
  provably unreachable before that read — either because the write sits in a branch that
  `return`s/`throw`s before control can fall through to the read, or because the write and
  the read sit in mutually exclusive `.consequent`/`.alternate` arms of the same `if`
  statement. The diagnostic still fires on the genuine bug shape it was built for: a write
  inside a plain (non-returning) conditional followed by a read after the `if`, and a
  write-then-read within the same branch.

  Previously the validator's dominance test was a raw textual offset comparison with no
  branch/loop reasoning, so a write buried in a `return`ing arm or an `else`-exclusive arm
  still "dominated" every later read in the function body — even though that write could
  never actually run on the same path as the read. On the shipped `packages/ui` corpus this
  produced 24 warnings, 100% of them false positives, concentrated in the two components
  (`SortableList`, `DataTable`) that are already the most carefully engineered against this
  exact React footgun. Narrowing the analysis to two sound control-flow suppressions (still no
  general CFG — no loop-iteration reasoning, no cross-function/async-window reasoning) drops
  that count to 3, all in `DataTable`'s `clampActiveCell`, where a real (if currently harmless)
  React-vs-others control-flow divergence exists.

  `.rozie` authors do not need to change anything — this is a diagnostic-only compiler fix.
  Emitted output is byte-identical across all six targets; no `@rozie-ui/*` leaf package
  requires a version bump.

- ba42bc2: On React, Angular, and Lit, the synthesized `$portals` closure now lives at COMPONENT scope
  (React: the hook section; Angular/Lit: a private class field) instead of being declared
  inside the mount-phase lifecycle hook body. Vue, Svelte, and Solid already did the right
  thing and are unaffected in shape (Vue/Svelte additionally now declare the closure BEFORE
  the user script, matching Solid, closing a secondary TDZ hazard for a top-level invocation).

  This closes a silent parity bug: a `<script>` top-level helper reading `$portals.<name>`
  previously compiled on three targets and failed on the other three — `TS2304 Cannot find
name 'portals'` on the bundled-leaf strict typecheck, `ReferenceError: portals is not
defined` at runtime, with zero diagnostics. Three failure shapes are fixed:
  1. A top-level helper reading `$portals.<name>`, called from `$onMount`.
  2. A top-level helper reading `$portals.<name>`, with NO `$onMount` at all — previously
     the whole closure was emitted NOWHERE on React (it was attached unconditionally to the
     first mount-phase hook; no hook meant it was silently dropped).
  3. A `$portals.<name>` read from a `$watch` body — broken on all three targets, and the
     shape driving most of the corpus workarounds this closes the door on.

  React additionally synthesizes a dispose-only effect (`[]` deps) for a component that has
  portals but no mount-phase lifecycle hook at all, so portal roots still bulk-dispose on
  unmount in that shape. Angular and Lit now lower `$portals.<name>` to a `this.`-qualified
  member read (the closure is a class field, not a same-method-only `const`); the
  reactive-handle `interface ReactivePortalHandle` moved to module scope on both (a TS
  `interface` cannot live inside a class body).

  A new diagnostic, ROZ149, now flags a `$portals.<name>` reference genuinely evaluated
  during setup/render — `<script>` Program top level, a `$computed` body, a `$watch` GETTER,
  or a template binding/directive/`r-for`-iterable/interpolation — since the portal anchor
  does not exist yet at those positions on any target, even after this fix. It does NOT fire
  on an ordinary function/arrow body (the shape this fix makes correct), `$onMount` /
  `$onUnmount` / `$onUpdate` bodies, a `$watch` CALLBACK, or event handlers.

  `.rozie` authors do not need to change anything for code that already calls `$portals` from
  inside `$onMount` — a hook-scope const / class field is visible from the method that used to
  declare it, so nothing that compiled before stops compiling. Emitted output is NOT
  byte-identical for any component with a portal slot — the closure text moves and, on
  Angular/Lit, gains a `this.` qualifier — so `@rozie-ui/chartjs`, `@rozie-ui/codemirror`,
  `@rozie-ui/fullcalendar`, `@rozie-ui/maplibre`, and `@rozie-ui/rete` (the shipped leaf
  packages whose `.rozie` sources declare a portal slot) take a patch bump alongside
  `@rozie/core`.

  The workaround bridges those five packages carry to route `$portals` calls into mount scope
  (null-let bridges, a "must not be called before mount" invariant, a relocated code block)
  are now unnecessary and can be unwound at leisure as an independent, opt-in follow-up — not
  part of this change.

  **Changeset scope note.** The six `@rozie-ui/<family>` umbrella packages are `private: true` and the repo sets `privatePackages.version: false`, so listing them alone versions nothing. The published, consumer-installed artifacts are the per-framework pre-compiled leaves (`@rozie-ui/<family>-<target>`), and they carry no dependency on `@rozie/core` — a core bump does not cascade to them. Since this change rewrites their emitted source, they are bumped explicitly. `@rozie-ui/maplibre-*` is omitted deliberately: those leaves are in the changeset config's `ignore` list. `-solid` leaves are omitted because Solid already emitted the closure at component scope and its output is unchanged.

  **Why no `@rozie-ui/<family>` umbrella entries.** Those six packages are `private: true`, so changesets treats them as ignored; a changeset that mixes ignored and non-ignored packages is rejected outright (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), failing `changeset status` and any release run. Only the published, consumer-installed per-framework leaves are listed.

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

- 4888105: Angular and Lit lowered a component-state write to `this.<name>` inside a non-arrow member
  of an object literal, where `this` is the OBJECT and not the component — so the write landed
  on the object, the component never updated, and nothing was reported. Silent, zero-diagnostic,
  and only on the two class targets; React/Vue/Svelte/Solid close over the binding instead and
  were always correct.

  `redirectNestedThis` exists precisely to repair every emitter-injected `this` that would
  rebind, redirecting it to a `const __rozieSelf = this;` alias. Its guard returned early for
  any top-level non-arrow function, on the reasoning that a top-level function is a promoted
  class method whose `this` is the component. That reasoning does not hold for an object-literal
  member: a top-level `const api = { load() { … } }` is promoted to a class FIELD, so `api`'s
  members have no function parent and read as top-level, yet their `this` is `api`.

  The gap covers every non-arrow object member — method shorthand, getter/setter, and a
  function-expression property — with or without a nested callback. The arrow-property form was
  always correct, and is the reason the fix works: an arrow member of a class-field initializer
  already resolves `this` to the instance, because a field initializer's `this` is the instance
  and an arrow inherits it.

  Two changes, applied to both byte-identical target mirrors. Detection now treats
  object-literal membership as a non-component-`this` context. For the host, when the outermost
  enclosing function is itself an object member there is no function to hold the alias, so the
  field initializer is wrapped in an arrow IIFE that carries it —
  `api = (() => { const __rozieSelf = this; return { … }; })();`. An object nested inside a
  function keeps using the existing function host and emits no IIFE. The IIFE was chosen over
  rewriting methods into arrow properties because it preserves the object's own method
  semantics and is the one mechanism that also covers getters and setters, which cannot be
  arrow-converted at all.

  `$provide(...)` payloads are excluded. `emitContext.bindProvidedValue` already owns that
  seam: it wraps the payload in a host-capturing IIFE, rewrites every `ThisExpression` to a
  `__rozieCtxHost` parameter, and keys its reactivity bridge on finding those `ThisExpression`s.
  Because `redirectNestedThis` runs earlier, an unguarded fix consumed that `this` first and the
  entire reactive `effect(...)` bridge disappeared from every emitted provider — caught by
  Lit's existing context test and now locked by a dedicated case in both targets' fixtures.

  No emitted output changes. A scan of all 218 emitted Angular and Lit files in this repo found
  3497 object literals and 60 non-arrow object member functions, none of which contained a
  `this` — so the shape was latent and the whole-repo rebuild produced zero drift, with
  dist-parity 1049/1049. This closes an authorable correctness hole rather than a shipped
  defect, and no `@rozie-ui` leaf needs regenerating.

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

- 6943820: Lit and Angular dropped every leading comment on a top-level declaration promoted into
  the component class — 1370 apiece across the shipped corpus. Both emitters build each
  class member as a hand-built string (`generate(decl)` / `renderExpression` / a rebuilt
  arrow or `t.classMethod`), and none of those carries the STATEMENT's own comments, so an
  author's documentation simply vanished from the emitted component.

  Both now run a printed-comment ledger keyed on comment OBJECT IDENTITY. Identity rather
  than source offsets is load-bearing: a `.rzts` script partial is parsed as its own file,
  so its comment offsets collide with unrelated host comments. A per-branch rule cannot
  work here at all, because @babel/parser attaches a comment sitting BETWEEN two statements
  to BOTH neighbours at once — whichever side a local rule picks, the other side either
  double-prints it or drops it.

  Three properties this needed, each found by measuring the corpus rather than by reading
  code:

  **It looks back, not just down.** Each statement claims the PREVIOUS statement's
  still-unclaimed trailing comments as well as its own leading ones, rendering both above
  its member. Inline, one parse hands the same comment object to both sides, so it prints
  once. Across a `.rzts` splice boundary the successor comes from a different parse with
  nothing attached, and the previous statement's trailing side is the only place the
  comment exists. Without this the inline host printed a comment the partial-inlined host
  could not, and the partial-vs-inline byte-identity guards went red.

  **The ledger spans the import block.** A comment between the last import and the first
  promoted declaration is printed by the module-scope import generation — a separate
  printer with its own dedup set. Unseeded, 132 comments printed twice on Lit and 155 on
  Angular. Seeding from every comment merely ATTACHED to an import node over-corrected and
  lost 16, since a comment can hang off a node the block never prints; the seed is taken
  from what the block actually emitted.

  **It unclaims.** A statement can be consumed by another pass — a `$computed`, a lifecycle
  hook, a `$provide` directive — and produce no class member at all. When the flush finds
  no target it releases the claim so whichever printer does emit that statement still
  renders its comments. Claiming without emitting is how a ledger silently drops comments,
  which is strictly worse than double-printing, and this is why both targets report zero
  lost despite several statement kinds never reaching a ledger-owned array.

  Net effect: 5311 comments restored across 53 Lit leaves and 5266 across the Angular
  leaves, with ZERO comments dropped and ZERO non-comment bytes changed, plus 16
  pre-existing double-prints fixed on each target (a comment that had been emitted both at
  module scope and again inside the mount hook). Verified by parsing every file before and
  after, comparing the parser's own comment list as a multiset, and comparing
  `generate(ast, { comments: false })` on both sides — never by reading the diff.

  Emitted code is unchanged in every case; this is documentation fidelity only.

  Eighteen further Lit/Angular leaves drifted the same comment-only way but are
  deliberately absent from the front matter — dialog, lexical, listbox, maplibre,
  number-field, pagination, resizable, slider and switch (both targets) are all in
  `.changeset/config.json`'s `ignore` list, and listing an ignored package beside a
  non-ignored one makes `changeset status` fail outright.

- eebbe66: ROZ207: the id-keyed registry pair now compiles reactively, and uncovered nested `delete` is no longer silent

  **The registry pair works now.** `$data.reg[id] = spec` (register/update) and
  `delete $data.reg[id]` (unregister) — where `<data>` declares `reg: {}` — now
  lower to a reactive whole-key replace on React, Solid, Angular and Lit, and raise
  no ROZ207. Vue and Svelte already worked via deep reactivity, so the idiom is now
  correct on all six targets. This is the one real-world shape the previous covered
  subset could not reach; you no longer need to hand-write the whole-object-replace
  workaround for it.

  A dynamic index into an array-declared key (`$data.arr[i] = v` with `arr: []`) is
  covered too. The key expression must be a plain identifier, string literal or
  number literal — a call or a computed chain stays flagged, because the array
  lowering re-evaluates the key once per element.

  **Behavior change you can hit (1):** a nested `delete` on a `<data>` key that is
  NOT covered is now a compile ERROR. It previously compiled clean and was silently
  non-reactive on React/Solid/Angular/Lit — the key was removed but no re-render
  fired. The validator simply had no `delete` visitor. Newly flagged:
  `delete $data.arr[i]` on an array-declared key (deleting an array element leaves a
  hole, which is a different semantic from an immutable replace),
  `delete $data.obj.field` (non-computed), `delete $data.a.b[k]` (depth 3), a
  `delete` whose result is consumed as an expression, and a `delete` on a key whose
  declared value is not a literal object. The diagnostic carries a clone-then-delete
  hint: `const next = { ...$data.reg }; delete next[id]; $data.reg = next;`.

  **Behavior change you can hit (2):** `$data.k[0] = v` where `k`'s declared value
  is neither a literal array nor a literal object is now a compile error. It
  previously emitted an array `.map(...)` operation unconditionally, so
  `$data.obj[0] = v` with `obj: {}` shipped `{}.map(...)` — a runtime TypeError.
  An object-declared key now takes the object lowering instead, and the
  genuinely-unresolvable case fails loud rather than emitting broken code.

  **Note on semantics:** a dynamic key written through the new object lowering
  becomes an OWN property, because the compiler emits a computed property in an
  object literal (`{ ...prev, [id]: v }`) rather than a bracket assignment. A key of
  `"__proto__"` therefore adds an own property instead of setting the prototype.
  This matches the whole-object-replace workaround this shape supersedes, and is
  strictly safer than the in-place bracket write it replaces.

## 0.6.0

### Minor Changes

- 970c6cc: Producer-side dynamic slot names: a `.rozie` producer can now declare a slot whose
  name is computed at runtime — `<slot :name="`cell-${column.key}`">` — and consumers
  fill the resulting family with ordinary static named fills (`#cell-status`,
  `#cell-score`) that carry real, narrowed param types. All six targets (React, Vue,
  Svelte, Angular, Solid, Lit) support this. Lit additionally gains a `rozieSlots`
  record property (`Record<string, (scope) => unknown>`), closing the last remaining
  gap in slot support across the six targets; its pre-existing
  `data-rozie-params` / `observeRozieSlotCtx` light-DOM path is retained unchanged for
  the cases that don't need the record.

  (The six `@rozie/target-*` emitter packages are private workspace packages, never
  published on their own — `@rozie/core`'s emitters are what's inlined into every
  public entry point that compiles `.rozie` source: this CLI, the unplugin build-tool
  adapter, and the Babel plugin. All six targets' emit output changes with this
  release regardless of which entry point you compile through; the version bump lives
  on the public packages that actually ship it.)

  **Breaking (semantic, `<slot>` authoring only): `:name` is now reserved on
  `<slot>`.** Following Vue's own `<slot>` semantics, a bound `:name` attribute means
  "this slot's name is computed at runtime" — it no longer contributes an ordinary
  scope-param value. Concretely: if you previously wrote

  ```rozie
  <slot :name="somePresentationalValue">...</slot>
  ```

  intending `name` to be a normal scope param a consumer could destructure
  (`#mySlot="{ name }"`), that `name` param will no longer appear in the consumer's
  scope object — `:name`'s value is now read as the slot's dynamic name instead. If you
  hit this, rename the scope param to anything other than `name`
  (e.g. `:label="..."` or `:itemName="..."`). The compiler will not silently accept the
  old meaning: a `<slot :name="...">` that also declares a scope param literally named
  `name` is a hard compile error, **ROZ091**
  (`<slot :name="..."> also declares a scope param named 'name' — 'name' is reserved on
<slot> as of Phase 79 and can no longer be used as a scope-param key`).

  We audited every `.rozie` file across this repo (toolchain examples, all shipped
  `@rozie-ui` components, and every internal regression fixture) for this exact
  pattern. The blast radius is four internal regression fixtures — no shipped
  `@rozie-ui` component and no `examples/` file declares a `name` scope param on a
  `<slot>`. (One other repo-wide `:name` hit is on an `<input>` element, an unrelated
  and unaffected binding.) We're not aware of any external usage of this pattern, but
  because we can't audit code outside this repo, this ships as a **minor**, not a
  patch, specifically so it's visible in your changelog if you're bound to a caret
  range on any of these packages.

  We chose minor over major because the toolchain is still pre-1.0 (semver's "anything
  may change" allowance applies), the internal blast radius is small and already
  fixed, and no shipped component is affected — but the note above exists precisely so
  an external author who never saw this phase's internal audit still gets the warning.

  Three smaller related changes ship in the same wave:
  - **Non-identifier slot names are now legal on all six targets.** A slot named
    `cell-total` (not a valid JS identifier) used to fail to compile on some targets;
    it now compiles cleanly everywhere and routes through the same record-property
    mechanism as dynamic names. As a consequence, **ROZ127** (a slot name colliding
    with a prop name) has returned to its original, single documented meaning — it no
    longer also fires for non-identifier names, which was never its intent.
  - **A `<props>` key that collides with a target's slot-record property name
    (`slots`, `snippets`, `templates`, or `rozieSlots`) is now a hard compile error**
    with a rename hint (**ROZ095**) — previously the emitted component would have
    silently declared that identifier twice.
  - Two more new diagnostics round out the feature: **ROZ090** (a `<slot>` can't carry
    both a static `name=` and a bound `:name` at once) and **ROZ096** (a bound `:name`
    expression that fails to parse as JavaScript is now a compile error, never a
    silent `undefined` fallback).

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

## 0.5.3

### Patch Changes

- 003ed52: Angular target: consumer-side event bindings on composed component tags now resolve against the callee's declared `$emit` list, which the compiler threads onto the component-tag IR. Resolution is exact match first, then canonical match in first-declaration order, with literal passthrough when the child component never resolved. A resolved match lowers through the same public-name computation the callee's own output-declaration side uses, so the two seams cannot drift apart. This changes the compiled `(output)` binding names on component composition for direct `.rozie` compiler users and correctly serves BOTH authoring conventions at once: camel-authored emits (`$emit('rangeComplete')`, unaliased — the listener previously compiled to a dead hyphenated binding that never fired) and kebab-authored emits (`$emit('sort-change')`, aliased, the data-table / rete / command-palette convention — the public name stays the raw hyphenated string instead of being wrongly camelized).
- 003ed52: Lit target: multi-word `$emit()` names are now dispatched kebab-cased, so they actually reach the consumer's listener. Compiling a component that calls `$emit('regionIn', payload)` previously emitted `dispatchEvent(new CustomEvent('regionIn', …))` — the raw camelCase source name — while the consumer's `@region-in="…"` template binding compiled to a hyphenated `addEventListener('region-in', …)`. `addEventListener` is case-sensitive, so a multi-word emit never fired its listener; single-word names were immune by construction, which is why this went unnoticed. Both `$emit` lowering sites (script-statement position and template/listener-expression position) now kebab-case the dispatched event name using the same algorithm the Lit two-way model event path already used, so the dispatch side and the model path cannot drift apart.
- React, Svelte, and Solid targets: a kebab-spelled `aria-*`/`data-*` attribute bound on a composed component tag (`:aria-label="expr"` or plain `aria-label="str"`) now resolves against the callee's declared prop names and reaches the declared camelCase prop (`ariaLabel`), matching the behavior Angular, Lit, and Vue already had. Genuine passthrough attributes — no declared match, or a callee the compiler could not resolve — keep the existing hyphen-preserving behavior, and native DOM elements are unaffected.
- New cross-target event-name diagnostics closing the last two silent failure modes in the event-name contract: (1) ROZ997 — a component that declares two `$emit` event names differing only by kebab/camel/snake word-separator spelling (`sort-change` / `sortChange` / `sort_change`) is now a hard compile error. Such a component always compiled to broken output — React and Solid declare the same `on…` callback field twice on one props interface (a TS2300 for every strict-TS consumer) and collapse both emits onto one callback at runtime, while a kebab/camel pair also declares duplicate Angular `output()` class fields (invalid TypeScript) and colliding Lit dispatch names — so rejecting it is a fix, not a tightening; settle on one spelling. (2) ROZ998 — a listener bound on a composed component tag that names an event the resolved child does not declare (neither exactly nor by kebab/camel equivalence) now warns, with a did-you-mean suggestion and the child's declared event list. Native DOM events stay silent (`@click` on a component tag is legitimate — a ~95-name allowlist sourced from the MDN / UI Events event references), as do the Rozie runtime's own `keynav-*` events. A child the compiler could not resolve stays silent, exactly as before.

## 0.5.2

## 0.5.1

### Patch Changes

- Solid emitter fix: `@event` handlers now correctly rewrite a destructured reactive-portal slot-scope parameter. A component consuming a slot scope shape like `#linkEditor="{ setLink, unsetLink, close }"` and wiring `@click="unsetLink()"` previously emitted a bare, un-rewritten `unsetLink` identifier on the Solid target — a runtime `ReferenceError`, since `unsetLink` is only in scope as a property of the slot-scope render-prop argument, not as a free variable. Every other Solid attribute-expression path (bindings, interpolations, spreads) already rewrote such a parameter to the scope accessor; event handlers were the one code path that did not.

  `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin` all bundle `@rozie/core`'s compiler and therefore carry this fix too, even though none of their own source changed.

## 0.5.0

### Minor Changes

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

## 0.4.0

### Minor Changes

- `r-keynav`'s tabindex focus model no longer steals DOM focus or scrolls on a
  cold page load, or on any mount/re-appearance while focus sits on an
  unrelated element elsewhere on the page. Previously the first focus/scroll
  pass after mount (or a conditionally-rendered `r-if` root re-appearing)
  always ran unconditionally, which could yank keyboard focus into a
  just-mounted component even though the user was never interacting with it.

  The new rule is strict component containment: the guarded first/redundant
  pass only focuses and scrolls when DOM focus is already somewhere inside the
  owning component's rendered subtree (not merely "somewhere on the page").
  Arrow-key navigation and every other active-index change are completely
  unaffected — they still focus and scroll unconditionally, exactly as
  before.

  `@rozie/runtime-keynav-core` exports the shared containment predicate
  (`focusIsWithinScope` plus its `composedActiveElement`/`composedContains`/
  `documentHasRealFocus` building blocks) that every target implementation
  calls, so the semantics can never drift between React, Vue, Svelte, Solid,
  Lit, and Angular. React, Vue, Svelte, and Solid thread an additive, OPTIONAL
  runtime option — `getFocusScope` — through to the predicate; Lit derives its
  scope from `this.host` and Angular from an injected `ElementRef`, so neither
  needs the extra field. **Compatibility contract:** a previously-published
  leaf calling this runtime WITHOUT `getFocusScope` (i.e. not yet regenerated)
  degrades to the OLD document-scoped fallback rather than the old
  unconditional-focus behavior — never the reverse, and never a hard
  rejection.

  This release also folds in a drill-continuity fix: a component-internal
  transition that destroys the currently-focused element as part of the same
  render that resolves a sibling attachment's guarded pass (date-picker's
  months → days Escape exit is the concrete case) is treated as "still within
  scope" for a short, bounded window after the removal, so keyboard focus
  correctly lands back on the resolved item instead of falling to `<body>`.
  That window is chained across three animation frames rather than one,
  specifically so it survives a sibling consumer's own
  `requestAnimationFrame`-deferred value resolution (needed on React and
  Solid, whose effect/DOM-commit ordering can otherwise clear the window one
  frame too early — see `@rozie/runtime-keynav-core`'s `focusGuard.ts` module
  doc comment for the full mechanism).

  `@rozie/runtime-lit` additionally ships a previously-unreleased fix
  (`963233d1`): a multi-root `KeynavController` (multiple independent
  `r-keynav` groups sharing one shadow root, e.g. date-picker's day/months/
  years panels) no longer lets an inactive group's controller steal focus
  onto a different, currently-visible group's item at the same
  `data-rozie-keynav-item` index, and a group's root re-appearing with an
  unchanged active index is correctly re-focused instead of silently
  dropped.

  `@rozie/core`, `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin`
  bump because the compiler's five target emitters (bundled into `@rozie/core`
  and, through it, into the other three toolchain packages) now emit the
  `getFocusScope` wiring — one minted ref per top-level template element for
  the four fragment targets, an injected `ElementRef` host reference for
  Angular — alongside every `r-keynav` root's opts object.

## 0.3.2

### Patch Changes

- **Fixed (React, 3 seams) — `$onMount` staleness.** A callback registered inside `$onMount` runs once, but it used to close over the values present on the FIRST render and keep reading them forever. Three read kinds are now mirrored through synced refs so the mount-registered callback stays live:
  - **Prop reads** — `$props.x` read inside `$onMount` now resolves through a synced ref.
  - **Helper calls** — a `<script>` helper invoked inside `$onMount` now resolves through a synced ref, so the helper's own captured state is current at call time rather than at mount time.
  - **`$emit` handler props** — the emitted `on<Event>` prop read inside `$onMount` is mirrored too, so a consumer that swaps handler identity after mount actually gets called. This is what makes engine-callback components (rete, fullcalendar, embla, flatpickr, sortable-list) deliver events to the CURRENT handler.

  Because the emitted `useEffect` dep array is now honest about what it reads, the accompanying `// eslint-disable-line react-hooks/exhaustive-deps` suppression is no longer emitted on the mount effect.

- **Fixed (React + Solid, 4 seams) — component-tag prop delivery.** Props addressed to a CHILD COMPONENT are no longer renamed through the DOM attribute map. The map exists to translate authored attribute names to their DOM/JSX spellings on native elements; applying it to a component tag silently renamed — and therefore dropped — props the child had actually declared (`readonly`, `tabindex`, `for`, and friends).
  - `r-bind` with **literal** keys on a component tag (React + Solid).
  - `r-bind` with **dynamic** keys on a component tag (React + Solid). The dynamic path routes through the new `normalizeComponentAttrs` runtime helper, which strips the same prototype-pollution key set as `normalizeAttrs` but does **not** apply the DOM alias table — so the security strip survives on every tag kind. No security regression.
  - Solid `:attr` bindings on a component tag are likewise no longer remapped.

- **Fixed:** `reservedNames` — `normalizeComponentAttrs` is now reserved on Solid, so an author `<data>` key cannot shadow the auto-injected bare-name runtime import.

The target emitters are bundled into `@rozie/core` and inlined into `@rozie/cli`, `@rozie/unplugin` and `@rozie/babel-plugin` — every fix above changes emitted output for every consumer compiling through any of those entry points.

## 0.3.1

### Patch Changes

- **Fixed:** slot params that resolve to a script function are typed callable again (`(...args: any[]) => any`), reversing the 0.3.0 regression that typed documented render-prop callbacks (`toggle`, `retry`, `setFilter`, …) as `unknown` in the published `.d.ts`. `r-for` loop vars correctly remain `unknown` — that half of the 0.3.0 change was right and is unchanged. (`inferParamType`/`renderPropsInterface` — consumed by all six targets' `emitTypes.ts`.)
- **Fixed:** Lit no longer swallows a static `key="…"` attribute — the strip is now narrowed to the binding form (`:key="expr"`), matching the Svelte/Angular filter shape. A bound `r-for` loop key is still consumed by `repeat()`'s key function, never emitted as a DOM attribute.
- **Fixed:** Lit derived-`$watch` NaN comparison now matches React (`Object.is`) — a NaN-valued derived getter no longer re-fires the watch callback on every cycle the base prop's setter ran.
- **Fixed:** Lit `:class` bound to a null-defaulted prop drops the attribute instead of rendering `class="null"`, matching React/Vue.
- **Added:** `ROZ209` — an `$emit` event name that cannot lower to a valid JS identifier (e.g. `update:foo`, `a.b`) is now a compile error, with a hint pointing two-way-binding authors at a `model: true` prop instead of Vue's `update:x` convention.
- **Note (0.3.0 behavior change, documented late — no further behavior change in this release):** React `$watch` dep arrays for a derived member-chain getter now evaluate the getter's chain eagerly, including on first render — crash-parity with Vue/Solid/Svelte/Angular. See the [`$watch` guide](https://github.com/rozie-js/rozie/blob/main/docs/guide/features.md#watch-getter-cb--react-to-value-transitions) for the consumer-facing note.

## 0.3.0

### Minor Changes

- Add the `$memo(fn, keyFn)` core primitive for memoizing an expensive derived computation against an explicit dependency key, plus the `ROZ146` misuse diagnostic (rejects `$memo` calls that don't fit the `(fn, keyFn)` shape). The cache is strict-null-safe — a `null`-keys sentinel plus a locally-captured, property-cast cache shape so a `null`/`undefined` key never collides with "no cache yet".
- Add the `ROZ147` Lit inherited-DOM-property prop-name validator, which rejects a Lit-targeted prop name that collides with a property Lit's base `ReactiveElement`/`HTMLElement` already defines (shadowing hazard). The `ROZ142` known-safe corpus (already-vetted DOM-method-shaped prop names) is exempted so existing components don't regress.
- Retire `ROZ144` — array-form `:style` (`:style="[{color},{fontSize}]"`) is now uniformly supported across every target, including the Angular `[attr.style]="__rozieMergeStyle(...)"` merge path and the react/solid/lit/svelte runtime normalizers. What was previously a hard compile error is now a supported author pattern.
- Narrow `ROZ207` to exempt the covered nested-`$data` subset (a `$data` object literal whose nested member is read-and-written in the same tick), with reactive lowering for that subset on react, vue, svelte, solid, angular, and lit — previously this shape either mis-lowered or was rejected outright depending on target.
- Scope `ROZ208` down to `$refs`/`$slots` sigils specifically inside `<data>` initializers, with per-target data-init sigil lowering on all six targets (angular/lit lowered first, then react/vue/svelte/solid) — other `<data>` initializer shapes that were incorrectly caught by the old, broader `ROZ208` now compile.
- Synthesize Lit slot scope-param types via a shared helper rather than leaving them typed as `unknown`.
- Rewrite the Angular `new URL(lit, import.meta.url)` pattern to a hoisted `?url` import — `import.meta.url` breaks Angular AOT (`project_angular_aot_no_import_meta_url`), so the emitter now avoids emitting it at all.
- Dedup the last-import / hoisted-type-decl boundary comment (previously duplicated onto both the last top-level import and the first hoisted type declaration) and the vue/svelte splice-seam boundary dedups (after-side + leading splice, entangled trailing splice) that produced duplicate or malformed seams in some `<script>` rewrite shapes.
- **This series' 8 emitter seam fixes**, closing gaps found while regenerating the `otp`/`embla` leaves and auditing their neighbors:
  - React: map `autocorrect` correctly (was dropped/miscased) and keep `spellcheck` native-cased on Solid.
  - React + Solid: keep emit-handler props (`onChange`/`onComplete`-style) out of the root DOM fallthrough spread — previously a declared emit handler landed in both the direct prop call and the attrs/rest spread, firing every consumer handler twice.
  - Lit: drop a nullish attribute for a nullable provably-primitive prop read instead of rendering the literal string `null` through the attribute binding.
  - Lit: strip `r-for` loop keys from the emitted element instead of leaking them as literal DOM attributes.
  - React + Lit: dep a derived-getter `$watch` on its tracked read path, not the base prop's identity, so the watcher actually fires on the value it derives from.
  - React: stop typing unresolved `r-for` slot-context params as callable (`() => void`) in the emitted public `.d.ts` — they're now `unknown`, matching what the runtime actually hands the caller.
  - Angular: the same nullish-attribute-drop fix as the Lit case, applied to Angular's `[attr.*]` property-binding path.

  The target emitters are bundled into `@rozie/core` and inlined into `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin` — every one of these fixes changes the emitted output for every consumer compiling through any of those entry points.

## 0.2.1

### Patch Changes

- c279a7e: Fix the `@rozie/target-lit` emitter's `$attrs` auto-fallthrough skip-list to always exclude the reserved `data-rozie-ref` attribute (compiler bookkeeping, never a consumer prop). Without this fix, a parent-assigned `ref=` on a compiled Lit component's own host tag could clobber that component's own internal `data-rozie-ref` markers via attribute fallthrough re-application. The Lit emitter is bundled into `@rozie/core` (and therefore inlined into `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin`, all of which compile `.rozie` through core) — this patch corrects the emitted Lit output for every consumer compiling through any of those entry points.

## 0.2.0

### Minor Changes

- 364f4c5: Add the `r-portal="<container-expr>"` element-level teleport directive. Distinct from the pre-existing `<slot portal />` slot-content-INTO-container primitive (`$portals.NAME(...)`, untouched by this change): `r-portal` relocates an ORDINARY template element's own rendered subtree OUT to a container the expression resolves to, using each target's native teleport construct — React `createPortal`, Vue `<Teleport :to :disabled>` (emitter-only; authors still cannot write `<Teleport>` directly, `ROZ926` gates author input only), Solid `<Portal>` under `<Show>`, a new Svelte `roziePortal` action (`@rozie/runtime-svelte`), an AOT-safe Angular `effect()`/`viewChild()` field pair, and a new Lit `RoziePortalController` ReactiveController (`@rozie/runtime-lit`) driving a cached `@query(..., true)` ref.

  A falsy container expression renders the subtree in place — byte-behavior-identical to omitting the directive — so a consumer-facing `appendTo`-style prop can safely default off with zero churn for existing consumers.

  Three new diagnostics (`ROZ990`–`ROZ992`) reject `r-portal` on a `<slot>` (redirect to the boolean `portal` attribute), on a `<components>`-registered child component (v1 limitation — only plain/host elements may portal), and with an empty value.

  Lit is the one target with a real correctness gap to close: `static styles`' shadow-scoped CSS never reaches a light-DOM-relocated element, so the Lit emitter now also pushes the component's own scoped CSS through the existing `injectGlobalStyles` sink whenever `r-portal` is in use — the relocated element already carries the component's scope attribute, so the globally-injected rules match only that component's own elements.
