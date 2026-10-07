# @rozie-ui/combobox-solid

## 0.8.0

### Minor Changes

- 8053803: Free-text (token input) follow-ups, from a Gmail-style recipient field.

  Fixes:
  - A paste split on `delimiters` no longer discards the text already in the input. The parts `validate` rejects are now inserted at the caret, replacing the selection, as an ordinary paste would be. Typing `ann@` and pasting `corp.com, bob@x.test` leaves `ann@corp.com` in the input and adds `bob@x.test`; it used to leave `corp.com`.
  - `search` now fires whenever the input text changes, not only on keystrokes. It fires with the resulting text after a paste Combobox handles itself, and with `{ query: '' }` whenever Combobox clears the input itself: a pick or create under `multiple`, a free-text commit and `clear()`. A free-text commit of a value that is already selected clears the input but fires no `change`, so a host that tracked the query through `search` used to keep offering suggestions for text that was gone.
  - `idBase` now defaults to `''`, and each instance generates a unique id base after mount (`rozie-combobox-<n>`). Two comboboxes left at the default used to share their listbox and option ids, and every combobox's popup shared the panel id `rozie-popover-panel`. An explicit `idBase` is used as before.

  New:
  - `validate` may return the string to store, the same shape as Tags' `validate`. Return a string to store it (for example the bare address from `Sam Roe <sam@x.test>`), `true` to store the text as typed, or a falsy value to reject. Boolean validators behave as before. `change.text` is the stored string.
  - `splitPaste: (text) => string[] | null` replaces the built-in paste split. Return the parts to commit, or `null` to leave the paste to the browser. Use it for syntax a delimiter split cannot know, such as `"Roe, Sam" <sam@x.test>`.
  - `commitOnBlur` (default `false`) commits the typed text when the input loses focus, through `validate`.
  - `query()` on the handle returns the current input text.

  `splitPaste` and `commitOnBlur`, like `validate`, turn free-text commits on.

### Patch Changes

- c362398: The npm package now includes `CHANGELOG.md`. It was written for every release but left out of the tarball, because npm no longer adds a changelog by itself, so a behaviour change recorded there (such as the 0.7.0 combobox Ctrl/Cmd/Alt+Enter change) was invisible to anyone reading the installed package.
- Updated dependencies [c362398]
  - @rozie/runtime-solid@0.9.0

## 0.7.0

### Minor Changes

- a9d67cb: Token-input support (from a Gmail-style recipient field built on `multiple` + `disableFilter`). Every new prop is off by default.
  - **`block`** fills the container (the root, the input and the width-matched list stretch to 100%).
  - **`chipLayout="inline"`** puts the chips and the input on one wrapping row, as Tags does (default `'stacked'` keeps the chips above the input).
  - **`disableOpenOnFocus`**: focus no longer opens the list; typing and the arrow keys still do.
  - **`hideEmpty`**: with no options and no create row to show, no popup is shown, `aria-expanded` stays `false`, and Escape is left to the host.
  - **Free text** (`multiple` only), named after Tags: **`delimiters`** (e.g. `[',', ';']`) commit the typed text, a paste containing a delimiter adds every part, and when free text is on, Enter with nothing highlighted commits too. **`validate(text) => boolean`** gates every free-text commit. A commit appends the text to `value` and fires `change` with `option: null` and a new `text` field.
  - **`selectOnTab`**: Tab picks the highlighted option (it only keeps focus when it picked). The handle gains **`activeOption()`**, the highlighted source option or `null`.
  - **Typed surface:** `search`, `change` and `create` payloads, every slot context and the handle are typed, and the types are exported (`ComboboxChangePayload`, `ComboboxChipSlotCtx`, …). Handlers typed against the payloads can now reject a wrong-typed handler that used to compile.

  Fixes:
  - **Behaviour change:** Enter with Ctrl, Cmd or Alt held no longer picks the highlighted option (0.6.0 picked it). The key is left to the host, so a Ctrl+Enter send shortcut is not doubled. If you relied on modified Enter picking, handle it yourself with `activeOption()`.
  - Keys pressed while an IME composition is in progress are ignored (the Enter that confirms a composition no longer picks).
  - Escape is consumed only when a list is actually visible.
  - The custom `chip` slot's `remove()` returns focus to the input, like the built-in remove button.
  - Angular: the input's native `change` event no longer bubbles into a consumer's `(change)` binding.

### Patch Changes

- a9d67cb: Accept `@rozie-ui/popover-<framework>` 0.3 as a peer dependency, alongside the 0.2 range (and, for data-table, the 0.1 range). Popover 0.3 adds the `reference` prop; the popover features these components already use are unchanged.
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
  - @rozie/runtime-solid@0.8.0

## 0.6.0

### Minor Changes

- 4f2148d: Two virtualization correctness fixes, shared with `@rozie-ui/listbox`, plus this release's
  theming fix and a token removal.

  **Fixed: a virtual list scrolled to the end now actually stays at the end.** With
  variable-height options, a scroll-to-end pin was being overwritten mid-`ResizeObserver`-batch by
  virtualizer writes computed from a stale offset, and browser scroll anchoring could independently
  move `scrollTop` when the leading spacer's height changed — both looked identical to "the user
  scrolled away" and cleared the pin. Measured before the fix: the last option was cut off by up to
  126px depending on target. Fixed the same way in both hosts.

  **Fixed (N-05): the option remeasure sweep now waits for the recycled virtualization window to
  actually commit** before handing rendered options to `measureElement`. React and Angular commit
  their recycled window one tick later than the other four targets; with variable-height options,
  the previous single-`requestAnimationFrame` sweep could measure the _old_ window and only catch
  up on virtual-core's own 150ms idle tick — visibly moving the list after the user had already
  seen it. The sweep now re-checks coverage and re-runs (bounded) until the committed options match
  the virtualizer's current window.

  **Theming — design-system bridges now yield to an ancestor's own tokens, and apply correctly on
  Lit.** Same fix as every other themed family in this release — see the `@rozie-ui/data-table`
  changeset in this release for the full description of the bridge-scoping defect and its fix.

  **BREAKING (if you set it) — the `--rozie-combobox-list-z` token is removed.** It has had no
  effect since the popup moved into the composed `@rozie-ui/popover` leaf (an earlier release):
  the popup's stacking is controlled by `--rozie-popover-z` (default `1000`) instead. If you were
  setting `--rozie-combobox-list-z` to control the popup's stacking order, set `--rozie-popover-z`
  in the same scope instead.

  **Solid packaging.** `@rozie-ui/combobox-solid` ships the same compiled-JS-by-default,
  JSX-under-the-`solid`-condition packaging shape as every other published Solid leaf this release
  — see the dedicated Solid packaging changeset for the full description. No API change.

### Patch Changes

- 4f2148d: Packaging fixes bundled with this release:
  - the generated README's `## Slots` table listed some slots more than once — once per internal template branch that declares the same logical slot (e.g. the virtualized vs. non-virtualized rendering path). The generator now dedupes by slot identity before rendering. Docs/packaging only; no runtime behavior changed.
  - the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/combobox-solid`, this package's own.
- 4f2148d: **Fixed: published Solid leaves now ship compiled JavaScript for `import`/`require`, with JSX
  kept only under the `solid` export condition.**

  Every `@rozie-ui/*-solid` leaf with markup previously shipped Solid JSX inside
  `dist/index.{mjs,cjs}` under a plain `import`/`require` (`chartjs-solid` renders no markup of its
  own, but ships the same corrected export shape for consistency with its siblings). That is not
  valid JavaScript on its own — a default `vite-plugin-solid` setup
  fails with "JSX syntax is disabled" (the plugin only transforms `.[mc]?[jt]sx` files), and any
  bundler without a Solid plugin fails outright. The only way to consume these packages was to
  manually point `vite-plugin-solid` at the package's `.mjs` files inside `node_modules` — a
  workaround, not a supported shape.

  New export shape (the standard one for a published Solid library):
  - `import` / `require` → `dist/<entry>.{mjs,cjs}`, compiled to plain DOM output by
    `babel-preset-solid`. Any bundler consumes this with no Solid plugin at all.
  - `solid` (export condition) → `dist/source/<entry>.jsx`, JSX kept intact. `vite-plugin-solid`
    and SolidStart resolve this condition first and compile it themselves for their own mode (DOM /
    SSR / hydration).

  **If you were using the `extensions: ['.mjs']` / `node_modules` `include` workaround with
  `vite-plugin-solid` to consume one of these packages, remove it — it is no longer needed** and a
  default `vite-plugin-solid` setup now resolves the `solid` condition correctly on its own. No
  public API change on any of these leaves.

- Updated dependencies [4f2148d]
  - @rozie/runtime-solid@0.7.5

## 0.5.3

### Patch Changes

- b084200: Solid: slot scope values are now passed as lazy getters instead of eager reads.

  A scoped slot invocation used to build its param object as `{ open: open() }`. Because that object is constructed inside the JSX insert that invokes the slot, Solid subscribed the **insert itself** to every signal read while building it — so any change re-ran the insert, re-invoked the consumer's slot function, and replaced the rendered subtree. Emitting `{ get open() { return open(); } }` defers the read into the consumer's own reactive scope, which is Solid's own convention for passing reactive props.

  Observable fix: opening the data-table column menu no longer tears the just-focused trigger out of the DOM, so the documented "Escape returns focus to the trigger" guarantee now holds on Solid as it already did on the other five targets.

  Literals and function-valued expressions are deliberately left as plain properties — neither can read a signal, and wrapping a function would hand the consumer a new identity on every property access.

  Note for consumers: destructuring a slot scope (`({ option, index }) => …`) and spreading it behave exactly as before. The one behavior change is that **assigning** to a scope property now throws `TypeError: Cannot set property x of #<Object> which has only a getter`, where it previously succeeded silently. Writing to a slot scope was never a supported pattern.

  `@rozie/core` is named here even though no file under `packages/core/` changed: the emitter lives in the private `@rozie/target-solid` package, which is bundled into core's published dist (and into `unplugin`, `babel-plugin`, and `cli`). A changeset derived from changed paths alone would ship a toolchain that still emits the bug.
  - @rozie/runtime-solid@0.7.4

## 0.5.2

### Patch Changes

- @rozie/runtime-solid@0.7.3

## 0.5.1

### Patch Changes

- 877dbdf: Data-table gains column (horizontal) windowing and content-driven auto-measure — the shared windowing engine's two remaining "what Rozie defers" bullets are closed. Combobox picks up the shared engine's new host-contract stubs as dead code, no behavior change. Command-palette republishes in lockstep, with one genuine bug fix on its Lit leaf. The compiler's inliner gets a small tree-shaking fix that this phase's own pure-helper extraction needed.

  **`data-table` — column windowing.** `virtual` widens from a Boolean to a value grammar: `false` (default, unchanged) | `true` / `'rows'` (unchanged from before — every existing consumer is untouched) | `'columns'` (new: horizontal windowing) | `'both'` (new: both axes). Under column windowing, pinned columns, the active cell's column, and a single in-progress edit's column always stay rendered regardless of scroll position; every header level (including grouped headers) windows on the same slice as the body with a clamped `colSpan`; the dedicated filter row windows the same way; and `focusCell` / `getActiveCell` / `activecell-change` all resolve against the absolute (unwindowed) column index, so off-window columns stay fully addressable through the handle. Fill-drag gets edge auto-scroll on all four container edges — this also closes a pre-existing gap on the row axis, where a fill drag previously could not reach unrendered rows past the top or bottom edge of a row-windowed table either.

  Two consumer-visible consequences: `virtual='columns'` (and `'both'`) moves the `<table>` inside an `rdt-scroll` `<div>` wrapper, the same wrapper row windowing already uses; and the windowed path applies `table-layout: fixed`, so columns stop auto-fitting their content — size them via `:columnSizing`, a `<Column size>` attribute, or the resize handle. `virtual={false}` and `virtual` unset remain byte-identical to before this change; `virtual={true}` / `'rows'` remains byte-behavior-identical to today's row-only windowing.

  The `.d.ts` for `virtual` widens from `boolean` to `boolean | string` on all six leaves — a typed-surface change existing consumers with strict TypeScript will see, even though the runtime default is unchanged.

  **`data-table` — `autoMeasure`.** A new, independent `autoMeasure: Boolean` prop (default `false`). When on, the windowing engine feeds `estimateSize()` a running mean of measured row heights instead of the fixed `estimateRowHeight` seed, so `getTotalSize()` (and the scrollbar it drives) converges toward the true content total on a large table with variable-height rows, instead of staying pinned at `rowCount x estimateRowHeight` forever. The re-feed is hysteresis-gated and anchor-preserving — the topmost rendered row's position holds steady while the estimate refines, so content does not visibly lurch. `estimateRowHeight` is unchanged and un-deprecated: it remains the required first-paint seed (the very first render has zero measurements regardless of `autoMeasure`), and remains the explicit, permanent override when `autoMeasure` is off.

  **`combobox` — engine only, no behavior change.** Gains the shared windowing engine's new required host-contract one-liners (`rowsWindowed()`, `autoMeasureOn()`) preserving today's exact semantics: `autoMeasureOn()` returns `false`, so `windowing.rzts`'s content-driven-estimate accumulator stays dead code here, exactly as before. (A gap-closure during review removed five _additional_ column-axis stub declarations — `colVirtualizer`, `colsWindowed()`, `columnCount()`, `columnSize()`, `forcedColumns()` — that an earlier draft of this same patch had also added under a mistaken premise about the compiler's tree-shaking requirements; they were genuinely dead code with zero callers, verified by tracing every function combobox imports from `windowing.rzts` back to its body. Their removal is folded into this same patch bump since neither of them has shipped to npm yet — see `87-16-SUMMARY.md`.) No new props, no behavior change, regenerated dist only. (Listbox's source gets the identical mechanical `rowsWindowed()`/`autoMeasureOn()` addition, but listbox has never been published — per standing policy this repo does not version or changelog packages that are not yet on npm, so listbox is not part of this changeset; its addition ships whenever listbox itself is first published.)

  **`@rozie/core` (and the rest of the toolchain fixed group) — two compiler-level fixes surfaced by this phase.** `@rozie/target-lit` (inlined into `@rozie/core` / `@rozie/cli` / `@rozie/unplugin` / `@rozie/babel-plugin` at build time) fixes a real bug in Lit's emitted output for any `[Boolean, String]` union prop: Lit's built-in `type: Boolean` attribute converter collapses any non-null static attribute value to `true`, silently discarding a string value. `emitNonModelProp()` now emits a custom `converter.fromAttribute` for this prop shape instead. This is the SAME fix that closes `command-palette-lit`'s `appendTo` bug above — one emitter fix, two visible symptoms. Separately, this phase's own `DataTable.rozie` pure-helper extraction (moving framework-agnostic logic into colocated `.ts` helpers) surfaced a real gap in `inlineScriptPartials()`'s tree-shaking: a script partial that only re-exports a name introduced by its own plain-module import (no local declaration body) was not recognized as a valid tree-shake target, silently dropping the backing import and producing a `TS2304` in the emitted leaves. Both are compiler-level fixes; no `.rozie`-author-visible API change.

  **`command-palette` — lockstep republish, with one genuine fix.** Five of its six leaves have a byte-identical emitted diff from this phase: command-palette composes the _published_ combobox package for its own target at compile time rather than the combobox source, so the shared engine change does not reach those five leaves' bytes at all — this patch keeps them in the same release wave as their combobox peer, per the release-mechanics decision that every published leaf should ride the same windowing engine generation. The Lit leaf is the one exception with a real emitted change: its `appendTo` property's Lit `@property({ type: Boolean })` converter previously discarded a string value (`appendTo="body"`, the documented example) by coercing it to `true` via Lit's default Boolean-attribute converter — the string was silently dropped. It now uses an explicit converter that preserves `true` / `false` / a string value correctly, matching the `[Boolean, String]` union type the prop has always declared.
  - @rozie/runtime-solid@0.7.2

## 0.5.0

### Minor Changes

- f1fd891: Combobox gains multi-select, a floating-positioned popup, and creatable mode; popover gains two opt-in composition primitives; command-palette's combobox peer moves to admit the new minor.

  **`@rozie-ui/combobox` — multi-select via a widened model, not a second one.** A new `multiple: Boolean` prop (default `false`) turns the existing sole `value` model into an array of selected values — there is still only one `model: true` prop, so `[formControl]` / `[(ngModel)]` binding on Angular is unaffected. Re-selecting a selected option toggles it off; selected values render as chips in selection order through a new `#chip` scoped slot (`{ option, remove, index }`); duplicate values dedupe to one chip; a chip whose option later disappears from `options` persists, labelled by its raw value; Backspace on an empty query removes the last chip. `aria-multiselectable="true"` and per-option `aria-selected` are present on the listbox when `multiple` is on. Works across all four render branches (plain, `groups`, `groups`+`groupCap`, `virtual`).

  The `change` event payload gains a `selected` field — the direction of the toggle (`true` when a value was added, `false` when removed or after `clear()`). This is purely additive for existing single-select consumers destructuring `{ value, option }`: `selected` is simply a new property, always `true` for a single-select pick.

  **Consumer-visible DOM change under `multiple`:** selected chips render as a `<ul class="rozie-combobox-chips">` inside the composed popover's anchor content, immediately before the `<input>`, guarded solely on `multiple` — so the chip rail plus the input together become what the floating popup's `matchWidth` measures. Consumer CSS that targets `.rozie-combobox`'s direct children may need attention when opting into `multiple`; the non-`multiple` DOM shape is unchanged.

  **`@rozie-ui/combobox` — floating-positioned popup, composed rather than reimplemented.** The popup is now positioned by Floating UI through the published `@rozie-ui/popover` leaf (a new `@rozie-ui/popover-<target>` peer on all six leaves) rather than static CSS: it flips and shifts to stay on screen near a viewport edge. `placement`, `offset`, `disableFlip`, and `disableShift` forward to the composed popover. Under `inline`, a Popover is still mounted — what `inline` switches off is positioning and dismissal, via `disablePositioning` and `disableDismiss`; the list continues to render through the same composed popover as the floating mode.

  **`@rozie-ui/combobox` — creatable mode.** A new `creatable: Boolean` prop (default `false`). When committed text matches no existing option (case-insensitive, trimmed, exact label match), combobox emits a new `create` event with the query string and writes nothing to `value` — the consumer owns adding the option and updating the model. The create affordance renders last, through a new `#create` scoped slot, after all options and group sections. Composes with `multiple`.

  **`@rozie-ui/popover` — five new opt-in, gated capabilities, shipping as a MINOR.** All six leaves land on `0.2.0` in this wave. `bare: Boolean` strips Popover's own positioning wrapper output down to a minimal unstyled surface — for a composing component (like combobox's floating mode) that wants Popover's mount/dismiss lifecycle without its default chrome. `disablePositioning: Boolean` takes the panel out of Floating UI's positioning path entirely, so it participates in ordinary document flow instead of being absolutely positioned — this is what `inline` mode now relies on, and it previously had no release note at all. `keepMounted: Boolean` hides the floating panel instead of unmounting it (a one-shot position on mount, `autoUpdate` still strictly open-gated) — useful for a composed virtualizer whose scroll container must survive close/open. `matchWidth: Boolean` matches the panel's width exactly to its anchor via Floating UI's `size` middleware, width-only. `disableDismiss: Boolean` suppresses Popover's own Escape-key and click-outside dismissal listeners — for a composing component that drives `open` itself and needs to veto Popover's independent dismissal while a host sub-surface anchored to (but not nested inside) the composed control legitimately holds focus. All five default to `false`; existing click/hover/focus, non-`bare`, non-`disablePositioning`, non-`keepMounted`, non-`matchWidth`, non-`disableDismiss` consumers see no behavioral or visual change to the pre-wave 12-prop surface — verified via an additive-only `.d.ts` diff and Docker VR runs with zero unexplained baseline diffs. Three CSS rules were ADDED to support these capabilities (`--static`, `--bare`, `--hidden`); the pre-existing rule set is itself unchanged, but a reader should not infer that no rules were added at all.

  Two caveats existing consumers should know before adopting either capability: **`matchWidth` is not reversible** — there is no `$watch` and no code path that ever clears the inline `style.width` the `size` middleware writes once applied, so a consumer that toggles `matchWidth` off at runtime will see the stale width persist. And **existing `trigger="manual"` consumers DO see an emitted-DOM change**: `aria-haspopup`/`aria-expanded` were unconditional pre-wave and are now gated on a new `hasGestureTrigger()` check (`trigger === 'click' || 'hover' || 'focus'`), so a `trigger="manual"` popover no longer emits those two attributes.

  **`@rozie-ui/command-palette` — combobox peer range widens; the FILES and the COMPONENT tell two different stories.** All six leaves widen their `@rozie-ui/combobox-<target>` peer from `^0.4.0` to `^0.5.0`. A caret range on a 0.x version pins the minor, so the previous range does not admit combobox's incoming `0.5.0` — every leaf moves in this same wave or the published command-palette leaves become uninstallable against the combobox version they actually need.

  **File-truth:** zero source drift. The complete diff across all six `@rozie-ui/command-palette-<target>` leaves is six `package.json` peer lines, independently confirmed by a published-tarball audit showing all six leaves drifting on `package.json:manifest` only.

  **Component-truth:** the rendered component is not unchanged, because it composes combobox and inherits combobox's own popover composition. It now unconditionally mounts a Popover, adding `.rozie-popover-anchor` / `.rozie-popover-floating` wrapper elements to the DOM; it gains an unconditional `queueMicrotask` focus re-assertion routed through combobox's `onFocus` on all six targets; and `pinned` moves from a module-scope `let` to reactive `$data`. `command-palette` itself still uses `inline` (never floats). The command-palette audit traced all three of these and found no defect follows from any of them — noted here so a reader relying on "peer range only" does not miss real, if inert, DOM and behavior changes.

### Patch Changes

- @rozie/runtime-solid@0.7.1

## 0.4.5

### Patch Changes

- @rozie/runtime-solid@0.7.0

## 0.4.4

### Patch Changes

- @rozie/runtime-solid@0.6.0

## 0.4.3

### Patch Changes

- Stale-publish reconciliation: republish so the tarball matches the committed generated source. The sole drift was a documentation-comment correction in the generated component source (removal of a stale "byte-identical to today" claim from the groupCap prose) that landed without a version bump. No behavioral change.
  - @rozie/runtime-solid@0.5.2

## 0.4.2

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The `splitProps` skip-list now correctly excludes emit-handler props from the root DOM fallthrough spread — previously a consumer's handler fired twice per emit. No API surface change.

## 0.4.1

### Patch Changes

- @rozie/runtime-solid@0.2.1

## 0.4.0

### Minor Changes

- afa0a7e: The `virtual` prop is now **live-flippable at runtime**. Previously the TanStack windowing engine was constructed exactly once in `$onMount`, so a runtime `false→true` flip rendered a blank popup and a `true→false` flip left a live `ResizeObserver` (and stale windowing state) behind.

  `buildVirtualizer()`/`teardownVirtualizer()` now share the single construction site `$onMount` also calls, wired to a new lazy watch on `virtual`: flipping to `true` (re)builds the windowing engine (rAF-deferred so the windowed popup has mounted its scroll container first) and resets any expanded-group state; flipping to `false` tears it down immediately, disconnecting the `ResizeObserver` — fixing the leak. During the brief mid-flip frame (virtual on, engine not yet attached) the popup renders the un-windowed full option list rather than going blank.

  No prop/model/emit/slot/expose surface change — `virtual` already existed. A `virtual:false` combobox that never flips it, and a `virtual:true`-at-mount combobox that never flips it back, both render byte-identically to before.

### Patch Changes

- @rozie/runtime-solid@0.2.0

## 0.3.0

### Minor Changes

- 564ed59: Per-group result cap with an expand-in-place "+N more" affordance — new
  `groupCap` prop + `#groupMore` slot.

  Set `groupCap` alongside `groups` to cap each native section to its first
  `groupCap` options; an overflowing section renders a keyboard-reachable
  "+N more" row after its capped options. Activating the row (Enter while it
  is the active-descendant, or a click) expands **that section only**, in
  place — the remaining options render inline and the row disappears. It never
  writes the `value` model or fires `change`; expansion is purely a reveal.
  `ArrowDown`/`ArrowUp` rove onto the more-row like any option and, once
  expanded, continue into the newly-revealed options — `aria-activedescendant`
  always resolves to a rendered row. Expansion state resets whenever the
  option set or the typed query changes.

  New slot `groupMore` (scope `{ group, hidden, expand }`) customizes the
  more-row's markup; the default fill renders `+{hidden} more`.

  `0`/absent (default) is uncapped and byte-identical to plain grouping.
  `groupCap` only applies to the standard (non-`virtual`) grouped render, same
  as `groups` itself.

- 99fee43: Added a `pinOpen(boolean)` imperative handle verb. While pinned, blurring the
  input (e.g. because a host sub-surface like an action flyout took real DOM
  focus) no longer collapses the result popup — `onBlur()` early-returns while
  pinned. `pinOpen(false)` only unpins; it does not itself close the popup or
  restore focus, which stays the host's responsibility.

  Additive and render-neutral: never calling `pinOpen` leaves behavior
  byte-identical to before this release.

### Patch Changes

- d3782ef: Three additive, render-neutral tokens (every fallback replicates today's
  rendered value, so a consumer who never sets these sees no change):
  - `--rozie-combobox-focus-border-color` — the input's `:focus` border color,
    decoupled from `--rozie-combobox-accent` (which also colors the selected
    option), so a host can neutralize the focus border independently.
  - `--rozie-combobox-input-underline` — a bottom-border longhand that
    survives the `:focus` `border-color` override, letting a host render a
    persistent bottom divider (blurred and focused) without a full border.
  - `--rozie-combobox-group-heading-margin-top` — top margin above each group
    heading, for separating the leading ungrouped block from the first
    labeled section.

  Landed alongside `@rozie-ui/command-palette`'s style polish, which drives
  these tokens from its panel scope for a clean, borderless, ring-free input.

- f3e1bdf: fix: keep the active option scrolled into view during keyboard navigation in non-virtual lists

  Arrow-key navigation in a plain (non-`virtual`) popup previously moved
  `activeIndex`/`aria-activedescendant` but never scrolled the option list
  container, so the active option could walk out of view in a long list
  taller than the popup's max-height (visible in `@rozie-ui/command-palette`'s
  longer command lists). `scrollActiveIntoView()` now also resolves the active
  option element and calls `scrollIntoView({ block: 'nearest' })` on it when
  not windowing. The `virtual` (windowed) path is unchanged — it still routes
  through the virtualizer's `scrollToIndex`.

## 0.2.0

### Minor Changes

- 55b41c5: Add first-class, opt-in option grouping to `Combobox`.

  **Native option grouping:** options gain an optional `group?: string` field,
  and a new ordered `groups` prop (`[{ id, label }]`) sets section order +
  heading text. When grouping is active, the popup listbox restructures into
  semantic `role="group"` blocks with `aria-label` headings — a new
  `#groupHeading` slot (scope `{ group }`) lets you customize heading
  rendering; the default renders `group.label`. A group id present on an
  option but absent from `groups` falls back to a section titled with the id
  itself, appended after the listed ones (first-appearance order); options
  with no `group` render in a single leading, unheaded section.

  Grouping is a **stable re-partition** of the filtered option list — within
  every section, options keep their filtered/scored order (never re-sorted).
  The keyboard model (`ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter`,
  `aria-activedescendant`) is unchanged: it walks the same group-ordered flat
  sequence, so on-screen order always matches keyboard order, and headings are
  never a keyboard stop.

  **Leaving `groups` empty (and no option carrying `group`) is byte-identical
  to today's flat, ungrouped combobox** — grouping is strictly additive and
  opt-in; no behavior changes for existing consumers, including
  `@rozie-ui/command-palette` and `@rozie-ui/data-table`, which vendor this
  combobox but do not yet pass `groups`.

  Grouping is supported only in the standard (non-`virtual`) render;
  `groups` × `virtual` windowing is not yet supported. Per-group item caps
  ("+N more") and `@rozie-ui/command-palette` adoption of `groups` are planned
  follow-ons, not included here.

- 458db46: Add a `seedQuery(text)` imperative handle verb to `Combobox`.

  `seedQuery` sets the combobox's internal input text (and therefore the
  filtered option list, which reads the same state) without touching the
  `value` model or selection state, and without opening the popup or emitting
  `change`/`search`. It is deliberately **imperative-only** — combobox's sole
  `model: true` prop stays `value` (a second model would forfeit the Angular
  `ControlValueAccessor`, ROZ125).

  Obtain it through each framework's native ref mechanism, alongside the
  existing `focus` and `clear` verbs:

  ```js
  $refs.combobox.seedQuery("cherry pie");
  ```

  A small, additive prerequisite for `@rozie-ui/command-palette`'s planned
  levels/restore-on-pop feature (repopulating the input's text when a consumer
  navigates back to a prior level) — not itself a `@rozie-ui/command-palette`
  or `@rozie-ui/data-table` behavior change. **Fully additive and
  render-neutral:** with `seedQuery` never invoked, `Combobox`'s default render
  and every compiled leaf's emitted output are unchanged.
