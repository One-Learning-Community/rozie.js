# Reactivity & lifecycle

The reactive primitives: `$onMount`, `$computed`, `$memo`, `$watch`, and `$refs`, each lowered to the target framework's native mechanism.

## `$onMount` returning a teardown

`$onMount` is a hook; its return value, if a function, runs at unmount. The pattern is identical to React's `useEffect`, but `$onUnmount` is also available as a standalone hook for clarity. Multiple of either colocate with their logic:

```rozie
<script>
// Setup + teardown that belong together — one hook.
$onMount(() => {
  const ctrl = new AbortController()
  fetch('/api/init', { signal: ctrl.signal }).then(...)
  return () => ctrl.abort()
})

// Independent concerns — separate hooks, same component.
$onMount(lockScroll)
$onUnmount(unlockScroll)

$onMount(() => {
  $refs.dialogEl?.focus()
})
</script>
```

Source order is preserved per-target so the framework's lifecycle ordering is predictable.

## `$computed(() => ...)` — derived reactive values

`$computed(() => expr)` declares a value derived from other reactive state — re-evaluated automatically whenever a reactive read inside the getter changes. Each target compiles it to its native derived-reactivity primitive, and **you read it by its bare name** everywhere — in templates, interpolations, and `<script>`:

```rozie
<data>{ query: '', options: [] }</data>

<script>
const visibleOptions = $computed(() =>
  $data.options.filter((o) => o.label.includes($data.query))
)

const hasMatches = $computed(() => visibleOptions.length > 0)
</script>

<template>
  <ul>
    <li r-for="opt in visibleOptions" :key="opt.id">{{ opt.label }}</li>
  </ul>
  <p r-if="!hasMatches">No matches</p>
</template>
```

Note the bare reads — `visibleOptions`, never `visibleOptions()`. The emitter rewrites each bare reference to the per-target access form for you, so the same source reads correctly on all six:

| Target | Primitive | Bare read `visibleOptions` lowers to |
| --- | --- | --- |
| Vue | `computed()` → `Ref<T>` | `visibleOptions.value` |
| React | inlined `useMemo` value | the memoized value (value form) |
| Svelte 5 | `$derived` | the derived value (value form) |
| Angular | `computed()` signal | `this.visibleOptions()` |
| Solid | `createMemo` → **accessor function** | `visibleOptions()` |
| Lit | preact-signal | `this.visibleOptions.value` |

### Read it bare — don't alias the memo into a local

There is one target-divergence to know about, and it has a clean rule that sidesteps it entirely: **never alias a `$computed` into a local in `<script>` and then index or call the alias.** The emitter rewrites *bare reads* of a computed name, but it does **not** rewrite the right-hand side of an assignment — and on Solid a `$computed` is backed by a `createMemo` **accessor function**, not a value:

```rozie
<script>
// ❌ Target-divergent — the alias captures different things per target:
const o = visibleOptions
// On React/Vue/Svelte/Angular/Lit, `o` is the derived VALUE → `o.length` works.
// On Solid, `o` is the memo ACCESSOR FUNCTION → `o.length` is `undefined`
//   and `o.findIndex(...)` / `o[i]` are type errors (TS2339) — you'd have to
//   write `o()` on Solid and bare `o` on the other five. There is no single
//   source form that works on all six.
const first = o[0]
</script>
```

The same divergence bites if you pass a `$computed` name as a plain value into other code that indexes or iterates it. As long as you only read the computed **bare** (in a template, an interpolation, an `r-for` iterable, or a simple expression that the emitter rewrites), you never hit this — the access form is handled for you.

### When you need to alias and index — use a plain function

If you genuinely need a derived value that you alias into a local and then index, call, or pass around in handler/`<script>` logic, **don't reach for `$computed` — write a plain function and call it with `()` everywhere.** A normal function is uniform across all six targets (it's a function on every one of them), so `const o = currentOptions()` followed by `o.length` / `o.findIndex(...)` behaves identically:

```rozie
<data>{ query: '', options: [] }</data>

<script>
// ✅ A plain function — uniform on all six. Call it with () at every use site,
//    in <script> and in templates alike.
const currentOptions = () =>
  $data.options.filter((o) => o.label.includes($data.query))

const selectFirst = () => {
  const o = currentOptions()        // a value on every target
  if (o.length) select(o[0])        // indexes/iterates identically everywhere
}
</script>

<template>
  <li r-for="opt in currentOptions()" :key="opt.id">{{ opt.label }}</li>
</template>
```

The trade-off is that a plain function is **not** memoized — it re-runs at every read instead of caching until a dependency changes. For most derivations (filtering a list, computing a flag) that cost is negligible, and the gain is one access form that reads the same on all six targets. Reserve `$computed` for the values you read **bare** and never alias-then-index; reach for a plain function the moment you need to capture a derived value in a local and operate on it.

::: tip Rule of thumb
Read a `$computed` bare (template, interpolation, simple expression) and the access form is handled for you on all six targets. The moment you want to alias it into a local and index/call/iterate that local, switch to a plain function called with `()` — it's the clearer, target-uniform form.
:::

Reading `$refs` inside a `$computed` body is a compile error (`ROZ123`) for the same reason it is in a `$watch` getter — the computed evaluates eagerly, before the ref is populated. See [`$refs`](#refs-derived-from-ref) below.

## `$memo(fn, keyFn)` — a memoized plain function, uniform on all six

The plain-function escape hatch above (`## $computed` § "When you need to alias and index") trades memoization for a single, target-uniform access form — fine for a cheap filter, wasteful for an O(N) re-map called on every keystroke or scroll tick. `$memo(fn, keyFn)` gives you both: a plain function you call with `()` everywhere (uniform on all six, safe to alias/index/iterate), memoized against a **reference-keyed** cache so it only re-runs `fn` when `keyFn`'s inputs actually change identity:

```rozie
<props>{ items: { type: Array, default: () => [] } }</props>
<data>{ query: '' }</data>

<script>
const filtered = $memo(
  // fn — the expensive computation, run only on a cache MISS.
  () => $props.items.filter((item) => item.includes($data.query)),
  // keyFn — read EVERY reactive input fn depends on, unconditionally.
  () => [$props.items, $data.query],
)
</script>

<template>
  <li r-for="item in filtered()" :key="item">{{ item }}</li>
</template>
```

`$memo` must be bound to a **top-level `const`** with exactly **two arrow-function arguments** — `fn` (the computation) and `keyFn` (the cache key, returning an array). Anything else — a `let`-bound declaration, the wrong number of arguments, a call nested inside a function — is a compile error (`ROZ146`) rather than a silently-broken cache.

### The reference-key contract

On a call, `$memo` first evaluates `keyFn()` and compares the result **element-by-element by reference/value equality (`===`)** against the previous call's key. If every element matches, `fn` does **not** re-run — the previous return value is reused as-is (no re-map, no new object identities). On any mismatch, `fn()` runs and the new key + value are cached for next time.

::: warning keyFn must read every reactive input fn depends on
This is the one rule that makes `$memo` safe: **`keyFn` must read — unconditionally, every call — every piece of reactive state that `fn` reads.** `keyFn` is evaluated *before* the cache-hit check, on every single call, which is exactly what makes it the fine-grained reactive **subscription** surface on Solid/Svelte/Vue (a signal/rune/ref read only counts as a subscription if it actually executes). If `keyFn` under-reads relative to `fn` — skips a prop or data field `fn` depends on — the cache will return a stale value on a change `keyFn` never noticed, and on Solid/Svelte/Vue the memoized function will stop re-running at all for that input. Read every input `fn` touches, even ones `fn` only reads on a code path that IS taken this call — array/object references compare by identity, so passing `$props.items` (the array reference) rather than something derived from it is what makes an unmodified list a cache hit.
:::

### Why `$memo` and not `$computed`?

They answer different questions. `$computed` asks *"which reactive values did my getter read?"* and re-runs when **any** of them changes — invalidation is decided by dependency tracking, at the granularity the framework tracks. `$memo` asks *"did my declared key change identity?"* and re-runs **only** then — invalidation is decided by you, with plain `===` checks and no reactive subscription inside the computation at all.

That difference is invisible for cheap derivations and decisive for expensive ones over reactive collections. The motivating case is real: Rozie's own `Combobox` maps a 1,000-option list into windowed row wrappers, and a virtualizer calls that derivation O(count) times per scroll pass. As a dependency-tracked computed on Vue, every evaluation re-tripped a reactive Proxy trap per option read — a 60-keypress navigation batch measured **~16 seconds**. The same derivation behind a reference-keyed cache is four `===` comparisons per call and one `.map()` per *actual* input change: the trap churn and the re-maps disappear, because "the `options` array is the same reference as last time" is something dependency tracking cannot express but a `$memo` key states directly.

| You want | Reach for |
| --- | --- |
| A cheap derived value (a ternary, a field read, string concat) | A **plain function** — recomputing costs less than any caching machinery |
| A derived value that should update whenever anything it reads changes, and computing it is moderate | **`$computed`** — dependency tracking is exactly the right contract, and the framework owns invalidation |
| An expensive derivation (O(N) map/filter over a large list) called from a hot path, whose inputs change far less often than it's called | **`$memo`** — coarse, identity-keyed invalidation you declare yourself, zero subscription overhead in the computation |

### Per-target lowering

`$memo` expands in the SHARED core compiler — before any per-target emission — into two ordinary declarations: a member-mutated cache object and the wrapper function you call. There is no per-target `$memo` runtime:

| Target | Lowering |
| --- | --- |
| React | The cache object is a top-level `const` that gets member-mutated on every miss — the **existing** fresh-instance-stabilization pass (the same one that fixes `const seen = new Set()` dedupe guards) detects this shape automatically and wraps it in `useMemo(() => ({...}), [])`, so the cache persists across renders. The wrapper stays a plain function, called `()` — the same idiom as `filteredOptions()` today. |
| Vue / Svelte / Solid / Angular / Lit | Setup runs once, so the cache const and the wrapper function are both ordinary top-level `const`s — no wrapping needed. |

Because the expansion is a pure core AST transform, a `.rozie` file with no `$memo` call compiles **byte-identically** whether or not the pass runs — `$memo` adds zero overhead and zero drift to every existing component.

Reach for `$memo` when a plain-function derivation is expensive (an O(N) filter/map over a large list, called from a hot path like windowed scrolling or keyboard navigation) and the inputs it depends on don't change every call. For a cheap derivation, the plain-function form above is simpler and the memoization overhead isn't worth it.

## `$watch(() => getter, cb)` — react to value transitions

`$watch` is the primitive for "do something whenever this value changes." The getter is what the watcher subscribes to; the callback runs whenever a reactive read inside the getter flips:

```rozie
<script>
$watch(() => $props.open, () => {
  if ($props.open) reposition()
})
</script>
```

### Lazy by default — never fires with the initial value

`$watch(getter, cb)` is **lazy**: the callback runs **only when the watched value changes** after mount, and is **never** invoked with the initial value. This mirrors Vue's default `watch()`, and Rozie holds it uniform across all six targets — react, vue, svelte, angular, solid, and lit all skip the first run.

This is the right tool when `$onMount` is too early. A common case: an element gated by `r-if` is undefined at mount time, but the consumer toggles the gate later — `$watch` fires after the transition, when the ref is finally populated. Because the initial value is skipped, engine-wrapper reconcilers (`instance?.set(...)`) never fire against a not-yet-constructed engine at mount.

Each target compiles the lazy form to its native effect primitive, skipping the first callback invocation:

| Target | Expansion (lazy default) |
| --- | --- |
| Vue | `watch(() => open.value, () => { /* cb */ }, { flush: 'post' })` — Vue's native lazy `watch`, post-flush |
| React | `useEffect(() => { if (_watch0First.current) { _watch0First.current = false; return; } /* cb */ }, [open, /* closure refs */])` — a `useRef(true)` first-run skip; the ref stays **out** of the dep array (refs are exempt from `react-hooks/exhaustive-deps`) |
| Svelte 5 | `$effect(() => { const __v = (() => open)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => { /* cb */ })(__v); }); })` — the first-run flag is read/written inside `untrack` so it does not self-subscribe |
| Angular | `effect(() => { const __v = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } /* cb */ }); })` |
| Solid | `createEffect(on(() => (() => props.open)(), (v) => untrack(() => (/* cb */)(v)), { defer: true }))` — Solid's idiomatic `on(..., { defer: true })` runs the getter to establish tracking but skips the first callback |
| Lit | props route → `if (this.hasUpdated && changedProperties.has('open')) { /* cb */ }` inside `updated()` (`hasUpdated` is `false` on the first cycle); effect route → `effect(...)` from `@lit-labs/preact-signals` with a class-field first-run flag inside `untracked`, handle pushed onto the disconnect-cleanup drain |

Vue watchers are **post-flush by construction** — every `$watch` lowering carries `{ flush: 'post' }` (merged with `{ immediate: true }` into a single options object when the author opts in). This matches the other five targets, all of which are post-render by nature (`useEffect`, `createEffect`, `effect()`, `$effect`, `updated()`). A `$watch` **callback** may therefore safely read `$refs` — the DOM has already been patched by the time it runs. This is unlike a `$watch` **getter**, which still evaluates eagerly at tracking time and is still a compile error (`ROZ123`, see [below](#refs-derived-from-ref)) if it reads `$refs`.

### `{ immediate: true }` — opt back into the eager initial fire

Pass `{ immediate: true }` as the third argument to restore an eager fire with the initial value at watcher-setup time (Vue's `{ immediate: true }` semantic):

```rozie
<script>
// Live feed defaults on — start the interval at mount, then re-evaluate
// every time the toggle flips.
$watch(() => $data.liveFeed, (on) => {
  if (on) start() else stop()
}, { immediate: true })
</script>
```

::: warning Ordering relative to `$onMount` is target-dependent
The `immediate` initial fire happens at watcher-setup time, which lands **before** `$onMount` on vue/angular and **after** it on react/svelte/solid/lit. Do **not** use `{ immediate: true }` for engine-instance reconciliation that depends on the engine already existing — that's exactly what the lazy default plus an `$onMount` build is for. Reserve `immediate` for self-contained side effects (timers, derived-state sync) that don't touch an engine handle.
:::

### React member-chain getters evaluate eagerly, including on first render

When the getter is a **derived member chain** (e.g. `() => $props.a.b`, more than one property hop off `$props`/`$data`), React's dep array holds the **rendered getter expression itself** (`[props.a.b]`), not just the root prop identity (`[props.a]`). That means the chain is **dereferenced at every render, including the first** — matching Vue/Solid/Svelte/Angular, all of which evaluate a `$watch` getter eagerly regardless of the lazy-fire-vs-eager-fire distinction above (lazy only gates the *callback*, not the *getter read*).

```rozie
<script>
// If $props.a can be undefined at mount, this throws during React's FIRST
// render (a.b dereferences undefined) — it does not "wait" for a to exist.
$watch(() => $props.a.b, (v) => { /* cb */ })
</script>
```

Prior to this eager-dependency fix, React's dep array narrowed a member chain to its root identity (`[props.a]`) and never dereferenced `.b` in the dependency computation — so the same getter mounted fine even when `a` was `undefined` at mount, and only threw later once the watcher's lazy callback actually ran (if it ever did). That was a silent cross-target divergence: Vue/Solid/Svelte/Angular already crashed in this situation, and React quietly didn't. The current behavior is **crash-parity with the other five targets** and is the correct trade — but it is a real, late-documented behavior change for existing React consumers whose watched chain can be `undefined` at mount.

If your chain's intermediate can genuinely be absent at mount, guard it explicitly:

```rozie
<script>
$watch(() => $props.a?.b, (v) => { /* cb */ })
</script>
```

### Change detection is reference equality (`!==`)

The watcher fires when the getter's return value is `!==` its previous value. A getter that returns a **fresh object or array reference every run** therefore fires on **every** reactive tick:

```rozie
<script>
// ⚠️ returns a new object each evaluation → fires every tick
$watch(() => ({ ...$data.config }), cb)

// ✅ watch a stable reference, or a primitive derived from it
$watch(() => $data.config, cb)
</script>
```

This matches Vue's documented `watch` behavior — it's an author-controlled getter shape, not a compiler defect.

Single-getter form only — array-of-getters and the `oldValue` callback parameter are not in scope, and the only supported third-arg option is `{ immediate: true }`. Malformed calls emit a soft `ROZ109` diagnostic and are skipped rather than crashing the compiler.

## `$refs` derived from `ref="..."`

No separate `<refs>` block. Any element with `ref="name"` becomes available as `$refs.name` in both `<script>` and `<template>`. Whatever type the underlying framework gives you (DOM node, component instance), `$refs.name` exposes it directly:

```rozie
<script>
const reposition = () => {
  if (!$refs.panelEl || !$refs.triggerEl) return
  const rect = $refs.triggerEl.getBoundingClientRect()
  Object.assign($refs.panelEl.style, { top: `${rect.bottom}px`, left: `${rect.left}px` })
}

$onMount(() => {
  // Vanilla-JS library integration — direct DOM handle, no framework wrappers.
  // new Popper($refs.triggerEl, $refs.panelEl, { placement: 'bottom-start' })
})
</script>

<template>
  <button ref="triggerEl" @click="toggle">Open</button>
  <div r-if="$props.open" ref="panelEl" class="dropdown-panel"><slot /></div>
</template>
```

This is the integration story for component libraries that wrap vanilla-JS engines (focus-trap, popper, downshift-style state machines): one `$refs.x` access, idiomatic per-target ref handling on the emit side.

Because `$refs` are only populated after mount, reading them in an eagerly-evaluated position — inside a `$computed(...)` body or `$watch` getter, or in a template binding / `{{ }}` interpolation / `r-if` / `r-show` / `r-for` iterable expression — is a compile error (`ROZ123`); read `$refs` inside `$onMount` (or any callback that runs after mount) instead.

### Element-dependent config: the `$onMount` + `r-if` pattern

Some vanilla-JS engines take a DOM element in their *configuration* (not just as their mount target) — flatpickr's `rangePlugin` second input, a Popper anchor element, a focus-trap container. The config has to be built **after** the element exists, and whatever consumes it has to wait for it:

```rozie
<data>{ plugins: null }</data>

<script>
import rangePlugin from 'flatpickr/dist/plugins/rangePlugin'

// ❌ ROZ123 — $refs is not populated yet when a $computed first evaluates:
// const plugins = $computed(() => [rangePlugin({ input: $refs.endInput })])

// ✅ Build element-dependent config in $onMount, where $refs are live:
$onMount(() => {
  $data.plugins = [rangePlugin({ input: $refs.endInput })]
})
</script>

<template>
  <!-- r-if gates the consumer until the config exists -->
  <Flatpickr r-if="$data.plugins" :plugins="$data.plugins" mode="range" />
  <input ref="endInput" />
</template>
```

Prefer passing **elements** over selector strings to third-party libraries wherever their API allows it. Libraries that resolve selector strings internally (flatpickr's `rangePlugin` does `document.querySelector(...)`) cannot see inside shadow DOM — so a selector that works on five targets silently finds nothing on Lit, where your component's template renders into a shadow root. Passing the `$refs` element sidesteps the lookup entirely and behaves identically on all six targets.
