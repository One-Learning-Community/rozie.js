# @rozie-ui/combobox-lit

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

- @rozie/runtime-lit@0.7.1

## 0.4.6

### Patch Changes

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

- Updated dependencies [dcc3336]
  - @rozie/runtime-lit@0.7.0

## 0.4.5

### Patch Changes

- @rozie/runtime-lit@0.6.0

## 0.4.4

### Patch Changes

- Stale-publish reconciliation: republish so the tarball matches the committed generated source. The sole drift was a documentation-comment correction in the generated component source (removal of a stale "byte-identical to today" claim from the groupCap prose) that landed without a version bump. No behavioral change.
  - @rozie/runtime-lit@0.5.2

## 0.4.3

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
  - @rozie/runtime-lit@0.5.0

## 0.4.2

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. A nullable attribute bound to a null-valued primitive prop read is now dropped instead of rendered (previously the literal string `null` could render through the attribute binding). `r-for` loop keys are no longer leaked as literal DOM attributes on emitted elements. No API surface change.

## 0.4.1

### Patch Changes

- c279a7e: Fix the `$attrs` auto-fallthrough skip-list to always exclude `data-rozie-ref` — a reserved compiler bookkeeping attribute, never a consumer prop. Previously a parent-assigned `ref=` on this component's own host tag could clobber the component's own internal `data-rozie-ref` markers via fallthrough re-application. No API change, no per-target behavior divergence.
- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.4.0

### Minor Changes

- afa0a7e: The `virtual` prop is now **live-flippable at runtime**. Previously the TanStack windowing engine was constructed exactly once in `$onMount`, so a runtime `false→true` flip rendered a blank popup and a `true→false` flip left a live `ResizeObserver` (and stale windowing state) behind.

  `buildVirtualizer()`/`teardownVirtualizer()` now share the single construction site `$onMount` also calls, wired to a new lazy watch on `virtual`: flipping to `true` (re)builds the windowing engine (rAF-deferred so the windowed popup has mounted its scroll container first) and resets any expanded-group state; flipping to `false` tears it down immediately, disconnecting the `ResizeObserver` — fixing the leak. During the brief mid-flip frame (virtual on, engine not yet attached) the popup renders the un-windowed full option list rather than going blank.

  No prop/model/emit/slot/expose surface change — `virtual` already existed. A `virtual:false` combobox that never flips it, and a `virtual:true`-at-mount combobox that never flips it back, both render byte-identically to before.

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0

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
