# @rozie-ui/sortable-list-react

## 0.1.18

### Patch Changes

- c362398: The npm package now includes `CHANGELOG.md`. It was written for every release but left out of the tarball, because npm no longer adds a changelog by itself, so a behaviour change recorded there (such as the 0.7.0 combobox Ctrl/Cmd/Alt+Enter change) was invisible to anyone reading the installed package.
- Updated dependencies [c362398]
  - @rozie/runtime-react@0.9.0

## 0.1.17

### Patch Changes

- a9d67cb: Typed public surface, phase 1: a component can now declare real TypeScript types for its events, slot parameters and imperative handle, and a consumer on any target sees them instead of `any`. See the new guide, "Typed public surface".

  Four opt-in authoring features (a component that uses none of them compiles exactly as before; all are types-only, with no runtime change on any target):
  - `<types>` block: type-only statements (`import type`, `interface`, `type`, and `export` of those) hoisted into every target and re-exported from the package entry. Anything else is an error (ROZ019, ROZ020). A `<types>` import that clashes with a `<script>` import is ROZ024; an identical duplicate is dropped silently. A `<types>` name that collides with a generated name (`<Name>Props`, `<Name>Handle`, `Rozie<Name>EventMap`, slot context interfaces, …), with a name the compiled module imports (a `<components>` key, its `<Local>Handle`, or a framework / `@rozie/runtime-*` import such as `ReactNode` or `TemplateRef`, reserved on every target), or with a top-level `<script>` declaration is ROZ025.
  - `<emits>` block: `{ name: { payload?: '<type>', docs?: {...} } }`. When present it is the complete list: an undeclared `$emit` is an error (ROZ151), reported at the `$emit` call, and a declared event that is never emitted is a warning (ROZ152), reported at its `<emits>` entry. A `$emit` whose argument count does not match the declared payload is a warning (ROZ157), reported at the call. Invalid entries (including a repeated event name or `payload`/`docs` key), types and docs are ROZ021, ROZ022 and ROZ023. React and Solid get `onX?: (payload: P) => void`, Vue a typed `defineEmits`, Svelte a lowercase `onx` callback, Angular `output<P>()`, and Lit a `CustomEvent<P>` with a generated `Rozie<Name>EventMap` and typed `addEventListener`/`removeEventListener` overloads.
  - `<slot :param-types="{ row: 'Row' }">` types a slot parameter (unknown key ROZ153, malformed value ROZ154).
  - `$expose(verbs, signatures)`: a compile-time-only second argument typing the handle (unknown verb ROZ155, malformed ROZ156). The signature strings are stripped from every emitted module. A verb without a signature keeps its implementation's own types when it has them (a return-type annotation or an annotated `const`, in `<script lang="ts">`) on every target; only a fully untyped verb is `(...args: any[]) => any`.

  Also in this release:
  - The component manifest (`rozie-manifest.json`) is schema v2 and carries emit payloads, expose signatures, the `<types>` text and slot `:param-types`. The reader still accepts v1, so composing an already-published v1 package keeps working. Composing a package whose leaves ship a v2 manifest (`@rozie-ui/popover`, `@rozie-ui/combobox`, …) from your own `.rozie` requires `@rozie/*` at or above this release; a compiler that is too old now says so in ROZ988 (upgrade the toolchain) instead of advising a reinstall of the primitive.
  - `.d.rozie.ts` sidecars now carry `<types>` and type slots and events exactly as each compiled module does. Apart from `<types>`, these changes apply to every component, not only to ones that use the new features: Solid `<slot>Slot` props and JSX.Element shapes; Svelte Snippet shapes and lowercase handler names; no spurious `render<X>` props on Vue, Angular and Lit (Lit declares its slot receivers on the element class instead); no `on<X>` props on Lit; and on Angular, every component with events loses its spurious `on<Event>` props, and the declared class gets typed `OutputEmitterRef<T>` outputs from the same derivation as the compiled `output()` fields (`T` is the declared payload, otherwise `void`, or `unknown` when an untyped `$emit` passes a payload). The `<Name>Handle` of an `$expose` component now keeps the type of a verb declared as an annotated `const` (`const add: AddFn = …`) instead of `(...args: any[]) => any` (or the implementation's own signature). A Solid scoped default slot now accepts a function child.
  - Text such as `<script`, `<style`, `<title` or `<textarea` inside a `<types>`, `<emits>`, `<props>`, `<data>`, `<listeners>` or `<components>` body (in a comment, a docs string, or a generic like `Array<Style>`) no longer desynchronises the block splitter. Those bodies are now opaque to the HTML tokenizer.

  Untyped-handler convergence (the one planned typing change for components that do not opt in; the sidecar fixes above reach them too): an untyped event handler is now `(...args: any[]) => void` on every target. The shared `.d.ts` sidecar, Solid and Svelte used to emit `unknown[]`, which rejected handlers written with a concrete parameter type; React already used `any[]`. The generated sources of the Solid and Svelte leaves (and the React `.d.ts`) change accordingly, hence the patch bumps. `@rozie-ui/sortable-list-solid` and `@rozie-ui/switch-solid` also pick up the scoped-default-slot function-child fix.

  `@rozie-ui/popover-*` and `@rozie-ui/fullcalendar-*` adopt the features and are bumped minor, because typed events can reject a previously accepted wrong-typed handler:
  - popover: the `anchor` slot context is typed (including the new `panelId: string`) and the handle (`show`, `hide`, `toggle`, `reposition`) is typed. Its open state's change event is the `open` model's (Lit: `open-change`, now in `RoziePopoverEventMap` as `CustomEvent<boolean>`).
  - fullcalendar: 11 typed events (for example `eventClick` with `jsEvent: MouseEvent | KeyboardEvent`, and `unselect` with `jsEvent: UIEvent | null`), 10 typed portal slot arguments and 16 typed handle verbs. The `<types>` names are re-exported from every package entry, and the package barrels re-export the handle types and Lit event maps.
  - Both families generate their README event tables from `<emits>` and no longer ship `scripts/event-manifest.mjs`.

- a9d67cb: Props types now accept the root element's HTML attributes when a component passes attributes through to a single root element (typed public surface, phase 3).
  - React: `interface XProps extends Omit<React.ComponentPropsWithoutRef<'<tag>'>, …>` — `className`, `style`, `id`, `aria-*`, `data-*`, element-specific attributes (`disabled` on a `<button>` root, …) and DOM listeners typecheck without a cast.
  - Solid: the same with `ComponentProps<'<tag>'>`.
  - Svelte: `interface Props extends Omit<SvelteHTMLElements['<tag>'], …>` replaces `[key: string]: unknown`. **This is stricter:** an attribute the root element does not support, which the old index signature accepted, is now a type error.
  - The component's own props win on a name collision. `children` stays rejected when the component has no default slot, as do the content-replacing `dangerouslySetInnerHTML` (React) and `innerHTML` / `innerText` / `textContent` (Solid).
  - An `<svg>` root gets the SVG element's attributes (`fill`, `stroke`, `viewBox`, …). Any other non-HTML root (a custom element) gets the generic `HTMLAttributes<HTMLElement>` on React and Solid, and Svelte's permissive custom-element entry.
  - Components with `inherit-attrs="false"`, an `r-if` root or a component root are unchanged. Vue, Angular and Lit are unchanged; they already accepted pass-through attributes.

  The `.d.rozie.ts` sidecars (React, Solid, Svelte) carry the same types. Types only — no runtime change.

- Updated dependencies [a9d67cb]
  - @rozie/runtime-react@0.8.0

## 0.1.16

### Patch Changes

- b084200: Declare `@rozie/runtime-*` as `workspace:^` instead of `workspace:*`.

  `workspace:*` publishes as an **exact** pin on the runtime version, so every toolchain bump forced a republish of every leaf that carried one — 76 of the 92 packages in the previous release wave had no source change at all. `workspace:^` publishes as `^<version>`, which a later patch-level runtime still satisfies, so an unchanged leaf stays valid instead of being dragged along.

  This is not a new policy: it is the caret policy already documented and applied by nine family codegen scripts ("bake the caret policy now so `workspace:*` is normalized to `workspace:^`"). It was simply never applied to the leaves whose codegen does not write `package.json`. The Svelte leaves were already fully aligned; the Vue leaves were aligned apart from three. This brings the React, Solid, Lit, and Angular leaves in line, so all six targets now state the dependency the same way.

  The `@rozie/*` toolchain packages keep `workspace:*` deliberately — they are a changesets `fixed` group and always version in lockstep, so an exact pin is correct there.

  This release still republishes these leaves, because their published `package.json` genuinely changes. The benefit is on every release after it.
  - @rozie/runtime-react@0.7.4

## 0.1.15

### Patch Changes

- @rozie/runtime-react@0.7.3

## 0.1.14

### Patch Changes

- @rozie/runtime-react@0.7.2

## 0.1.13

### Patch Changes

- @rozie/runtime-react@0.7.1

## 0.1.12

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

## 0.1.11

### Patch Changes

- @rozie/runtime-react@0.6.0

## 0.1.10

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  All three read kinds landed here:
  - **`$emit` handler props** (5) — `onAdd`, `onChange`, `onEnd`, `onRemove`, `onStart`. SortableJS callbacks are registered once at mount, so a consumer swapping a drag handler after mount previously kept getting the original called.
  - **Prop reads** (3) — `animation`, `forceFallback`, `options`. The SortableJS instance is constructed inside `$onMount`; these now read current values at construction time.
  - **Helper call** — `resolveGroup()`, so cross-list group resolution runs against current group configuration.

- No API surface change.
- @rozie/runtime-react@0.2.3

## 0.1.9

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. Declared emit handlers were also landing in the root DOM fallthrough spread and firing twice per emit — the emitter now keeps them out of it. The public `.d.ts` no longer types unresolved `r-for` slot-context params as callable (`() => void`) — they're now `unknown`, matching what the runtime actually hands the caller. No API surface change.

## 0.1.8

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.1.7

### Patch Changes

- ac09c50: Fix a keyboard hijack when an interactive element (a `<input>`, `<button>`, etc.) is rendered into a sortable row's default slot — the row's `onRowKeyDown` handler previously ran on any keydown that bubbled up to it, hijacking Space/Enter/Escape/Arrow keystrokes typed into the slotted child for lift/drop/move/cancel before the child ever saw them. Reorder keys now apply only when the row element ITSELF is focused; keystrokes originating from a slotted interactive child fall through untouched to that child. No API change, no per-target behavior divergence — the "editable row" pattern (a text input alongside drag-to-reorder) now works as expected.

## 0.1.6

### Patch Changes

- @rozie/runtime-react@0.2.0
