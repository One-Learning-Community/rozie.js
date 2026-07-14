---
"@rozie-ui/combobox-react": minor
"@rozie-ui/combobox-vue": minor
"@rozie-ui/combobox-svelte": minor
"@rozie-ui/combobox-angular": minor
"@rozie-ui/combobox-solid": minor
"@rozie-ui/combobox-lit": minor
---

Add first-class, opt-in option grouping to `Combobox`.

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
