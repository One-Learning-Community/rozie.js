# Creature comforts

Six-target cross-framework parity forced Rozie to quietly normalize a lot of
behavioral grit. The list below is the side effect: a catalog of papercuts
each framework's users feel daily — and what Rozie does to make them go away.

The framing flips the [compatibility matrix](/compatibility). That page asks
"does feature X work on target Y?" — every answer is ✅. This page asks "what
does Rozie quietly fix that I'd otherwise hand-roll?"

## Cross-framework normalizations

| Pain point | What your framework does today | What Rozie gives you |
| --- | --- | --- |
| **Scoped CSS without CSS-in-JS** | React: CSS-in-JS runtime tax (Emotion, styled-components) or CSS Modules `styles.foo` threading. Lit: bring-your-own scoping. Solid: no native scoper. | `<style>` is scoped by default on every target — React included — via `data-rozie-s-<hash>` attribute-selector rewriting + head-injection on a plain `.css` file. No class-name hashing; you author plain `class="foo"`. `:root { … }` is the unscoped escape hatch. |
| **`querySelector('.cls')` works the same everywhere** | Each framework's scoper differs; engine code that calls `el.querySelector('.grip')` against an authored class has to account for class-name renaming on some targets. | Authored class names render literally on every target (React scopes via `[data-rozie-s-<hash>]`, no hashing), so `querySelector('.grip')` works directly. `$classSelector('grip')` is a typo-checked convenience that lowers to a static `".grip"` literal on every target. ROZ965-967 catch typos at compile time. |
| **Attribute fallthrough** | Vue: `inheritAttrs` exists. React/Solid: hand-roll `{...rest}`. Svelte: `$$restProps` (Svelte 4) or `$$rest` (runes). Angular: no native equivalent — `HostBinding` per attr. Lit: explicit `@property` per attr. | Auto-fallthrough is on by default. `$attrs` is reactive; opt out via `<rozie inherit-attrs="false">`; explicit `r-bind="$attrs"` placement supported. R8 multi-root + R9 double-apply diagnostics. |
| **Listener fallthrough** | Each framework's idiom is different (`$listeners` was Vue 2-only; React passes through; Svelte forwards explicit; Angular nope). | `$listeners` magic accessor lowers per target. Auto-fallthrough on by default. |
| **Two-way binding for non-React stacks** | Vue: `v-model`. Svelte: `bind:`. Angular: `[(ngModel)]`. React: render-prop callback pair. Solid: `createControllableSignal`. Lit: property/attribute pair + `*-change` event. | `model: true` on a prop; `r-model:propName="…"` on a consumer. Compiles to each target's native machinery — including the React controllable-state pattern. On Angular, a single-model component additionally implements `ControlValueAccessor`, so it binds to `[(ngModel)]` / `formControlName` like a native form control. |
| **`:style="{...}"` precedence** | Svelte 5's `STYLES_KEY` runs after spread — `style:<prop>` directives win over spread `style`, the opposite of every other framework. Solid: object-form clobbers if a consumer passes string-form. | `:style="{...}"` lowers consistently. Svelte switches to string-form when auto-fallthrough is active to restore consumer-wins precedence. Solid normalizes static string `style="…"` to object form. |
| **Cross-SFC style cascade** | Per-target style emit that puts `<style>` in the render tree (vs hoisting to `<head>`) silently loses same-specificity cascade when wrappers compose. | Consumer rules win same-specificity races on every target, because `<style>` is head-injected rather than left in the render tree — Solid included. (Solid gets there via an `__rozieInjectStyle` module-top helper: Map-cached, HMR-safe.) |
| **Engine-DOM vs framework reconciler desync** | Vanilla-JS engines (SortableJS, FullCalendar, TipTap, Uppy) mutate DOM directly; lit-html's `repeat` directive caches part identity by sentinel-comment node, so engine-mutated DOM desyncs the cache and renders garbled. Other targets diff against live `parent.children` and survive. | `$reconcileAfterDomMutation()` sigil — no-op on five targets, `render(nothing, host) + requestUpdate()` on Lit. Call it once after writing the new array, before emitting the change event. |
| **`<listeners>` for `document` / `window`** | Each framework reinvents lifecycle-bound `addEventListener` cleanup. React: `useEffect`. Vue: `watchEffect`. Svelte: `$effect`. Angular: `Renderer2.listen` + `DestroyRef`. Solid: `createEffect`. Lit: `connectedCallback` + `disconnectedCallback`. | One `<listeners>` block of `<listener>` elements; a reactive `r-if` on each gates attach/detach. Same grammar on every target. |
| **Parameterized event modifiers** | Vue's modifiers are unparameterized. React et al.: no modifier system. | `@click.debounce(300)`, `@click.outside($refs.a,$refs.b)`, `.throttle(100)`. Same grammar in `<listeners>` and template `@event` bindings. Custom modifiers via the public `registerModifier()` API. |
| **Static compile error on prop mutation** | React: silent broken state. Vue: dev-mode warning. Svelte: silent. Angular: silent. | `$props.foo = x` where `foo` isn't `model: true` is **ROZ200** at compile time. A `model: true` prop is read via `$props.x` but written via `$model.x`; writing it through `$props` is **ROZ204** (it tells you to use `$model`). Caught before the bug lands. |
| **`r-for` without a key** | React: console warning at runtime. Vue: dev warning. Svelte: silent. Angular: silent. | `r-for` without `:key` is a compile-time warning. `:key` set to the loop index is a separate warning. |
| **Mustache interpolation in plain attribute values** | Vue forbids <span v-pre>`class="card card--{{ variant }}"`</span>. React/Solid: template-literal JSX. Svelte: `{var}` directly. Angular: `[class]` binding. | Rozie permits <span v-pre>`class="card card--{{ variant }}"`</span>, <span v-pre>`aria-label="Close {{ $props.title }}"`</span> directly. Compiles to each target's natural form. |
| **Interpolating a non-primitive** | Raw <span v-pre>`{{ obj }}`</span> diverges six ways: Vue pretty-prints JSON, Svelte/Angular comma-join `[object Object]`, Solid/Lit space-join it, and **React throws `Objects are not valid as a React child`** and crashes. | An object renders the **same portable JSON on all six targets**, and React never crashes. Non-provably-primitive interpolations lower through an internal display helper (Vue `toDisplayString` semantics, crash-safe on circular/BigInt); primitives stay raw (byte-identical, zero overhead) and boolean attrs are never wrapped. Opt out per-component (`<rozie safe-interpolation="false">`) or globally (`--no-safe-interpolation`). |
| **Inline expressions in handlers** | Most frameworks force a method or arrow-function wrap. | `@click="$props.closeOnBackdrop && close()"` — inline JS in handler attributes is a first-class authoring path. |
| **Lifecycle hooks colocated, not funneled** | React: one `useEffect` per body, dep arrays. Vue: one `onMounted` block. Svelte: `$effect` blocks. | Multiple `$onMount` / `$onUnmount` / `$onUpdate` calls in source order. Colocate setup with the logic it serves. |
| **`$onMount` may return a cleanup** | React-style; alien to Vue/Angular/Lit authors. | Both forms work and compose. Pick the one that reads better case by case. |

## Per-target pain points Rozie hides

Some of these are framework-specific landmines that the locked-in user can't
escape without leaving the framework. Rozie absorbs them.

| Target | What bites locked-in users | What Rozie does behind the scenes |
| --- | --- | --- |
| **React** | The class-name-as-selector story used to differ from other frameworks (CSS Modules hashing). | React now scopes via `[data-rozie-s-<hash>]` attributes like the other template targets — authored classes render literally, so `querySelector('.x')` works directly. `$classSelector('x')` lowers to a static `".x"` literal on every target. |
| **React** | `useEffect` dep arrays are an exhaustive-deps minefield. | Compiler computes the dep array statically from auto-tracked signal reads. Output passes `eslint-plugin-react-hooks/exhaustive-deps` cleanly. |
| **React** | StrictMode double-fires mount effects. | All reference examples + engine-wrapper demos validated under `<React.StrictMode>`. Paired `$onMount`/`$onUnmount` lower to one `useEffect` with a cleanup return. |
| **Vue** | `defineModel`, `defineProps`, `defineEmits`, `defineSlots` — macro soup. | Rozie emits these for you from `<props>`, `<emits>`, `<slots>` declarations. |
| **Svelte** | Svelte 5's `STYLES_KEY` runs after spread (consumer `style:<prop>` directives win over spread `style`) — opposite of every other framework. | Compiler detects auto-fallthrough and emits string-form `style="…"` to restore consumer-wins precedence. |
| **Svelte** | Native CSS scoper uses class-hash stamping that doesn't reach component-tag invocations. | Rozie's `data-rozie-s-<hash>` selector rewrite + `:global { … }` block opts out of Svelte's scoper; consumer rules targeting child-component roots match correctly. |
| **Angular** | Template DSL ceremony — `*ngFor`, decorator boilerplate, `[(ngModel)]`. | Author in Rozie's Vue-flavored SFC syntax; compiler emits `@for`/`@if` blocks, signals, `model<T>()` inputs, standalone components. |
| **Angular** | Making a custom component work with `[(ngModel)]` / `formControlName` means hand-implementing the four `ControlValueAccessor` methods, the `NG_VALUE_ACCESSOR` provider, and the touched/disabled wiring. | A single-`model: true` component auto-implements `ControlValueAccessor` — view→model on real writes only (no echo loops), `writeValue(null)` → prop default, touched on focusout, disabled OR-merge. Default ON; `angular: { cva: false }` / `--no-cva` opt-out. ROZ124–126 diagnostics cover the edge cases. |
| **Angular** | `viewChild()` signals empty in constructor; `$el`-touching code must run in `ngAfterViewInit`. | `$onMount` lowers to `ngAfterViewInit()` automatically. Paired cleanups register via hoisted `DestroyRef`. |
| **Angular** | `template` parser rejects arrow functions in `*ngTemplateOutlet context` bindings. | Compiler pre-binds slot-context closures and passes the bound reference. |
| **Solid** | `<For>` exposes `index` as `Accessor<number>`, not a scalar — bare references silently break. | Identifier rewriter auto-invokes `index` references in the loop body; shorthand object props expand correctly. |
| **Solid** | Inline `<style>` JSX renders after consumer styles, wiping same-specificity cascade. | Head-injection via `__rozieInjectStyle()` runtime helper. |
| **Lit** | lit-html's `repeat()` caches by sentinel-comment node identity → engine DOM mutation garbles the part tree. | `$reconcileAfterDomMutation()` escape hatch. |
| **Lit** | Web Components have no scoped-CSS bridge to consumer styles. | `adoptConsumerStyles` runtime helper + `data-rozie-s-<hash>` stamping reaches into shadow roots correctly. |
| **Lit** | No native slot parameter API — consumer-side scoped-slot fill needs a transport. | `@property({attribute:false}) X?: (scope) => unknown` + template invocation; consumer-side `.X=${(scope) => html\`…\`}` splice. |

## What's not on the list

Rozie does **not** try to paper over differences in the rendering pipeline
itself. Hydration semantics, SSR boundaries, transitions, suspense, server
components — those are the target framework's concerns and Rozie stays out
of them.

It also doesn't unify what each ecosystem already does well — testing, form
libraries, routing, state management — beyond the surface that a single
component definition needs.

## How to read this page

If you're considering Rozie because you're stuck on one stack, scan the table
for your framework's row and ask: "How many of these am I working around
today?" If the answer is more than two, the [adopt-incrementally walkthrough](/guide/adopt-incrementally)
is the natural next stop.

If you maintain a cross-framework library, the table is the rough shape of
the boilerplate Rozie deletes from your maintenance budget.
