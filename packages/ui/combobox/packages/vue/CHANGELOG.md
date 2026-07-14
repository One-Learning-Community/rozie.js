# @rozie-ui/combobox-vue

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
