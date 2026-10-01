# Typed public surface

How to give a component's events, slot parameters and imperative handle real TypeScript types, so a consumer on any of the six targets gets completion and errors instead of `any`.

## Why

A compiled component has a public surface beyond its props: the events it fires, the arguments its scoped slots pass, and the methods on its imperative handle. Without declarations Rozie can only emit the loosest type each target allows:

| Surface | Without declarations |
|---|---|
| Event handlers | `onX?: (...args: any[]) => void` |
| Slot contexts | `{ arg: any }` |
| Imperative handle | `verb: (...args: any[]) => any` |

A consumer who wants `event.detail.id` has to cast. This guide adds four opt-in authoring features that remove the casts:

- [`<types>`](#types-block) declares the types your public surface uses.
- [`<emits>`](#emits-block) declares each event and its payload.
- [`:param-types`](#slot-parameter-types) types a slot's parameters.
- [`$expose` signatures](#expose-signatures) type the handle's methods.

All four are **opt-in and types-only**. A component that uses none of them compiles exactly as it did before, and none of them changes runtime behavior on any target. They work for plain-JS authors as well as TypeScript authors: the type strings are parsed as TypeScript whatever language your `<script>` uses.

Here is the whole thing in one small component:

```rozie
<rozie name="Stepper">

<types>
export type Step = number
export interface StepPayload { step: Step; label: string }
</types>

<emits>
{
  stepped: { payload: 'StepPayload', docs: { description: 'Fired after every change, with the new step.' } },
  done:    {},
}
</emits>

<props>
{
  label: { type: String, default: 'Step' },
}
</props>

<data>
{
  step: 0,
}
</data>

<script>
function next() {
  const n = $data.step + 1
  $data.step = n
  $emit('stepped', { step: n, label: $props.label })
}
function restart() {
  $data.step = 0
  $emit('done')
}
function current() {
  return $data.step
}
$expose({ next, restart, current }, { next: '() => void', current: '() => Step' })
</script>

<template>
  <div class="stepper">
    <button @click="next()">+</button>
    <slot name="readout" :step="$data.step" :param-types="{ step: 'Step' }" />
  </div>
</template>

</rozie>
```

A consumer now sees `onStepped?: (payload: StepPayload) => void` on React and Solid, `output<StepPayload>()` on Angular, and a `CustomEvent<StepPayload>` on Lit. `current()` returns `Step`, and `restart()` stays untyped because the second argument to `$expose` did not name it.

## `<types>` block {#types-block}

`<types>` declares the types that your events, slot parameters and handle refer to. Every **exported** declaration is re-exported from the component's package entry, so a consumer imports `StepPayload` by name.

```rozie
<types>
import type { EventApi, DateInput } from '@fullcalendar/core'
export interface EventClickPayload { event: EventApi; jsEvent: MouseEvent; el: HTMLElement }
export type VirtualElement = { getBoundingClientRect(): DOMRect; contextElement?: Element }
</types>
```

Rules:

- **Always TypeScript**, whatever language `<script>` uses.
- Only type-only statements are allowed: `import type`, `interface`, `type`, and `export` forms of those, including `export type { … }` with or without `from …`.
- Anything else is an error: runtime code, a value `import`, an `enum`, `declare const`. This restriction is what lets the block be hoisted into every target without being able to change runtime behavior. See [ROZ019](/reference/diagnostics) (a statement that is not type-only) and [ROZ020](/reference/diagnostics) (not valid TypeScript).
- A `<types>` import and a `<script>` import that bind the same local name to the same source and name are deduplicated silently. If they bind the same name to a different source, that is [ROZ024](/reference/diagnostics).
- A `<types>` name can't reuse a name the compiler generates: `<Name>Props`, `<Name>Handle`, `Rozie<Name>EventMap`, the component name, Svelte's `Props`, Solid's `JSX`, or a slot context interface (`RowCtx`, `RowSlotCtx`, `RozieRowSlotCtx` for a slot `row` that passes params). It also can't reuse a name the compiled module imports: a `<components>` key (`Child`), the `<Local>Handle` type React and Solid import for it (`ChildHandle`), or any framework or `@rozie/runtime-*` import an emitter adds (`ReactNode`, `Fragment`, `Snippet`, `TemplateRef`, `Show`, `LitElement`, …). Those names are reserved on every target, even where the import is only added when a feature is used, because `<types>` is the same on every target. It also can't clash with a top-level `<script>` declaration in the shared module scope: a `<types>` import against any `<script>` declaration, or a `<types>` type against a `<script>` class, interface, type, enum or import. A `<types>` type next to a `<script>` `const` or `function` of the same name is fine. Every one of these clashes is [ROZ025](/reference/diagnostics), reported on the `<types>` name with a rename hint.

Where the block lands in the compiled output:

| Target | Placement |
|---|---|
| React, Solid, Angular, Lit | module top of the generated file |
| Vue | a separate `<script lang="ts">` block beside `<script setup>`, because exported types cannot live inside `<script setup>` |
| Svelte | `<script module lang="ts">` |

The `.d.rozie.ts` sidecar that editors read carries the `<types>` block too, so a type named in the public surface always resolves there.

## `<emits>` block {#emits-block}

`<emits>` declares each event and, optionally, its payload.

```js
<emits>
{
  eventClick: { payload: 'EventClickPayload', docs: { description: 'An event was clicked.' } },
  ready:      {},
}
</emits>
```

- `payload` is **one** TypeScript type string. It is one argument, not a tuple, which matches the single-`detail` model every target already uses. An absent `payload` means the event carries no argument. A syntax error in the string is [ROZ022](/reference/diagnostics).
- `docs` takes the same shape as the `docs:` key in `<props>` (`description`, `deprecated`, `example`). A malformed `docs:` is a warning, [ROZ023](/reference/diagnostics), and the bad part is dropped.
- An entry that is not `{}` or `{ payload?, docs? }`, that uses a computed or spread key, that repeats an event name, or that repeats its `payload` or `docs` key, is [ROZ021](/reference/diagnostics).

### Completeness rules

When `<emits>` is present it is the **complete list** of events:

- `$emit('x')` of a name that is not declared is an error, [ROZ151](/reference/diagnostics).
- A declared name that nothing ever emits is a warning, [ROZ152](/reference/diagnostics).
- A `$emit` call whose arguments don't match the declaration is a warning, [ROZ157](/reference/diagnostics): an argument passed to an event declared without a payload, no argument for an event that declares one, or more than one payload argument.

These checks count every `$emit` call in `<script>`, `<template>` and `<listeners>`. ROZ151 and ROZ157 point at the offending `$emit` call; ROZ152 has no call to point at, so it points at the event's entry in `<emits>`.

When `<emits>` is absent, nothing changes: event names are inferred from the `$emit` calls and the handlers keep their `(...args: any[]) => void` type. The one deliberate change in this release is that the untyped handler is now `any[]` everywhere. The shared `.d.rozie.ts` sidecar, Solid and Svelte used to emit `unknown[]`, which rejected a handler written with a concrete parameter type. React already used `any[]`.

Event names may be kebab-case. The name in `<emits>` is the DOM-facing name, and each target derives its own spelling from it (`row-open` becomes `onRowOpen` on React and Solid, `onrowopen` on Svelte).

## Slot parameter types {#slot-parameter-types}

Add `:param-types` to a `<slot>` to type the values it passes.

```rozie
<slot name="row" :row="row" :index="i" :param-types="{ row: 'Row', index: 'number' }" />
<slot name="event" portal :params="['arg']" :param-types="{ arg: 'EventContentArg' }" />
```

- The value is an object literal whose values are string literals. Anything else is [ROZ154](/reference/diagnostics).
- Every key must be a parameter the slot really passes, whether through `:params` or through scoped attributes. An unknown key is [ROZ153](/reference/diagnostics).
- Parameters you leave out stay `any`.
- The type strings resolve against [the type-string scope](#type-string-scope). A value that is not a valid TypeScript type is [ROZ022](/reference/diagnostics).

## `$expose` signatures {#expose-signatures}

Give `$expose` a second argument to type the handle's methods.

```js
$expose(
  { getApi, today, gotoDate },
  { getApi: '() => Calendar | null', gotoDate: '(date: DateInput) => void' },
)
```

- The second argument is **compile-time only**. It is stripped from every emitted module, so no signature string ever reaches a JavaScript consumer.
- It must be an object literal that maps exposed verbs to string-literal function types. Anything else is [ROZ156](/reference/diagnostics).
- Each key must be a verb named in the first argument. An unknown key is [ROZ155](/reference/diagnostics).
- A verb you do not list keeps the types its implementation already has. In `<script lang="ts">`, a verb with a return-type annotation (`function add(by: number): string`) or an annotated `const` (`const add: AddFn = …`) keeps those types on every target. A verb with no types at all is `(...args: any[]) => any`. So you can type the verbs consumers call most and leave the rest.
- The implementation can stay untyped. A rest-argument forwarder such as `(...a) => cal?.gotoDate(...a)` is accepted against `'(date: DateInput) => void'` on every target.

## Type-string scope {#type-string-scope}

Every authored type string (an `<emits>` payload, a `:param-types` value, an `$expose` signature) may refer to:

- names declared or imported in `<types>`;
- global DOM and lib types such as `MouseEvent` or `HTMLElement`;
- TypeScript built-ins such as `Record`, `Partial` and `ReturnType`.

Nothing else resolves. In particular, **types declared in `<script lang="ts">` are not in scope**: a type the public surface needs belongs in `<types>`. This keeps the printed type identical on all six targets, because one core helper renders every authored string.

## What the consumer sees {#consumer-view}

With `P` as the payload type (an event with no payload takes no argument):

| Target | Event | Slot context | Handle |
|---|---|---|---|
| React | `onX?: (payload: P) => void` | `renderX?: (ctx: XCtx) => ReactNode` | typed members on `XHandle` |
| Solid | `onX?: (payload: P) => void` | `xSlot?: (ctx: XSlotCtx) => JSX.Element` | typed members on `XHandle` |
| Vue | `defineEmits<{ x: [payload: P] }>()` | `defineSlots` entry | `defineExpose` typed as the handle |
| Svelte | `onx?: (payload: P) => void` (lowercase) | `Snippet<[{ … }]>` | exported functions, with overloads for typed verbs |
| Angular | `output<P>()` | typed template context | typed public methods |
| Lit | `CustomEvent<P>` plus `Rozie<Name>EventMap`, with typed `addEventListener` and `removeEventListener` overloads | typed `Rozie…SlotCtx` | typed public methods |

Notes on the less obvious rows:

- **Lit event map.** The generated `Rozie<Name>EventMap` extends `Omit<HTMLElementEventMap, …>` with the names you declared omitted, so an emit named like a DOM event (`select`) narrows cleanly instead of failing with TS2430. The typed `addEventListener` and `removeEventListener` overloads call `super`, so listener behavior is unchanged.
- **Svelte overloads.** A typed verb is emitted as an overload signature above an implementation that still accepts the untyped arguments, so an untyped JS body compiles.
- **Verbs without a signature.** On every target, a verb whose implementation carries author types (a return-type annotation, or an annotated `const` declarator) keeps them, and only a verb with no types at all is `(...args: any[]) => any`.

The `.d.rozie.ts` sidecar for each target types slots the same way the compiled module does, including Solid's `<name>Slot` props and Svelte's `Snippet` shapes. A Solid scoped default slot accepts a function child.

## Tooling

- The **component manifest** (`rozie-manifest.json`) is now schema v2 and carries emit payloads, `$expose` signatures, the `<types>` text and each slot's authored `:param-types`. The reader still accepts v1, so a component composing an already-published v1 package keeps compiling. The reverse does not hold: composing a package whose leaves ship a v2 manifest (for example `@rozie-ui/popover` or `@rozie-ui/combobox`) from your own `.rozie` needs `@rozie/*` from this release or newer. An older compiler stops with [ROZ988](/reference/diagnostics), which tells you to upgrade the Rozie toolchain.
- **Family READMEs** can render their event tables from `<emits>`. `@rozie-ui/popover` and `@rozie-ui/fullcalendar` do this and no longer keep a hand-written `event-manifest.mjs`.
- **Editor support:** `<types>` and `<emits>` are highlighted by the TextMate grammar and the IntelliJ lexer, and appear in the language server's outline. `<types>` is also part of the Volar virtual code, so TypeScript completion, hover and errors work inside it. `<emits>` payload strings are not type-checked in the editor; the compiler reports a bad one as [ROZ022](/reference/diagnostics).

## Not yet supported

- **Typed props.** A prop's static type is still derived from its runtime `type:` constructor, so an `Array` is `any[]` and an `Object` is a record. A `tsType:` key that narrows it is planned as a follow-up.
- **Payload flow-through to the IDE metadata sidecars.** The Vue `web-types.json` and the Lit custom-elements manifest do not carry event payload types yet.
- **Composing typed children.** A component that composes another Rozie component through `<components>` reads the child's manifest for slot parameter types, but does not yet consume the child's emit payload types.
- Generic components, multi-argument payloads and runtime payload validation are out of scope.

## Diagnostics

Every code below is listed in the [diagnostics reference](/reference/diagnostics).

| Code | Severity | Meaning |
|---|---|---|
| [ROZ019](/reference/diagnostics) | error | `<types>` holds a statement that is not type-only |
| [ROZ020](/reference/diagnostics) | error | `<types>` is not valid TypeScript |
| [ROZ021](/reference/diagnostics) | error | an `<emits>` entry is not `{}` or `{ payload?, docs? }`, or repeats a name or sub-key |
| [ROZ022](/reference/diagnostics) | error | an authored type string is not a valid TypeScript type |
| [ROZ023](/reference/diagnostics) | warning | an `<emits>` `docs:` is malformed |
| [ROZ024](/reference/diagnostics) | error | a `<types>` import conflicts with a `<script>` import |
| [ROZ025](/reference/diagnostics) | error | a `<types>` name collides with a generated name, an emitter import (`<components>` names, framework / runtime imports) or a `<script>` declaration |
| [ROZ151](/reference/diagnostics) | error | `$emit` of a name `<emits>` does not declare |
| [ROZ152](/reference/diagnostics) | warning | `<emits>` declares an event that is never emitted |
| [ROZ153](/reference/diagnostics) | error | a `:param-types` key is not a parameter the slot passes |
| [ROZ154](/reference/diagnostics) | error | `:param-types` is not an object literal of string literals |
| [ROZ155](/reference/diagnostics) | error | an `$expose` signature names a verb that is not exposed |
| [ROZ156](/reference/diagnostics) | error | the `$expose` second argument is not an object literal of function-type strings |
| [ROZ157](/reference/diagnostics) | warning | a `$emit` call's argument count does not match the declared payload |
