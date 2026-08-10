# Props, state & two-way binding

How `<props>` and `<data>` declare state, and how one `model: true` flag becomes each target framework's native two-way binding.

## `<props>` and `<data>` accept real JS expressions

Most config-block DSLs stop at JSON5. Rozie's parser uses `@babel/parser.parseExpression`, so the values can be anything a JS expression can be — arrow factories, identifiers like `Number` / `Infinity` / `String`, spreads, anything:

```rozie
<props>
{
  value: { type: Number,  default: 0,  model: true },
  step:  { type: Number,  default: 1 },
  min:   { type: Number,  default: -Infinity },
  max:   { type: Number,  default: Infinity },
  items: { type: Array,   default: () => [] },
  config: { type: Object, default: () => ({ retries: 3, delay: 100 }) },
}
</props>
```

That `default: () => []` is real, not a string template — every target's emitter unwraps it into the framework's native default-prop mechanism (`withDefaults`, `?? ...`, `$bindable(...)`, `input<T>(...)`, a `@property` field initializer for Lit, etc.).

A prop's `type:` is just as flexible. It can be a builtin constructor token (`Number` / `String` / `Boolean` / `Array` / `Object` / `Function`), or a bare identifier naming a `type` alias or `interface` declared in the same component's `<script lang="ts">` block. Rozie passes that identifier through verbatim into each target's typed prop signature, so the consumer's type-checker sees the real type — not a widened `unknown`.

```rozie
<script lang="ts">
type Variant = 'a' | 'b'
</script>

<props>
{
  variant: { type: Variant, default: 'a' },
}
</props>
```

See `examples/typed/PropsCustomType.rozie` for a worked reference covering both a string-literal union alias and a custom `interface` flowing into prop-type position across all six targets.

### One HTML rule survives: escape a literal `</script>`

Block bodies are real JS (or CSS), but the `.rozie` file itself is still HTML-shaped — and Rozie keeps HTML's one parsing rule about that: **a block ends at the first literal close sequence of its own tag**, even when that sequence sits inside a JS string or comment. This is exactly how `<script>` behaves in plain HTML, in `.vue` SFCs, and in `.svelte` files.

So this breaks — the string's `</script>` ends the block early:

```rozie
<script>
// ✗ ROZ005 — the string contains the block's own close sequence
const embedCode = '<script src="https://cdn.example.com/widget.js"></script>';
</script>
```

Rozie reports `ROZ005` with a code frame pointing at the offending sequence. The fix is the same escape HTML requires:

```rozie
<script>
// ✓ the escaped form is the identical JS string value
const embedCode = '<script src="https://cdn.example.com/widget.js"><\/script>';
</script>
```

`'<\/script>'` is byte-for-byte the same runtime string (`\/` is just `/` in JS), the block parses correctly, and the escape survives verbatim into the emitted Vue and Svelte SFCs — which need it for exactly the same reason.

The rule applies to every block uniformly: `</style>` inside `<style>`, `</props>` inside `<props>`, and so on. Other angle-bracket content — `<div>` in template literals, `a < b` comparisons, `Array<Item>` generics — is fine.

## `required: true` → one prop contract, not six guesses

A `<props>` entry can declare `required: true`. It is the **sole** determinant of whether the prop is required — `default:` is orthogonal, mirroring Vue's Options-API model. Three states:

- **`required: true`, no `default:`** — the consumer **must** pass the prop. Every target emits a non-optional prop contract: React/Solid/Vue/Svelte a non-optional `name: T` field, Angular `input.required<T>()` / `model.required<T>()`, Lit a definite-assignment `name!: T` field.
- **`default: X`** (with or without `required:`) — the consumer **may** omit the prop; the default fills in. A `default:` always makes the prop optional regardless of any `required` value.
- **neither** — the consumer **may** omit the prop; its internal value is `T | undefined`.

```rozie
<script lang="ts">
interface Item { id: number; label: string }
</script>

<props>
{
  item:     { type: Item,    required: true },
  selected: { type: Boolean, required: true, model: true },
}
</props>
```

Before this, the IR had no `required` field and each target *guessed* optionality from `default:` presence — Angular/Lit treated a no-default prop as required, the others as optional. Same source, different per-target contract. `required` closes that gap: one `.rozie` source now produces one prop contract everywhere.

**`required: true` + `default:` is incoherent** — the default could never fire on a prop the consumer is forced to pass. Rozie drops the default and emits a `ROZ014` warning. Declare one or the other, never both.

One documented edge case: a Lit `model: true` + `required: true` prop. Lit model props are attribute-backed, and custom elements have no required-attribute concept, so the attribute-reflection backing keeps a fabricated initializer value internally even though the public field is emitted non-optional (`name!: T`). This residual is an accepted, documented Lit-ism under Rozie's "high-percentage parity" bar.

See `examples/typed/PropsRequired.rozie` for a worked reference: a required interface-typed prop dereferenced in-template (a member access that only type-checks if `required` genuinely threads through to a non-optional contract) plus a required two-way (`model: true`) prop, proven across all six per-target type-check / lint gates.

## `model: true` → idiomatic two-way binding everywhere

One flag in `<props>`. Six different two-way-binding expansions, each one the target's native pattern:

```rozie
<props>
{
  value: { type: Number,  default: 0,    model: true },
  open:  { type: Boolean, default: false, model: true },
}
</props>
```

| Target | Expansion |
| --- | --- |
| Vue | `const value = defineModel<number>('value', { default: 0 })` |
| React | `useControllableState({ value, defaultValue, onValueChange })` from `@rozie/runtime-react` |
| Svelte 5 | `let { value = $bindable(0) }: Props = $props()` |
| Angular | `value = model<number>(0)` |
| Solid | `createControllableSignal(_props, 'value', 0)` from `@rozie/runtime-solid` |
| Lit | `createLitControllableProperty({ host, eventName: 'value-change', defaultValue: 0 })` from `@rozie/runtime-lit` — a `value` property/attribute pair plus a `value-change` CustomEvent |

### Reading vs. writing a model prop: `$props.x` and `$model.x`

A `model: true` prop has two faces inside the component, just like React's `value` / `setValue` pair:

- **Read** the current value through `$props.x` — `{{ $props.open }}`, `if ($props.value > 0)`.
- **Write** the new value through the `$model.x` sigil — `$model.open = false`, `$model.value += step`, `$model.value++`.

Rozie rewrites the `$model.x` assignment to the target's native emit-or-setter form (Vue `emit('update:value', …)`, React `onValueChange`, Svelte `$bindable` write, Angular `valueChange.emit`, Solid controllable setter, Lit `value-change` CustomEvent). `$model` is a write sigil only; there is no `$model.x` *read*.

```rozie
<script>
const increment = () => { $model.value += $props.step }
const close     = () => { $model.open = false }
</script>
```

The mnemonic pairs with the consumer-side `r-model:value="…"` directive: `r-model:` on the outside, `$model.` on the inside.

**Writing a prop through `$props` is a compile error**, caught before the bug ships:

- `$props.x = …` where `x` is **not** `model: true` → **ROZ200** (`WRITE_TO_NON_MODEL_PROP`). Props are read-only inputs; mutating one is the single most common cross-framework component bug.
- `$props.x = …` where `x` **is** `model: true` → **ROZ204** (`WRITE_TO_MODEL_PROP_VIA_PROPS`), whose message points you at the fix: use `$model.x`.

### Angular: a single-model component is a real form control

When a component has **exactly one** `model: true` prop, the Angular emitter goes one step further than `model<T>()`: the generated class also implements `ControlValueAccessor` and registers the `NG_VALUE_ACCESSOR` provider. The component plugs straight into Angular's forms system — template-driven or reactive — with no wrapper directive and nothing to hand-write:

```html
<!-- Template-driven -->
<rozie-flatpickr [(ngModel)]="birthday" name="birthday" />

<!-- Reactive forms -->
<rozie-flatpickr [formControl]="birthday" />
<rozie-flatpickr formControlName="birthday" />
```

The generated accessor follows a fixed contract:

- **View→model, never an echo.** Only a real internal write — a `$model.x` assignment, an `r-model` input event, an engine callback — notifies the form control. A programmatic `writeValue` from the form updates the view but never echoes back through `registerOnChange`, so there is no value-echo loop.
- **`writeValue(null)` coerces to the prop's declared `default:`.** Resetting a form clears the component instead of crashing it. A `required: true` model prop with no default ignores the initial `null` write.
- **Touched on `(focusout)`.** The control is marked touched when focus leaves the component.
- **Disabled is a merge.** `setDisabledState` OR-merges with a declared **Boolean** `disabled` prop — either source disables the component. Without a Boolean `disabled` prop it's a no-op (info diagnostic **ROZ126**).
- **Two-way binding and the form control coexist.** `r-model:x="…"` and a forms directive can both bind the same component. Writes through the two-way binding update the view but do **not** dirty the form control — the same convention Angular Material follows.

Components with **zero or multiple** `model: true` props don't get an accessor — there is no single value for a form control to own (**ROZ125** explains this on multi-model components). Exposing an `$expose` method named `writeValue` / `registerOnChange` / `registerOnTouched` / `setDisabledState` on a CVA component is a compile error (**ROZ124**) — it would collide with the generated accessor.

This is on by default. To opt out, pass `angular: { cva: false }` to `@rozie/unplugin` or `compile()`, or `--no-cva` on the CLI — the emitted class is then byte-identical to the pre-CVA output. The other five targets are untouched either way; CVA is an Angular-only forms contract.

See the [Flatpickr forms recipe](/components/flatpickr#forms-drop-in) for a worked example against a real engine-wrapper component.

## `r-model` modifiers — `.lazy`, `.number`, `.trim`

`r-model` (the form-input two-way sugar) takes its own modifier chain, with the same Vue muscle memory:

```rozie
<template>
  <!-- commit on `change`, not on every keystroke -->
  <input type="text" r-model.lazy="$data.draft" />

  <!-- coerce to a number; strip whitespace first -->
  <input type="text" r-model.number.trim="$data.quantity" />
</template>
```

| Modifier | What it does |
| --- | --- |
| `.lazy` | Bind on the `change` event instead of `input` — state commits when the field is left, not per keystroke |
| `.number` | Coerce the value with a `looseToNumber`-equivalent: parse as a float, fall back to the raw string when the result is `NaN` |
| `.trim` | `String.prototype.trim()` the value before it is committed |

**Compose order is fixed and Vue-canonical** — value transforms always run `.trim` (whitespace strip) → custom transforms → `.number` (coercion, always terminal, because it produces a non-string). `r-model.number.trim` and `r-model.trim.number` emit byte-identical code, so writing them "in the wrong order" is never an error — it is silently canonicalized. `.lazy` is orthogonal (an event-binding swap, not a value transform).

The built-ins apply to the **form-input `r-model`** sugar only. A built-in on the consumer-side `r-model:propName` two-way form, an unknown modifier (`r-model.numbr` → did-you-mean `.number`), an event modifier misused on `r-model` (`r-model.stop`), or any modifier on a non-modifier directive (`r-show.foo`) are all **hard compile errors** (`ROZ960`–`ROZ963`) — replacing the old behavior where `<input r-model.number>` compiled silently to a dead `<input/>`.

**One documented parity edge case (React `.lazy`).** React has no true `change` event — `onChange` fires per keystroke — so `r-model.lazy` in React emits an **uncontrolled `defaultValue` + `onBlur`** input (`<input defaultValue={x} onBlur={…} />`), the idiomatic React deferred-commit pattern. The trade-off: programmatic writes to the bound state mid-edit are not reflected by the uncontrolled input. The other five targets just swap their event name (Vue `v-model.lazy`, Svelte `on:change`, Angular `(change)`, Solid `onChange`, Lit `@change`). This is consistent with Rozie's "high-percentage parity, not 100%" policy — see [`docs/compatibility.md`](../compatibility.md).
