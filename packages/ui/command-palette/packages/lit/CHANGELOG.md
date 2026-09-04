# @rozie-ui/command-palette-lit

## 0.4.6

### Patch Changes

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
  - @rozie/runtime-lit@0.7.1

## 0.4.5

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

## 0.4.4

### Patch Changes

- Fix the second Escape after popping a level being silently dropped ~1-in-6 of the time. `reopenComboboxPopup()` used to blur focus to `<body>` for the gap between the pop and its refocus; a keydown landing there never reached the Escape handler at all. The frame now keeps focus on itself (`tabindex="-1"`) across that gap, so every keystroke — including a fast second Escape — is still routed.

- @rozie/runtime-lit@0.6.0

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

- Regenerated against `@rozie/core@0.3.0`. `r-for` loop keys are no longer leaked as literal DOM attributes on emitted elements. No API surface change.

## 0.4.1

### Patch Changes

- c279a7e: Fix the `$attrs` auto-fallthrough skip-list to always exclude `data-rozie-ref` (a reserved compiler bookkeeping attribute, never a consumer prop) and fix author `ref="x"` bindings inside a `r-portal`-relocated subtree so they survive the portal's `appendChild` relocation instead of resolving to `null` after the first render. Both fixes land via the regenerated Lit leaf; no API change, no per-target behavior divergence.
- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.4.0

### Minor Changes

- e0b8383: Breadcrumb ancestor segments are now click-to-jump — clicking a muted ancestor pops the level stack straight back to that tier, emitting one `back` event per popped level (exactly like pressing Backspace that many times), keyboard-focusable with a "Back to `<title>`" aria-label. The current segment stays non-interactive. It composes with the already-staged 0.4.0 minor.
- eaaff1d: Command items may now carry an optional `hotKey?: string` field — a display-only teaching badge advertising an app-global shortcut the consumer owns (e.g. Copy `$mod+c`, Print `$mod+p`), rendered right-aligned before the `#actions` affordance and gated on the item's `hotKey`. It reuses the same portable `$mod`/`$shift`/`$alt`/`$ctrl` modifier grammar as the existing `actionKey` hint — the palette never binds or listens for the key, it is purely visual. That grammar is now factored out into a shared `formatKeyToken` helper that `actionKey`'s own default hint also renders through. Five new `--rozie-command-palette-hotkey-*` theming tokens fall back to the existing `--rozie-command-palette-actions-hint-*` values.
- d9ba7c2: New **inline command arguments** (Raycast-style): a command item declares `args: [{ id, placeholder?, required?, default? }]` (text inputs only in v1). Selecting an args-bearing item (Enter or click) automatically enters a panel-internal args surface — reusing the same real-focus/`pinOpen` mechanics as the existing per-row action menu, with zero new props/events. A non-interactive chip shows the pending command's label above the field(s); the result list stays visibly open but is dimmed and `aria-hidden` while the args surface is active.

  Enter with every `required` field non-empty (after trim) fires the EXISTING `select` event with an added `args: { [id]: value }` key — additive and non-breaking: an argless command's `select` payload carries no `args` key at all. Enter with a missing required field instead focuses the first unfilled field. `default` prefills its field (selected on focus so typing replaces it). Escape closes the args surface and restores the list + query (same precedence tier as closing the sub-actions menu); Backspace on an empty first field also pops back to the list. `args` wins over a `source`/`children` navigation on the same item (mutually exclusive); `args` is compatible with the per-row `actions` menu (which is inactive once the args surface is open).

  New optional slot `argsField` (scope `{ item, arg, value, setValue }`) replaces the default field chrome (surface 11→12 slots). New `--rozie-command-palette-args-{padding,gap,chip-bg,chip-color,field-padding,field-border,field-radius,field-bg,dim-opacity}` tokens alias the existing panel/input fallbacks. No compiler change, no `@rozie-ui/combobox` change — the args surface reuses `pinOpen`/`reopenComboboxPopup` verbatim.

- 27dc962: Added a per-level `virtual` (long-list windowing) author-side API, threading three new props — `virtual` (Boolean), `virtualMaxHeight` (String), `virtualEstimateRowHeight` (Number) — onto the vendored combobox's own windowing support. Resolved PER LEVEL, exactly like `defaultItems`/`title`/`placeholder`: the top-level props window the ROOT list, while a navigating item's own `virtual`/`virtualMaxHeight`/`virtualEstimateRowHeight` fields window THAT pushed child level (captured onto its frame at push time). This is unblocked by `@rozie-ui/combobox`'s `virtual` prop now being live-flippable at runtime (see that package's own changeset) — a level pushed with `virtual: true` windows immediately, no remount required.

  A virtual level renders **flat**: the vendored combobox's `isGrouped` requires `!virtual`, so auto-derived groups, `groupCap`, and the `groupHeading` slot are inactive for that level. This is honestly bidirectional — popping back to a level whose `virtual` resolves `false` restores its non-windowed (and, if applicable, grouped) render.

  Surface grows 15 → 18 props (`virtual`/`virtualMaxHeight`/`virtualEstimateRowHeight`, placed after `appendTo`); models/emits/slots/expose are unchanged. All three props unset is byte-behavior-identical to today (`:virtual="false"`, `:max-height="''"`, `:estimate-row-height="36"`).

- 35250cc: New `appendTo` prop (surface 14→15) lets the overlay escape an ancestor whose `overflow: hidden` / `transform` / `filter` / `contain` would otherwise clip the palette's `position: fixed` overlay — a real embedding bug (an app-shell iframe or a designer-chrome wrapper with its own layout is the common case). Defaults to `false` (render in place, today's behavior — zero change for existing consumers); set it to `true`/`'body'` to portal to `document.body`, a CSS selector string to portal to the first matching element, or an `Element` reference to portal to that element directly.

  Built on a new compiler primitive (`r-portal`, see the toolchain changeset) using each target's native element-teleport construct — React `createPortal`, Vue `<Teleport>`, Solid `<Portal>`, a Svelte action, an AOT-safe Angular effect, and a Lit `ReactiveController`. Everything else about the palette works unchanged through the portal — the levels Escape funnel, combobox's own focus management, and the row-action-menu arbitration are all rooted at `$refs.panel`/`$refs.frame` (never `$el`), so a moved node's ref identity survives the relocation with zero logic changes. Theming custom properties (`--rozie-command-palette-*`) must be set on `:root` (or the `appendTo` container itself) to reach a portalled overlay — see the [API reference](/components/command-palette-api#escaping-a-clipped-ancestor-appendto) for the full value grammar and the Lit-specific theming note.

  Also corrects a stale header comment in `CommandPalette.rozie` that cited an already-fixed compiler gap as the reason native `<dialog>` was avoided — the actual (unchanged) reason is that `<dialog>.showModal()`'s native focus-trap/Escape would fight the palette's own levels Escape funnel and combobox focus management.

### Patch Changes

- ea7c6a8: Fix `groupCap` composition with per-row `actions`: the ⌘K / Right-arrow action menu now always anchors to the exact highlighted VISIBLE row — it previously mis-anchored to the uncapped-order neighbour once any section overflowed its cap. Firing the action key on a "+N more" row is now correctly a no-op (it previously could wrongly open a menu). Composes into the already-staged `0.4.0` minor.
- bd68fdb: Platform-aware `actionKey` hint: the row-actions affordance's default hint badge rendered the mac `⌘` glyph on every platform. It now shows `⌘K` on Apple platforms and `Ctrl+K` elsewhere (SSR-safe sniff, display-only — shortcut matching was already portable via `metaKey || ctrlKey` and is unchanged).
- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0

## 0.3.0

### Minor Changes

- 564ed59: Pass-through `groupCap` prop — cap command sections with an expand-in-place
  "+N more" row.

  Set `groupCap` to cap each command section (see [Grouped
  commands](/components/command-palette-api#grouped-commands)) to its first
  `groupCap` results, straight through to the vendored `@rozie-ui/combobox`
  primitive's own `groupCap`. An overflowing section renders a
  keyboard-reachable "+N more" row that expands that section in place when
  activated — no new palette prop/slot/emit/expose beyond `groupCap` itself.
  `0`/absent (default) is uncapped, byte-identical to before this release.

  Note: the ⌘K/Right-arrow row action menu resolves the highlighted row by
  section index, which assumes the uncapped section order — combining
  `groupCap` with per-row `actions` is not composed in this release.

  This release requires the sibling `@rozie-ui/combobox-*` packages at a
  version carrying the native `groupCap` prop / `groupMore` slot
  (`combobox-group-cap`).

- 019b02e: **BREAKING:** `@select` now emits `{ item, path }` — `item` is the full chosen
  command object (everything you put on the item: `id`/`label`/`group`/
  `keywords`/`icon`/`actions`/`disabled`/any custom fields), and `path` is the
  levels id-breadcrumb (unchanged). Previously `@select` emitted a slim
  projection, `{ id, label, group, path }`, dropping any other fields you'd
  attached to the item and forcing consumers to re-resolve the full item from
  just its `id`.

  This mirrors the existing `@navigate` event's `{ item, depth }` shape — both
  navigation events now consistently hand back the full item.

  **Migrate:** `e.id` → `e.item.id`, `e.label` → `e.item.label`, `e.group` →
  `e.item.group`. `e.path` is unchanged.

- e8e2192: Added interactive secondary actions (the "⌘K-within-the-palette" pattern):
  each result row may now carry its own `actions?: [{ id, label, icon?,
shortcut?, disabled? }]` array, opened via a configurable `actionKey` prop
  (default `"$mod+k"` — ⌘K/Ctrl+K), a caret-at-end Right-arrow, or clicking the
  row's `#actions` affordance (now interactive — was display-only). Selecting
  an action fires the new `action-select` event (`{ item, action }`); the new
  `closeOnAction` prop (default `true`) controls whether running an action
  also closes the palette.

  Opening the menu moves real DOM focus into the first enabled `role="menuitem"`
  while the result list stays visibly open. Inside the menu: ↑/↓ rove over
  enabled actions (disabled entries are skipped, clamped at the ends); Enter/
  Space fires `action-select` and always closes the menu; Escape/← close the
  menu, restore focus to the search input, and reopen the result list — they do
  **not** pop a level or close the palette (a sub-surface being open always
  takes precedence over level-pop, which always takes precedence over closing
  at the root). Pushing or popping a level while the menu is open closes it
  first.

  New slot `actionItem` (scope `{ action, item, active, disabled }`) customizes
  each menu row; the existing `actions` slot is unchanged (its display scope
  `{ option, actions }` still works — it now also doubles as the click
  affordance that opens the menu). No new imperative handle verb was added.

  This release also requires the sibling `@rozie-ui/combobox-*` packages at a
  version carrying the `pinOpen(boolean)` imperative handle verb (added in the
  `combobox-keepopen` change) — the action flyout uses it to keep the result
  list open while it holds focus.

- 6820171: Grouped commands now render as real labeled sections via the vendored
  `@rozie-ui/combobox` primitive's native option grouping, instead of a per-row
  text badge. Commands sharing the same `items[].group` string are auto-derived
  into `[{ id, label }]` sections (no new opt-in prop) and rendered under a
  labeled `role="group"` heading; commands with no `group` render first in a
  headingless block. Global relevance ranking is preserved WITHIN a group and
  sacrificed ACROSS groups (the intended semantics of a sectioned list) —
  groups themselves appear in first-appearance order.

  The previous per-row `.rozie-command-palette-option-group` badge is
  suppressed whenever grouping is active; a consumer whose items carry no
  `group` sees today's flat, unsectioned list, byte-identical to before this
  change.

  New slot `groupHeading` (scope `{ group }`, where `group` is `{ id, label }`)
  customizes the section heading; the default fill renders `group.label`.

  This release requires the sibling `@rozie-ui/combobox-*` packages at a
  version carrying the native `groups` prop / `groupHeading` slot
  (`combobox-native-groups`).

- 46bad6c: New prop `defaultItems` — a first-class empty/home view, resolved **per
  level**. The top-level `defaultItems` prop is the ROOT level's home view; a
  navigating item's own `defaultItems` field (alongside its `children`/
  `source`) is that child level's home view, captured onto its pushed level
  exactly like `title`/`placeholder` already are.

  Whichever `defaultItems` is active renders as soon as the query is empty (on
  open, and whenever the query is cleared) and switches to scored `items`/
  `source` results the moment the user types; clearing returns to
  `defaultItems` again. They compose with grouped commands for free — an entry
  carrying a `group` field renders in its labeled section. Scoring never
  reorders `defaultItems` — they render in author order, since an empty query
  short-circuits before ranking runs.

  This is the first-class replacement for branching on `query === ''` inside a
  `source` function to return a "default" view, and the natural home for a
  recents/frecency list (it composes with the `score` prop's own
  recency-boost hook). Pushing a level whose item carries `defaultItems` shows
  that home view immediately — no loading flash, and `source('')` is never
  invoked.

  A palette (or level) with no `defaultItems` set is byte-behavior-identical
  to before this feature — the full, unfiltered `items`/`children` list in
  source order.

### Patch Changes

- d3782ef: Style polish for the nested-levels + sub-actions UI, driven by a rendered
  audit:
  - **fix:** the per-row action flyout escaped to the viewport's right edge
    instead of staying anchored to the palette (the panel established no
    containing block). A new non-clipping `.rozie-command-palette-frame`
    wrapper now owns positioning; the flyout is a frame child (sibling of the
    panel) so it can extend past a short panel without ever being clipped or
    escaping to the viewport.
  - The default `#breadcrumb` fill now renders the full root..current trail
    (muted ancestors › an emphasized current segment) instead of a bare `‹` +
    the current title alone. The slot API (`{ stack, back }`) is unchanged.
  - The composed search input renders borderless with a subtle bottom divider
    instead of the vendored combobox's default bordered/blue-focus-ring look,
    via panel-scope token overrides (see the combobox tokens release below).
  - Subtle top spacing now separates the leading ungrouped command block from
    the first labeled group heading.

  No new props/emits/slots/expose; no behavior change. Requires the sibling
  `@rozie-ui/combobox-*` packages at a version carrying
  `--rozie-combobox-focus-border-color` / `--rozie-combobox-input-underline` /
  `--rozie-combobox-group-heading-margin-top`.

- Updated dependencies [d3782ef]
- Updated dependencies [564ed59]
- Updated dependencies [99fee43]
- Updated dependencies [f3e1bdf]
  - @rozie-ui/combobox-lit@0.3.0

## 0.2.0

### Minor Changes

- aaae31a: Add nested levels — an action-driven drill-in stack with breadcrumb/back
  navigation, per-level async sources (loading/error/race-drop), and an
  `openTo(path)` deep-link. This is the "Go to page…" hybrid-palette backbone
  and absorbs the previously-planned async-search feature.

  **Nested levels:** selecting an item that carries `children` (a static
  array) or `source` (a `(query) => items | Promise<items>` function) now
  **pushes** a child level instead of firing `select` — presence of either
  field is the navigation signal, no separate flag. Selecting a leaf item
  (no `children`/`source`) still emits `select`, and its payload gains an
  optional `path` — the id breadcrumb of levels navigated through to reach
  it.

  **Async sources:** a `source` returning a `Promise` puts its level into a
  `'loading'` status until it settles; only the LATEST in-flight request's
  result is applied (a monotonic request token drops stale resolutions from
  overlapping calls). A new `searchDebounce` prop (default ~150ms) debounces
  an async level's keystroke refetch only — a `children` level re-ranks
  locally with no debounce. New `loading` (`{ query }`) and `error`
  (`{ query, error, retry }`) slots render the in-flight/failed states
  (re-projected inside the existing `empty` region); a rejected `source`
  leaves the input usable and is retried on the next keystroke or via the
  `error` slot's `retry`.

  **Query lifecycle:** pushing a level clears the query to `''` for the child
  level; popping restores the PARENT level's query — both the two-way `query`
  model AND the visible search-box text — full undo, "back" feels like
  undo.

  **Navigation:** Backspace on an empty query pops one level; Escape pops one
  level at depth > 0 and only closes the palette at the root. A breadcrumb/
  back header renders above the input at depth > 0 (a new `breadcrumb` slot,
  scope `{ stack, back }`, overrides the default back-button + title fill).
  Two new events, `navigate` (a level was pushed, payload `{ item, depth }`)
  and `back` (a level was popped, no payload). Two new imperative handle
  methods: `openTo(path)` — deep-link straight into a nested level, drilling
  through an array of item ids from the root, async-aware (awaiting each
  hop's `Promise` source before resolving the next) — and `goBack()` — pop
  one level (a no-op at the root). The pop verb is named `goBack`, **not**
  `back`, to avoid colliding with the new `back` event.

  **Per-item title/placeholder:** a navigating item's optional `title` drives
  its level's breadcrumb/header label (falling back to `label`); its optional
  `placeholder` drives its level's search-box placeholder (falling back to
  the component's `placeholder` prop).

  None of this affects a consumer with no `children`/`source` items — every
  item stays a leaf and behaves exactly as before.

- b40d851: Add a pluggable ranking/scoring seam with query-match highlighting, and three
  new display-only option-row slots (`#icon` / `#trailing` / `#actions`).

  **Scoring seam:** `CommandPalette` now accepts an optional `score` prop —
  `(item, query) => number | null` — to customize how `items` are ranked and
  filtered. Return `null` to exclude an item from the results; higher numbers
  rank first. Leave it unset to use the new built-in fuzzy-subsequence scorer,
  which matches the query against each item's `label` (weighted above its
  `keywords`) and ranks stronger matches first.

  **Behavior change:** the built-in default matching changed from 0.1.0's plain
  substring filter to fuzzy-subsequence matching. This is **more permissive** —
  queries that previously matched nothing (because the characters weren't
  contiguous) may now match and rank an item. Ordering may also differ, since
  results are now ranked by match strength rather than left as a simple
  filtered subset in source order. Empty/whitespace queries are unaffected —
  `items` are still returned in source order.

  Query-matched characters in each visible option's label are now highlighted
  (a `.rozie-command-palette-option-label-match` class on the matched runs,
  themeable via `--rozie-command-palette-match-*` custom properties) — this
  applies regardless of whether the built-in scorer or a custom `score` is
  used, since highlighting is computed independently from the label + query.

  **Option-row slots:** the default `#option` row gained three additive,
  display-only scoped slots — `#icon` (`{ option }`), `#actions`
  (`{ option, actions }`), and `#trailing` (`{ option }`) — laid out as
  `[icon] [label + group] <spacer> [actions] [trailing]`. None render anything
  when left unfilled, so existing consumers of the default row are unaffected.
  Items may now carry optional `icon` and `actions` fields; both are
  display-only and ignored by ranking.

### Patch Changes

- Updated dependencies [55b41c5]
- Updated dependencies [458db46]
  - @rozie-ui/combobox-lit@0.2.0
