# Templates & events

Rozie's template layer: chainable event modifiers with arguments, custom modifiers, the `<listeners>` block, switch-style conditionals, and safe interpolation semantics.

## Parameterized event modifiers

Every `@event` in a `<template>` (and every `@event` on a `<listener>` in a `<listeners>` block) supports a chainable modifier suffix. Unlike Vue, modifiers can take arguments — `.debounce(300)`, `.throttle(100)`, `.outside($refs.a,$refs.b)` — and they compose:

```rozie
<template>
  <input 
    @input.debounce(300)="onSearch" 
    @keydown.enter="onSearch" 
    @keydown.escape="clear" 
  />
</template>

<listeners>
  <!-- The modifier grammar handles chains of mixed args and bare modifiers: -->
  <listener :target="window" @resize.throttle(100).passive="reposition" />
</listeners>

```

> Modifier-arg lists on a `<listener>` `@event` must not contain internal whitespace — write `.outside($refs.a,$refs.b)`, not `.outside($refs.a, $refs.b)`. The attribute *name* (everything before `=`) ends at the first space, so a space inside the parens would truncate the modifier chain. (Inside a `<template>` attribute the same rule applies.)

The grammar is a small dedicated PEG (`packages/core/src/modifier-grammar/modifier-grammar.peggy`), so the syntax is fixed and predictable across every target. Built-ins:

| Modifier | What it does |
| --- | --- |
| `.stop` | `event.stopPropagation()` before the handler runs |
| `.prevent` | `event.preventDefault()` before the handler runs |
| `.self` | Handler fires only when `event.target === event.currentTarget` |
| `.capture` | Attach the listener in capture phase |
| `.passive` | Mark the listener `{ passive: true }` |
| `.once` | Remove the listener after the first call |
| `.debounce(ms)` | Coalesce calls; fire `ms` after the last one |
| `.throttle(ms)` | Fire at most once per `ms` window |
| `.outside($refs.a, ...)` | Fire only when the event target is outside every listed ref |
| `.enter` / `.escape` / `.tab` / `.space` / `.arrow{Up,Down,Left,Right}` / `.delete` | Key filters; the handler short-circuits unless the key matches |

Each one compiles to the per-target idiom: Vue's `@keydown.enter`/`watchEffect`-with-cleanup, React's `useEffect`-with-removeEventListener, Svelte's `$effect` teardown, Angular's `Renderer2.listen` + `DestroyRef`, Solid's `createEffect` + `onCleanup`, Lit's `firstUpdated` wiring + `disconnectedCallback` cleanup (with `.debounce`/`.throttle` hoisted to stable class fields). **You write the modifier; Rozie writes the rest.**

## Custom modifiers — the `registerModifier` extension API

The modifier system is open: a component-library author can register their own modifiers — for **events** and for **`r-model`** — using the same public API, and thread them through `compile()`. There is one `ModifierRegistry`, one `registerModifier(...)` authoring call, and one `compile({ modifierRegistry })` threading path.

```ts
import {
  ModifierRegistry,
  registerBuiltins,
  registerModifier,
  compile,
  type EventModifierImpl,
  type ModelModifierImpl,
} from '@rozie/core';

// An EVENT modifier — carries six per-target emission descriptors, because
// event wiring genuinely diverges per target. `resolve()` returns
// `{ entries, diagnostics }`.
const logClick: EventModifierImpl = {
  // `kind` is optional for event modifiers — absent ⇒ 'event'.
  name: 'log',
  arity: 'none',
  resolve() {
    return { entries: [{ kind: 'filter', modifier: 'log', args: [], sourceLoc: { start: 0, end: 0 } }], diagnostics: [] };
  },
  react() { return { kind: 'inlineGuard', code: 'console.log("clicked");' }; },
  vue()    { return { kind: 'inlineGuard', code: 'console.log("clicked");' }; },
  // …svelte / angular / solid / lit
};

// A MODEL modifier — target-agnostic. `kind: 'model'` is REQUIRED. `resolve()`
// returns ONE `{ descriptor, diagnostics }`; the descriptor's `valueTransform`
// is a code fragment with a `$v` placeholder each emitter substitutes with its
// own extracted-value access, and an optional `eventSwap: 'change'` flag.
const upper: ModelModifierImpl = {
  kind: 'model',
  name: 'upper',
  arity: 'none',
  resolve() {
    return { descriptor: { valueTransform: 'String($v).toUpperCase()' }, diagnostics: [] };
  },
};

// Build a registry, add the built-ins, then register your own.
const registry = new ModifierRegistry();
registerBuiltins(registry);
registerModifier(registry, logClick);
registerModifier(registry, upper);

// Thread it through compile() — the registry flows through lowering + emit.
const result = compile(source, { target: 'react', modifierRegistry: registry });
```

A model modifier declares **one descriptor**, not six per-target methods — `.trim` is `v.trim()` everywhere, `.number` is a `looseToNumber` coercion everywhere, a custom reformatter is one fragment everywhere. The flat shared namespace (an event and a model modifier cannot share a name) is what lets the compiler tell you precisely whether a misused modifier is an unknown name or an event modifier on `r-model`.

The `tests/plugins/phone` dogfood is a worked end-to-end example — a custom `.phone` US-phone-number reformatter (a `kind: 'model'` value-transform modifier) that compiles across all six targets using only `@rozie/core`'s public barrel.

## `<listeners>` block — declarative `<listener>` elements

Document-level and window-level listeners belong outside the markup, so Rozie gives them their own block. The `<listeners>` block is a *wiring* block of `<listener>` elements — one element per target-and-condition. Each `<listener>` carries:

- `:target` — where to attach. Currently `window` or `document` (see the `$refs` note below). Omit it and the listener attaches to the component's root element (`$el`).
- one or more `@event.modifier(args)` attributes — the events to subscribe to, with the same chainable modifier grammar that template `@event` handlers use.
- an optional `r-if` — the reactive *conditional attach/detach* predicate.

```rozie
<listeners>
  <listener :target="document" @click.outside($refs.triggerEl,$refs.panelEl)="close" r-if="$props.open && $props.closeOnOutsideClick" />
  <listener :target="document" @keydown.escape="close" r-if="$props.open && $props.closeOnEscape" />
  <listener :target="window" @resize.throttle(100).passive="reposition" r-if="$props.open" />
</listeners>
```

**Multiple `@event` per tag.** One `<listener>` is a target + a condition + the events on it. A tag with several `@event` attributes fans out to one subscription per event, all sharing that tag's `:target` and `r-if`:

```rozie
<listeners>
  <listener :target="window" @resize.throttle(100).passive="reposition" @scroll.passive="reposition" r-if="$props.open" />
</listeners>
```

**`r-if` is conditional attach, not conditional render.** On a `<listener>`, `r-if` means "subscribed while the condition holds." When it flips false the listener is removed; when it flips true again it is re-attached. This is distinct from `r-if` inside a `<template>`, which mounts/unmounts DOM. (It is also why `<listener>` only lives in `<listeners>` — a `<listener>` in a `<template>` is a compile error.) No `addEventListener` / `removeEventListener` boilerplate, no missed teardown on unmount. This single block in `Dropdown.rozie` collapses roughly 30 lines of per-framework wiring that would otherwise be written once per target.

::: tip `:target` today accepts `window` / `document`; `$refs` targets are planned
`:target` currently resolves only to `window`, `document`, or (omitted) the component root `$el`. Attaching a listener to a `$refs`-named element — e.g. `:target="$refs.panelEl"` — is **planned but not yet supported**. The hard part is *not* the syntax: it is the *conditional re-attach* problem. A `$refs` element can itself be `r-if`-gated (rendered only when some condition holds), so at the moment the listener wants to attach, the ref'd element may not be mounted yet — and when the element later mounts (or remounts), the subscription has to re-attach to the new node and tear down cleanly when it unmounts. Getting that lifecycle right across all six targets' reconcilers is the open design question. Until then, reach a specific element from a `window`/`document` listener via the event target, or wire it imperatively in `$onMount` through `$refs`.
:::

## `r-match` / `r-case` / `r-default` — switch-style conditionals

A ladder of `r-if`/`r-else-if`/`r-else` that re-tests the same value on every rung gets noisy fast. `r-match` is the switch-flavored alternative: name the discriminant once on the host, then list `r-case` branches. Exactly one branch renders, selected by strict `===` equality:

```rozie
<template>
<template r-match="$data.bound">
  <span r-case="'max'" class="extremum">at the maximum</span>
  <span r-case="'mid'" class="middle">in the middle</span>
  <span r-default class="other">somewhere else</span>
</template>
</template>
```

`r-match` goes on a `<template>` (a non-rendering group) or on a real element (`<div r-match="...">` keeps the `<div>` as a wrapper). Each `r-case` — and the one optional `r-default` — is a direct child; a branch authored as `<template r-case>` emits all of its children with no wrapper. Under the hood the construct lowers to a plain `if`/`else-if`/`else` ladder on all six targets — Vue `v-if`/`v-else-if`/`v-else`, React/Solid a ternary chain, Svelte `{#if}`, Angular `@if`, Lit an inline ternary — so there is no new runtime, just less repetition in the source.

### Comma alternatives

A single `r-case` can carry several values separated by commas — it matches if the discriminant equals **any** of them:

```rozie
<span r-case="'max', 'min'" class="extremum">at an extremum</span>
```

This is a deliberate Rozie sub-grammar: a top-level comma expression in `r-case` is the alternatives list, the same way `r-for`'s `x in xs` is its own micro-syntax. It lowers to a `===`-OR chain — `bound === 'max' || bound === 'min'` — and never to `.includes()`, because `===`-OR is what keeps a discriminated-union discriminant narrowed for the consumer's TypeScript checker.

### Literal-`true` predicate mode

Sometimes the rungs aren't equality checks against one value — they're independent predicates. Set the discriminant to the literal `true` and `r-case` switches to bare-predicate mode: each `r-case` is its own condition, not a value compared against the discriminant:

```rozie
<template r-match="true">
  <strong r-case="$data.count > 10" class="high">plenty</strong>
  <span r-case="$data.count > 0" class="some">a few</span>
  <span r-default class="none">none</span>
</template>
```

Here `r-case="$data.count > 10"` lowers to the bare predicate `$data.count > 10`, not `true === (...)`. The visible <span v-pre>`r-match="true"`</span> is what makes the mode explicit — there is no bare/discriminant-less form of `r-match`. (Literal `false` is the negated-predicate mirror.)

### Branch-swap DOM identity

When the active branch changes and two branches happen to share a tag, Rozie inherits each target framework's native reconciliation behavior — the same DOM-identity semantics you'd get from a hand-written `v-if` / `{#if}` / `@if` ladder. Rozie v1 does **not** auto-key match branches: if you need a guaranteed-fresh DOM subtree on a branch swap (to reset uncontrolled inputs, restart a CSS transition, etc.), add an explicit `:key` exactly as you would with `r-if`. An `r-match.keyed` modifier is a possible future, non-breaking addition; it is not in v1.

### Error boundaries

A few malformed shapes are static compile errors with source-located code frames: an `r-match` with no value, a child of an `r-match` host that is neither `r-case` nor `r-default`, a valueless `r-case` (the diagnostic nudges you toward `r-default`), `r-case` and `r-for` on the same element, an `r-default` that isn't last, and more than one `r-default`. A literal `r-case` value that duplicates an earlier one is a warning, not an error — first occurrence wins, like a JavaScript `switch`.

## Safe non-primitive interpolation — objects render as portable JSON, never crash

Interpolate a non-primitive value — an array, a plain object, a reactive `$data` graph — and the six targets used to disagree wildly. Vue pretty-printed JSON (its native `toDisplayString`), Svelte and Angular showed comma-joined `[object Object]`, Solid and Lit showed space-joined `[object Object]`, and **React threw `Objects are not valid as a React child` and crashed the component.** Same source, six renderings, one hard crash.

Rozie closes that gap. A non-provably-primitive interpolation is wrapped in an internal `rozieDisplay` helper that mirrors Vue's `toDisplayString` semantics, so <span v-pre>`{{ $data.columns }}`</span> renders the **same portable JSON on all six targets** and React no longer crashes:

| Value | `rozieDisplay` result |
| --- | --- |
| `string` | as-is |
| `null` / `undefined` | `''` (empty string) |
| `Array` / plain `Object` | `JSON.stringify(value, null, 2)` |
| anything else (number, boolean, …) | `String(value)` |

The helper is **crash-safe**: a circular structure or a `BigInt`-bearing object (which would throw inside `JSON.stringify`) degrades to `String(value)` rather than re-introducing a render exception.

### Attribute position — a nullish bound value drops the attribute

The table above is the **text / interpolation** rule: in a text node or interpolated string, `null` / `undefined` become the empty string `''` (matching Vue's `toDisplayString`). In **attribute-binding position** the rule is different, because the web platform itself treats a missing attribute and an empty one differently (`[data-locked]` presence selectors, `hasAttribute('aria-busy')`, SortableJS's `filter: '[data-locked]'`).

A whole-value one-way attribute binding (`:data-locked="$data.locked ? 'true' : null"`, or a plain `:title="$data.note"` that is `null`) whose value is **nullish** now **drops the attribute entirely** — matching Vue's native `:attr` binding and the web platform — instead of rendering `attr=""`. Non-null values still stringify, so a value of `false` renders the literal `aria-expanded="false"` / `data-x="false"` (the drop predicate is `value == null` **only**, never `false`, so a11y-meaningful and presence-selector values survive). Text position and attribute position are different positions with different platform semantics, so the two rules differ by design.

The mechanics mirror `rozieDisplay`: the wrapped whole-value attribute branch routes through an internal `rozieAttr` helper (React / Solid / Svelte return `undefined` to omit the attribute, Lit returns its `nothing` sentinel, Angular's `[attr.x]="null"` removes it). Interpolated attribute **segments** (<span v-pre>`:title="note-{{ $data.id }}"`</span>) stay on the text rule — a nullish segment inside a composed string is still `''`, exactly as Vue interpolates. Vue needs no change; its native `:attr` binding already drops nullish.

### Only non-primitives are wrapped — primitives stay byte-identical

The wrap is **gated**, decided once at compile time. An interpolation the compiler can *prove* is primitive emits exactly as it did before — raw, zero overhead, byte-for-byte identical output. Provably-primitive cases include: a prop declared `String` / `Number` / `Boolean`, a `$data` field initialized to a primitive literal, `.length`, `typeof x`, comparisons (`a > b`, `a === b`), `!x`, `String(...)` / `Number(...)`, string concatenations, and logical chains whose operands are all primitive (`$props.a && $props.b`). When the compiler can't prove primitiveness (a bare method call, an untyped prop, a member of an untyped object), it wraps — the safe default, since a false *raw* is the crash and a false *wrap* is merely a stringified primitive.

**Boolean HTML attributes are never wrapped** on any target — `:disabled`, `:hidden`, `:open`, `:readonly`, etc. always emit raw, so a bound boolean value stays a boolean rather than becoming the always-truthy string `"false"`.

Per-target mechanics:

- **Vue** is untouched — its native `toDisplayString` already produces the same output, so wrapping would be redundant.
- **React, Solid, Svelte, Lit** import `rozieDisplay` from their Rozie runtime package only when a wrap actually fires.
- **Angular** can't call an imported free function (and its `json` pipe quotes strings), so it inlines the helper as a module-scope function plus a delegating component method — no runtime package required.

### Turning it off — `safeInterpolation`

The wrap is **on by default** and can be disabled globally or per component. Disabling reverts to the old raw per-target emit (re-exposing the `[object Object]` / React-crash behavior — your informed choice):

- **Globally** via the compiler option / plugin option: `compile(src, { safeInterpolation: false })`, `rozie({ safeInterpolation: false })` (unplugin), or the CLI flag `--no-safe-interpolation`.
- **Per component** via the SFC envelope attribute: `<rozie safe-interpolation="false">` (or `="true"` to force it on for one component when the global default is off).

Precedence is **envelope attribute › global option › default (on)** — a single component can opt out while the rest of the project keeps the wrap, or opt back in when the project default is off.

### Bare `$props` / `$data` / `$refs` / `$slots` is a compile error (ROZ978)

A *bare, whole-object* sigil — <span v-pre>`{{ $data }}`</span> or `$props` used alone, as opposed to a member access like <span v-pre>`{{ $data.columns }}`</span> — has no portable representation in v1 and leaked the literal identifier into emitted output (rendering on Vue, empty on Angular, runtime "not defined" on React/Solid/Lit, a hard build error on Svelte). Rozie now rejects it uniformly with **ROZ978** in any template, `<script>`, or `<listeners>` expression, and the hint points you at a specific member (which now renders as JSON automatically). This diagnostic is **always on** — it is independent of `safeInterpolation`. Member access is unaffected, and `$attrs` / `$listeners` (legitimate whole-object fallthrough) are explicitly exempt.

## Smaller wins

A grab-bag of little decisions that add up:

- **`r-*` instead of `v-*`**. Deliberately distinct from Vue so `.rozie` files are visually unambiguous. Same vocabulary (`r-if`, `r-else`, `r-for`, `r-model`, `r-show`), no aliasing confusion in mixed-framework codebases.
- **<span v-pre>`{{ }}`</span> allowed inside plain attribute values**. Vue forbids <span v-pre>`<a href="{{ url }}">`</span> and forces `:href="url"`. Rozie's template parser handles both forms, picking the cheaper emit path automatically.
- **Rich inline JS expressions in handlers**. `@click="$props.closeOnBackdrop && close()"` is fine; you're not limited to Vue's simple-expression form or method-name-only handlers.
- **Setup-once reactivity**. Closures in `<script>` run once at component setup, not per render. This matches Vue/Svelte/Solid expectations and means a counter like `let n = 0; const incr = () => n++` works the way a non-React developer would expect — no `useCallback`/dependency-array gymnastics in the source.
- **Per-statement source maps**. Errors thrown by emitted code map back to the original `.rozie` line, including statements inside `$computed`, `<listeners>` handlers, and embedded template expressions.
- **Optional TypeScript**. `.rozie` source can be plain JS; emitted output is `.tsx` / `.ts` / `.vue` / `.svelte` regardless, with prop types synthesized from `<props>` shapes.
- **Web components, same source**. The Lit target emits a standards-based custom element from the same `.rozie` file — a framework-agnostic consumer that drops into any HTML page, no build step required at the consumption site.
- **Auto kebab/camel-case prop conversion**. `:on-close="..."` in the template lines up with `onClose` in `<props>`. Angular's selector-form tags and Vue's kebab-template idiom both fall out for free.
- **HTML comments work everywhere**. `<!-- ... -->` inside `<template>` is preserved through the parse and stripped from emit so the comment doesn't leak into a Vue render function or a React `JSX` text node.
