# `r-keynav` — compiler-owned keyboard navigation

Keyboard list-navigation — Arrow/Home/End/typeahead, an active index, the `aria`/`id` wiring that goes with it, and roving focus or `aria-activedescendant` — is boilerplate every menu, listbox, combobox, toolbar, and tab strip in a component library rewrites by hand, once per framework. `r-keynav` replaces the active-state field, the entire `@keydown` switch, per-item `:id`/`@pointermove`, `:aria-activedescendant`, and the scroll-into-view `$watch` with **one directive on the nav root plus one marker on each item**. The compiler owns the plumbing; you own only what happens on commit.

This is the diff `r-keynav` deletes:

**Before — hand-rolled, ~40 lines:**

```rozie
<data>
{
  active: 0,
  chosen: '',
}
</data>

<script>
const RESULTS = [
  { id: 'r1', label: 'Apple' },
  { id: 'r2', label: 'Banana' },
  { id: 'r3', label: 'Cherry', disabled: true },
  { id: 'r4', label: 'Date' },
  { id: 'r5', label: 'Elderberry' },
]

let typeaheadBuffer = ''
let typeaheadTimer = null

const move = (delta) => {
  let next = $data.active
  do {
    next = (next + delta + RESULTS.length) % RESULTS.length
  } while (RESULTS[next].disabled)
  $data.active = next
}

const choose = (item) => {
  $data.chosen = item ? item.label : ''
}

const onKeydown = ($event) => {
  switch ($event.key) {
    case 'ArrowDown': $event.preventDefault(); move(1); break
    case 'ArrowUp': $event.preventDefault(); move(-1); break
    case 'Home': $data.active = 0; break
    case 'End': $data.active = RESULTS.length - 1; break
    case 'Enter': choose(RESULTS[$data.active]); break
    default:
      if ($event.key.length === 1) {
        clearTimeout(typeaheadTimer)
        typeaheadBuffer += $event.key.toLowerCase()
        const match = RESULTS.findIndex((r) => r.label.toLowerCase().startsWith(typeaheadBuffer))
        if (match !== -1) $data.active = match
        typeaheadTimer = setTimeout(() => { typeaheadBuffer = '' }, 500)
      }
  }
}

$watch(() => $data.active, () => {
  $refs.list.children[$data.active]?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
<input type="text" role="combobox" :aria-activedescendant="'opt-' + $data.active"
       @keydown="onKeydown($event)" />
<ul role="listbox" ref="list">
  <li r-for="(r, i) in RESULTS" :key="r.id" role="option"
      :id="'opt-' + i" :aria-disabled="!!r.disabled"
      @pointermove="$data.active = i">
    {{ r.label }}
  </li>
</ul>
</template>
```

**After — r-keynav, ~5 lines:**

```rozie
<template>
<input type="text" role="combobox" r-keynav:activedescendant.vertical="$data.active"
       :source="RESULTS" @keynav-commit="choose(RESULTS[$data.active])" />
<ul role="listbox">
  <li r-for="r in RESULTS" :key="r.id" role="option"
      r-keynav-item="{ label: r.label, disabled: r.disabled }">{{ r.label }}</li>
</ul>
</template>
```

The `active` field in `<data>` stays — you still own it — but the entire `@keydown` switch, the typeahead buffer, per-item `:id`/`@pointermove`, `:aria-activedescendant`, and the scroll `$watch` are gone.

## Surface

```
r-keynav:<focus-model>[.<modifier>…]="<active-index binding>"   (on the nav root)
r-keynav-item="{ label?, disabled? }"                            (on each item)
r-keynav-active-class="<class spec>"                             (optional, on the root)
@keynav-commit="…"                                               (Enter / click-on-active)
:source="<items array>"                                          (optional; else synthesized from co-located r-for)
```

**Two focus models** (the directive's argument):

- **`r-keynav:activedescendant`** — DOM focus **stays on the root control**; the active item is tracked virtually via `aria-activedescendant` pointing at its id. Use this for a listbox or a combobox with an `<input>`.
- **`r-keynav:tabindex`** — DOM focus **moves to the active item** (the WAI-ARIA "roving tabindex" pattern: `tabindex` toggles `0`/`-1`, `.focus()` runs on change). Use this for a menu, toolbar, radio-group, or tab strip.

**Modifiers** (the existing dotted-modifier grammar):

| Modifier | Values | Default | Effect |
| --- | --- | --- | --- |
| orientation | `.vertical` / `.horizontal` / `.both` | `.vertical` | which arrow axis navigates (`.both` = both arrow axes navigate) |
| `.loop` | flag | off (clamp) | wrap past the ends instead of clamping |
| `.typeahead` | flag | off | printable characters jump to a matching item by `label`; ~500ms buffer, resets after the pause |
| `.skipdisabled` | flag or `.skipdisabled(false)` | **on** | skip `disabled` items during navigation; pass the bare-boolean argument `.skipdisabled(false)` to include disabled items in navigation |

**The rest of the surface:**

- **`r-keynav-item="{ label?, disabled? }"`** — tags each rendered row. `label` feeds typeahead matching; `disabled` feeds `.skipdisabled`. The item's index comes from its enclosing `r-for`.
- **`:source="<items array>"`** — the data array the primitive navigates (not the rendered DOM — required because the list may be virtualized). **Sugar:** omit `:source` and the compiler synthesizes it from the co-located `r-for` producing the `r-keynav-item` elements — a static menu never has to mention a source at all.
- **`@keynav-commit="…"`** — fires on Enter or a click on an item, with the active index. `r-keynav` manages the active index and focus; **you** own selection semantics (single vs. multiple, toggle vs. replace) via this event — navigation and selection are deliberately separate concerns.
- **`r-keynav-active-class`** — optional; see [Active-item styling](#active-item-styling) below.

## Two examples

**Menu — tabindex model, items contained in one subtree:**

```rozie
<template>
<div role="menu" r-keynav:tabindex.vertical.loop="$data.active"
     :source="items" @keynav-commit="run(items[$data.active])">
  <button role="menuitem" r-for="it in items" :key="it.id"
          r-keynav-item="{ label: it.label, disabled: it.disabled }">
    {{ it.label }}
  </button>
</div>
</template>
```

**Combobox — activedescendant model, input and list in SEPARATE subtrees:**

```rozie
<data>
{
  active: 0,
  chosen: '',
}
</data>

<script>
const RESULTS = [
  { id: 'r1', label: 'Apple' },
  { id: 'r2', label: 'Banana' },
  { id: 'r3', label: 'Cherry', disabled: true },
  { id: 'r4', label: 'Date' },
  { id: 'r5', label: 'Elderberry' },
]

const choose = (item) => {
  $data.chosen = item ? item.label : ''
}

const onSearch = ($event) => {
  // re-filter RESULTS from $event.target.value, reset $data.active as needed
}
</script>

<template>
<input type="text" role="combobox" r-keynav:activedescendant.vertical="$data.active"
       :source="RESULTS" @keynav-commit="choose(RESULTS[$data.active])"
       @input="onSearch($event)" />
<ul role="listbox">
  <li role="option" r-for="r in RESULTS" :key="r.id"
      r-keynav-item="{ label: r.label, disabled: r.disabled }"
      :aria-disabled="!!r.disabled">{{ r.label }}</li>
</ul>
</template>
```

The combobox example is the proof that association is **shared reactive state** (`$data.active` + `:source`), not DOM nesting — the `<input>` root and the `<ul>` items live in separate subtrees and still track each other, because the compiler wires `aria-activedescendant` on the input to the active `<li>`'s id and stamps the same active marker onto each `<li>` through their shared state, not through parent/child structure. (The menu example above stays template-only — a static menu never needs a `<data>`/`<script>` block at all.)

## Keyboard map

| Key | Action |
| --- | --- |
| Arrow (per orientation) | move active ±1 (wrap if `.loop`, skip disabled if `.skipdisabled`) |
| Home / End | move to first / last enabled |
| Enter | fires `@keynav-commit` with the active index |
| printable characters | typeahead to a matching `label` (if `.typeahead`) — case-insensitive prefix match, ~500ms buffer reset |
| click on an item | sets active to it and fires `@keynav-commit` |

`Escape`, `Tab`, and open/close semantics stay with you — they belong to the surrounding widget (a popover, a dialog), not to navigation.

## Accessibility

`r-keynav` draws an explicit line between what the compiler wires for you and what stays yours to set.

**What the compiler sets for you:**

- tabindex model (`r-keynav:tabindex`): the roving `tabindex` `0`/`-1` toggle across items, plus `.focus()` on the active item whenever it changes. A genuine navigation (the active index actually moving) always focuses. The very FIRST focus/scroll pass — mount, or a root re-appearing behind `r-if` — is different: it only fires when DOM focus is already somewhere inside the component. A cold page load, or a page where the user is focused on something unrelated elsewhere, is left alone; drilling into a panel while focus already sits on the component's own heading (or any other element inside it) still focuses the panel's active item, preserving keyboard continuity.
- activedescendant model (`r-keynav:activedescendant`): `aria-activedescendant` on the nav root, plus a stable, unique `id` per item (so the root has something to point at).
- both models: `data-rozie-keynav-item="<index>"` on each item and `data-rozie-keynav-active` on the active item (the canonical styling/test hook — see [Active-item styling](#active-item-styling) below), a stable group id on the root, and the delegated keydown/pointermove wiring.

**What you still own:**

- semantic roles: `role="menu"`/`role="menuitem"`, `role="listbox"`/`role="option"`, `role="combobox"` — the primitive never guesses your widget's role.
- labelling: `aria-label` / `aria-labelledby` on the nav root.
- combobox trigger wiring: `aria-expanded` + `aria-controls` linking an input/button to its popup.
- `aria-disabled` on disabled items — `r-keynav-item="{ disabled }"` only feeds `.skipdisabled` navigation, it does **not** emit the `aria-disabled` attribute. Set it yourself, as both demos do: `:aria-disabled="!!r.disabled"`.
- open/close, `Escape`, and `Tab` semantics — as the Keyboard map notes above, these belong to the surrounding widget, not to navigation.

## Active-item styling

The compiler **always** stamps <span v-pre>`data-rozie-keynav-active`</span> on the active item — cheap, and it gives you one canonical hook for both default styling and VR/tests, with nothing to opt into:

```css
[data-rozie-keynav-active] { background: var(--rozie-accent); }
```

`r-keynav-active-class="…"` is **optional and additive** — it never replaces the `data-*` hook, it only *also* toggles author classes on the active item. It accepts the same shapes `:class` does (`'is-active'`, `['is-active', 'ring']`, `{ 'is-active': cond }`).

Two semantics govern it:

1. **Evaluated once (static config), not a live per-render binding.** The controller normalizes the class spec at setup and toggles the token set on active-change — it does not re-evaluate on every render the way a template `:class` binding would. If the active item's styling needs to change *while* it stays active (a value that changes without the active index changing), bind off the always-present `[data-rozie-keynav-active]` attribute instead — that one *is* live, because it's a plain declarative binding the compiler emits per item, not an imperative toggle.
2. **The object form composes with activeness.** `r-keynav-active-class="{ 'is-active': cond }"` applies the `is-active` class only when the item **is active AND** `cond` holds — both conditions, not either. An item that is active but whose `cond` is falsy gets no class from this rule (though it still carries `[data-rozie-keynav-active]`, since that hook is unconditional).

## Grid focus-model and multi-group

`.grid(<expr>)` switches an `r-keynav` root to the 2D grid focus-model (ARIA grid pattern) — column stride, PageUp/PageDown, row-wise Home/End, boundary→paging events (`@keynav-page`), and focusable-but-inert disabled cells by default:

```html
<div role="grid"
     r-keynav:tabindex.grid(7)="$data.active"
     @keynav-page="onPage($event)">
  <button r-for="day in days" :key="day.iso" r-keynav-item="{ label: day.label, disabled: day.disabled }">
    {{ day.num }}
  </button>
</div>
```

The argument is the column-count expression — a numeric literal (`7`) or a reactive read (`$data.cols`); rows are derived (`ceil(count / columns)`). `.grid()` owns both axes, so it cannot combine with `.vertical`/`.horizontal`/`.both`; it replaces wrapping with boundary events, so it cannot combine with `.loop`. `.typeahead` and `.skipdisabled` still compose normally.

**Grid keyboard map:**

| Key | Action |
| --- | --- |
| `←` / `→` | ±1, flowing continuously through the flat cell list (crosses row ends — the calendar reading order). Past the first/last cell, active does not move; fires `@keynav-page { reason: 'boundary', axis: 'row' }` instead |
| `↑` / `↓` | ±`columns` (a whole row). A landing index outside the grid does not move active; fires `@keynav-page { reason: 'boundary', axis: 'column' }` instead |
| `Home` / `End` | first / last cell **of the active row** |
| `Ctrl`+`Home` / `Ctrl`+`End` | first / last cell **of the whole grid** |
| `PageUp` / `PageDown` | no active change; fires `@keynav-page { reason: 'pageup' \| 'pagedown', axis: 'column' }` |
| `Enter` | commit — a no-op when the active cell is disabled |

A ragged last row (`count % columns !== 0`, e.g. a trailing partial week) is legal: `↓` from the row above a missing trailing cell fires a column-axis `@keynav-page` boundary event rather than landing out of bounds, `End` on that row resolves to the last cell that actually exists, and `Ctrl`+`End` always resolves to `count - 1`.

**The paging event and its contract — the machine never lands.** `@keynav-page` fires whenever a key would move active past a grid edge (an arrow/Home/End boundary) or on `PageUp`/`PageDown`; in every case the state machine leaves `active` untouched. The payload is:

```ts
interface KeynavPageDetail {
  direction: 1 | -1;
  reason: 'pageup' | 'pagedown' | 'boundary';
  axis: 'row' | 'column';   // which axis the move was on ('column' for PageUp/PageDown)
}
```

You own the dataset and the active-index model, so you own what a page means: swap in the next/previous chunk of data, then set the active-index binding to wherever the newly-rendered grid should land focus. **If you don't handle `@keynav-page` at all, boundary/paging keys are safe no-ops** — clamp-equivalent, nothing crashes, active simply stays put.

**Disabled cells in grid mode are focusable-but-inert by default** — the opposite of the 1D-list default. Arrows/Home/End/Ctrl+Home/Ctrl+End land on a disabled cell exactly like any other cell (it takes DOM focus / `aria-activedescendant` normally), but `commit()` no-ops and `@keynav-commit` never fires for it. `.skipdisabled` on a grid root opts back into the 1D skip-walk behavior (walking in ±`columns` strides along the movement axis; an all-disabled walk is a no-op, never a crash) — it's the grid opt-out for authors who want the 1D skip semantics instead of inert cells. 1D lists are untouched by any of this: skip stays the grid-off default, unchanged.

**Multiple nav groups per component** are legal — no new syntax. Each `r-keynav-item` belongs to whichever `r-keynav` root is its **nearest ancestor** in the template — that's the containment rule multi-group scoping uses to disambiguate which group an item belongs to; roots must be siblings or cousins, never ancestors of one another (nesting one root inside another is an error, see `ROZ996` below). A single-root component keeps the looser Phase-71 component-membership association instead (the activedescendant/combobox cross-subtree shape still works unchanged) — nearest-ancestor containment only kicks in once a component has two or more roots, since a single group has nothing to disambiguate.

**Explicit item index** — `r-keynav-item="{ index: <expr> }"` supplies the item's flat index directly, for the case where the nearest enclosing `r-for` isn't the right one (e.g. a day-grid nested inside week/panel loops, where the item's *column* index isn't its *flat grid* index).

## Diagnostics

Ten compile-time diagnostics catch malformed `r-keynav` forms (each collected, not thrown):

| Code | When |
| --- | --- |
| `ROZ982` `KEYNAV_UNKNOWN_MODIFIER` | an unrecognized modifier (did-you-mean among `.vertical`/`.horizontal`/`.both`/`.loop`/`.typeahead`/`.skipdisabled`/`.grid`) |
| `ROZ983` `KEYNAV_NO_ITEMS` | an `r-keynav` root with no associated `r-keynav-item` in its subtree |
| `ROZ984` `KEYNAV_ORPHAN_ITEM` | an `r-keynav-item` with no enclosing `r-keynav` root (ancestor-containment wording; in a single-root component this means no root anywhere in the component) |
| `ROZ985` `KEYNAV_BAD_FOCUS_MODEL` | a missing or unrecognized focus-model argument (valid: `tabindex`, `activedescendant`) |
| `ROZ986` `KEYNAV_MULTIPLE_ROOTS` | **RETIRED** (Phase 77) — multiple `r-keynav` roots per component are now legal (containment-scoped multi-group); never emitted. Superseded by `ROZ996` for the actual illegal shape (nested roots). |
| `ROZ987` `KEYNAV_SOURCE_UNRESOLVED` | `:source` is neither provided nor synthesizable from a co-located `r-for` |
| `ROZ993` `KEYNAV_GRID_ORIENTATION_CONFLICT` | `.grid()` combined with `.vertical`/`.horizontal`/`.both` — grid owns both axes |
| `ROZ994` `KEYNAV_GRID_LOOP_CONFLICT` | `.grid()` combined with `.loop` — boundary/`@keynav-page` events replace wrapping in grid mode |
| `ROZ995` `KEYNAV_GRID_BAD_COLUMNS` | `.grid` missing its argument, or the argument isn't a numeric literal or a parseable reactive expression |
| `ROZ996` `KEYNAV_NESTED_ROOTS` | an `r-keynav` root found inside another `r-keynav` root's subtree — roots must be siblings/cousins, never ancestors of one another |

See the [Diagnostics reference](/reference/diagnostics) for the full code table.
