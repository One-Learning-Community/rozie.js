# @rozie-ui/combobox-react

## 0.4.0

### Minor Changes

- afa0a7e: The `virtual` prop is now **live-flippable at runtime**. Previously the TanStack windowing engine was constructed exactly once in `$onMount`, so a runtime `false→true` flip rendered a blank popup and a `true→false` flip left a live `ResizeObserver` (and stale windowing state) behind.

  `buildVirtualizer()`/`teardownVirtualizer()` now share the single construction site `$onMount` also calls, wired to a new lazy watch on `virtual`: flipping to `true` (re)builds the windowing engine (rAF-deferred so the windowed popup has mounted its scroll container first) and resets any expanded-group state; flipping to `false` tears it down immediately, disconnecting the `ResizeObserver` — fixing the leak. During the brief mid-flip frame (virtual on, engine not yet attached) the popup renders the un-windowed full option list rather than going blank.

  No prop/model/emit/slot/expose surface change — `virtual` already existed. A `virtual:false` combobox that never flips it, and a `virtual:true`-at-mount combobox that never flips it back, both render byte-identically to before.

### Patch Changes

- @rozie/runtime-react@0.2.0

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
