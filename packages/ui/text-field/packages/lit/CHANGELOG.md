# @rozie-ui/text-field-lit

## 0.1.3

### Patch Changes

- a46443a: Lit: a component that is removed from the page and added back works again. Its mount code (`$onMount`) runs again after a real teardown, as on the other targets, so listeners, observers and engine instances are set up again instead of staying torn down. Moving an element within the same task (remove and re-append before it has torn down) keeps the running instance, as before. Mount code and top-level script statements that run again see the element's retained property values.

  Lit: a prop typed with a `<types>` alias made only of string literals (or only of number literals) is now a plain reflected attribute, so `<my-el mode="compact">` works in HTML. It used to be an `Object` property whose attribute value was parsed as JSON, which failed and left the prop `null`.

  Lit: a plain-HTML or Lit consumer (not compiled by Rozie) can fill ANY slot that passes params through the element's `rozieSlots` property, keyed by the slot name (`default` for the default slot): ``el.rozieSlots = { default: ({ item }) => html`<span>${item.label}</span>` }``. The record was only read for dynamically named slots and names that are not identifiers, so an entry for an ordinary scoped slot was silently ignored. It is now tried first for every scoped slot (portal slots excepted), and a component's `$slots.<name>` check counts a record fill as filled, so content gated by `r-if="$slots.<name>"` (for example command-palette's `icon` / `actions` / `trailing` row slots) renders for a record-only fill. A Rozie consumer's fill and the native `<slot>` fallback work as before.

  Changed — Lit: a component's events no longer bubble or cross shadow roots, as on the other targets. `$emit('name', payload)` now dispatches `new CustomEvent('name', { detail: payload, bubbles: false, composed: false })` on the element. A listener on the element itself (`@name=${…}` in a Lit template, `el.addEventListener('name', …)`, a Rozie consumer's `@name`) works as before. A listener on an ancestor element, or outside the shadow root the element sits in, no longer hears it: listen on the element itself. This also means an outer `@rozie-ui/sortable-list` no longer hears the `start` / `add` / `remove` / `reorder` / `end` events of a list nested inside its rows, so the `e.composedPath()[0]` check is no longer needed. Model `*-change` events already behaved this way.

  Lit: a wrapper that forwards `r-on="$listeners"` to a child Rozie component re-dispatches the child's events on its host for the event types its consumer listens for (`@name=${…}`, `addEventListener`), and keeps doing so after the wrapper is moved in the DOM. More generally, an `r-on` listener object re-attaches as soon as its element reconnects, instead of at the element's next render. Listeners added before the component was defined are not seen (the DOM cannot list them); see Cross-Framework Parity.

  Lit: a component whose first render ran after it had already been removed from the page no longer runs its mount code (`$onMount`, document listeners) while detached, where nothing would tear it down; it mounts when it is added back.

  The `@rozie-ui/*-lit` packages listed here are rebuilt with one or more of these fixes; none of them has a string-union prop.

- Updated dependencies [a46443a]
  - @rozie/runtime-lit@0.10.3

## 0.1.2

### Patch Changes

- 3c4b293: README fixes: the Svelte theming import is shown as a TypeScript snippet.

## 0.1.1

### Patch Changes

- b52bd14: New family: `@rozie-ui/text-field`, an accessible text field and textarea. `TextField` renders a label, the control, an optional description and an error message, and wires `for` / `id`, `aria-describedby` and `aria-invalid` between them on every target, including inside the Lit shadow root.
  - Two-way `modelValue` with an uncontrolled fallback; on Angular it is a `ControlValueAccessor`, so the field works with `ngModel` and reactive forms.
  - `multiline` renders a `<textarea>` with `rows`, and `autosize` grows it with its content up to `maxRows`.
  - `type`, `placeholder`, `name`, `autocomplete`, `required` (with a visual marker), `disabled`, `readonly`, `maxLength` and a `showCount` character counter.
  - A `change` event when the user commits an edit (not on every keystroke, and not on programmatic writes), and an `enter` event for Enter in a single-line field.
  - `prefix` / `suffix` slots inside the bordered control box, and an imperative `focus()`, `select()` and `clear()`.
  - @rozie/runtime-lit@0.10.1
