---
spike: 001
name: sortablejs-port
type: standard
validates: "Given a vanilla-JS-engine library (SortableJS), when wrapped as one `.rozie` source, then `@rozie/cli` emits idiomatic compile-clean output for all 6 targets (React, Vue, Svelte, Angular, Solid, Lit)."
verdict: VALIDATED (post-fix 2026-05-18)
related: []
tags: [dogfood, killer-component-port, phase-999.1, vanilla-js-wrapper, sortablejs, compiler-bug, resolved]
---

# Spike 001: SortableJS Port

First hands-on probe of backlog Phase 999.1 (post-v1 killer-component port seed list). The leverage criterion under test: a single `.rozie` source wrapping the framework-agnostic SortableJS engine should produce 6 idiomatic, compile-clean target outputs — proof that the Rosetta-stone framing holds for the kind of vanilla-JS-engine wrapper that today requires 6 separately-maintained packages (react-sortablejs, vuedraggable, ngx-sortablejs, svelte-dnd-action, ...).

## What This Validates

**Given** a vanilla-JS-engine library (SortableJS — `new Sortable(el, opts)` + `.destroy()`, fires `onStart`/`onEnd`/`onUpdate`/`onAdd`/`onRemove`/`onSort` callbacks),
**when** wrapped in a single `<rozie name="Sortable">` source under ~40 lines (props pass-through, default slot for draggable children, `$onMount`/teardown lifecycle, `$emit` per SortableJS event),
**then** `node packages/cli/dist/bin.cjs build … --target react,vue,svelte,angular,solid,lit` produces 6 emitted artifacts that each pass a top-level syntax check (`tsc --noEmit`).

## Research

SortableJS API surface (confirmed via repo docs):

| Surface | Shape |
|---|---|
| Constructor | `new Sortable(el, options)` |
| Teardown | `instance.destroy()` |
| Core options | `animation` (ms, default 150), `handle` (selector), `disabled` (bool), `group` (string), `draggable` (selector) |
| Core events | `onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`, `onSort` (also `onMove`, `onChange` — deferred) |
| Event object | `{ item, to, from, oldIndex, newIndex, oldDraggableIndex, newDraggableIndex, clone, pullMode }` |

Approach comparison:

| Approach | Trade-off | Chosen? |
|---|---|---|
| Enumerate every SortableJS option as a discrete `<props>` entry | Maximal type safety, ergonomic, but ~30 options × 6 emitters to maintain | No — over-eager for a spike |
| Single `options: Object` pass-through prop + a couple convenience props | Minimal source, defers option-shape to SortableJS itself | **Yes** |
| Wrap each event in `<listeners>` block | Mismatches model — these are JS callback options on the constructor, not DOM events on the element | No |
| `$el` for the root element | Documented in Modal.rozie as supported | **Tried and failed** — see Finding 1 |
| `ref="listEl"` + `$refs.listEl` | Documented escape route (used by Modal's `$refs.dialogEl`) | **Used** |

## How to Run

```bash
# From repo root:
node packages/cli/dist/bin.cjs build \
  .planning/spikes/001-sortablejs-port/Sortable.rozie \
  --target react,vue,svelte,angular,solid,lit \
  --out .planning/spikes/001-sortablejs-port/dist
```

Syntax-check the four targets that emit standalone `.ts(x)` files:

```bash
# Stage files into an isolated temp dir to avoid pulling project tsconfigs:
SPIKE_DIR=$(pwd)/.planning/spikes/001-sortablejs-port/dist
mkdir -p /tmp/rozie-spike-check/{react,solid,angular,lit}
cp "$SPIKE_DIR"/react/.planning/spikes/001-sortablejs-port/Sortable.tsx   /tmp/rozie-spike-check/react/
cp "$SPIKE_DIR"/solid/.planning/spikes/001-sortablejs-port/Sortable.tsx   /tmp/rozie-spike-check/solid/
cp "$SPIKE_DIR"/angular/.planning/spikes/001-sortablejs-port/Sortable.ts  /tmp/rozie-spike-check/angular/
cp "$SPIKE_DIR"/lit/.planning/spikes/001-sortablejs-port/Sortable.ts      /tmp/rozie-spike-check/lit/
cd /tmp/rozie-spike-check
for d in react solid angular lit; do
  echo "=== $d ==="
  npx tsc --noEmit --target es2022 --module esnext --moduleResolution bundler \
    --jsx preserve --experimentalDecorators --skipLibCheck "$d"/Sortable.* 2>&1 \
    | grep -E "TS1232|TS17[0-9]+" || echo "(no syntax errors)"
done
```

(`TS2307: Cannot find module 'react' / 'sortablejs' / ...` is expected noise — the temp env has no deps. Only `TS1232` and parser-class errors are real findings.)

## What to Expect

- Vue and Svelte: zero syntactic errors. The script imports land at module top.
- React, Solid, Angular, Lit: each surface **`TS1232: An import declaration can only be used at the top level of a namespace or module.`** at the line where the user wrote `import SortableJS from 'sortablejs'`.

## Investigation Trail

**Iteration 1 — `$el` in script context.** First draft used `new SortableJS($el, ...)` per the documented Modal.rozie comment ("$el — root element access for vanilla-JS lib integration"). All 6 outputs emitted `$el` as a literal free identifier — except Lit, which correctly lowered it to `this`. Grepping `packages/core/src` for `$el` showed it's wired only for:
- `<listeners>` block target decoding (`lowerListeners.ts:38` — `'$el'` as the implicit self-target)
- `STABLE_IDENTIFIERS` in `computeDeps.ts:50` (skip-in-deps)
- The Lit emitter's script identifier handling

There is **no script-context `$el` → per-target-root-ref lowering** in 5 of 6 emitters. The Modal.rozie comment is aspirational documentation; the compiler treats general `$el` use in script as a free identifier.

→ Pivoted to `ref="listEl"` + `$refs.listEl`, which is the documented escape route Modal actually uses (`$refs.dialogEl`).

**Iteration 2 — `$refs.listEl` works cleanly in all 6 targets.** Per-target ref idiom comparison:

| Target | Declaration | Template | Access |
|---|---|---|---|
| Vue | `const listElRef = ref<HTMLElement>()` | `ref="listElRef"` | `listElRef.value` |
| React | `const listEl = useRef<HTMLDivElement \| null>(null)` | `ref={listEl}` | `listEl.current` |
| Svelte | `let listEl = $state<HTMLElement \| undefined>(undefined)` | `bind:this={listEl}` | `listEl` |
| Solid | `let listElRef: HTMLElement \| null = null` | `ref={(el) => { listElRef = el }}` | `listElRef` |
| Angular | `viewChild<ElementRef<HTMLDivElement>>('listEl')` | `#listEl` | `.listEl()?.nativeElement` |
| Lit | `@query('[data-rozie-ref="listEl"]')` | `data-rozie-ref="listEl"` | `this._refListEl` |

This is the headline good news: from one `ref="listEl"` + `$refs.listEl` source, the compiler emits 6 different *idiomatic* ref idioms. The leverage criterion is **met for ref/template plumbing.**

**Iteration 3 — User `import` not hoisted in 4 of 6 targets.** The single `import SortableJS from 'sortablejs'` in `<script>` lands at:

| Target | Position of user import | Valid ES syntax? |
|---|---|---|
| Vue | File top (line 32, inside `<script setup>` which IS module top) | ✅ |
| Svelte | File top (line 34, inside `<script lang="ts">` which IS module top) | ✅ |
| React | Inside the component function body (line 27, between `useRef` calls and `useEffect`) | ❌ TS1232 |
| Solid | Inside the component function body (line 42) | ❌ TS1232 |
| Angular | Inside the constructor body (line 35) | ❌ TS1232 |
| Lit | Inside `firstUpdated()` method body (line 43) | ❌ TS1232 |

**Root cause hypothesis:** the script-lowering pass emits user-authored `<script>` statements at the position where the per-target "body" lives. For Vue and Svelte that body IS module top — the bug is invisible. For React/Solid (function component body), Angular (constructor body), and Lit (method body), it puts ES imports inside a function/method/class-member scope, which is a hard syntax error.

This blocks **any** dogfood port that wraps a third-party library — i.e., literally the entire Phase 999.1 candidate list (flatpickr, Mapbox, TipTap, Chart.js, CodeMirror, SortableJS, Uppy, FullCalendar). Every one of these starts with `import LibName from 'lib-name'`.

## Results

**Verdict: PARTIAL at spike close (2026-05-17). Both bugs CLOSED in quick task 260517-our (2026-05-18) — verdict re-promoted to VALIDATED.**

### Resolution (added 2026-05-18)

Quick task `260517-our-hoist-user-script-imports-lower-script-c` landed in 3 commits on 2026-05-18:

- `dacd37e` — fix(quick-01): hoist user `<script>` ImportDeclarations to module top in React/Solid/Angular/Lit (Spike 001 B1)
- `e63195a` — fix(quick-01): lower script-context `$el` to `$refs.__rozieRoot` in 5 targets via synthesised root RefDecl (Spike 001 B2)
- `432c26c` — test(regressions): add SPIKE-001-script-imports-and-el fixture covering B1 + B2 across 6 targets
- merge: `b0f3dc8`

**Verification re-run against patched compiler (orchestrator-level, 2026-05-18):**

| Target | TS1232 (B1) | `$el` lowered (B2) |
|---|---|---|
| Vue | (n/a — was already clean) | ✅ 0 literal `$el` in emitted output |
| Svelte | (n/a — was already clean) | ✅ 0 literal `$el` |
| React | ✅ no TS1232 | ✅ 0 literal `$el` |
| Solid | ✅ no TS1232 | ✅ 0 literal `$el` |
| Angular | ✅ no TS1232 | ✅ 0 literal `$el` |
| Lit | ✅ no TS1232 | ✅ 0 literal `$el` |

Re-ran `node packages/cli/dist/bin.cjs build .planning/spikes/001-sortablejs-port/Sortable.rozie --target react,vue,svelte,angular,solid,lit` after rewriting the source to use the originally-aspirational `$el` (no `ref="listEl"` workaround). All 6 emitted artifacts pass `tsc --noEmit` cleanly (modulo expected `TS2307: Cannot find module 'sortablejs'` noise from the isolated /tmp env).

**Sample post-fix React output** (`dist/react/.../Sortable.tsx`):
```tsx
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './Sortable.module.css';
import SortableJS from 'sortablejs';   // ← B1 fix: lands at module top
// ...
export default function Sortable(_props: SortableProps): JSX.Element {
  // ...
  const __rozieRoot = useRef<HTMLDivElement | null>(null);  // ← B2 fix: synthesised ref
  useEffect(() => {
    instance.current = new SortableJS(__rozieRoot.current, { /* ... */ });
    // ...
  });
  return <div ref={__rozieRoot} ...>{...}</div>;
}
```

The IR-lowering route (`packages/core/src/ir/lowerers/lowerRootElementRef.ts`) synthesises a `RefDecl { name: '__rozieRoot' }` plus a `ref="__rozieRoot"` root-template AttributeBinding whenever free `$el` is read in script/lifecycle/watcher bodies. Each per-target `rewriteScript.ts` then rewrites `$el` → `MemberExpression($refs, __rozieRoot)` which flows through the existing `$refs.X` lowering machinery — six different per-target ref idioms emerge from a single `$el` source token.

**v1 limitation documented in `lowerRootElementRef.ts`:** when the user has already declared `ref="X"` on the root element, no `__rozieRoot` synthesis happens — `$el` falls through unchanged. Workaround: use `$refs.X` directly instead of `$el`.

**Original investigation (pre-fix) follows below for historical record:**

---

**Verdict (at spike close, 2026-05-17): PARTIAL.**

What works:
- Vue and Svelte targets emit clean, idiomatic, syntactically valid output for the wrapper.
- `$refs.X` is correctly lowered to 6 different target-native ref idioms (Vue templateRef, React useRef, Svelte bind:this, Solid callback ref, Angular viewChild, Lit @query) from a single source — the headline Rosetta-stone proof point.
- Per-target lifecycle mapping (`$onMount` with returned teardown) lands correctly in all 6 targets (`onMounted`/`onBeforeUnmount`, `useEffect`+return, `$effect`+return, `onMount`+`onCleanup`, `inject(DestroyRef).onDestroy`, `firstUpdated`+`_disconnectCleanups`).
- Per-target event mapping (`$emit('start', e)`) lands correctly: Vue `emit('start', e)`, React `props.onStart?.(e)`, Svelte `onstart?.(e)`, Solid `_props.onStart?.(e)`, Angular `this.start.emit(e)`, Lit `dispatchEvent(new CustomEvent('start', {detail: e, bubbles, composed}))`.

What's broken:
- **B1 (P0): User `import` statements in `<script>` are not hoisted to module top in 4 of 6 targets.** Any `.rozie` that wraps a third-party library fails `tsc` with `TS1232` for React/Solid/Angular/Lit. This blocks the entire Phase 999.1 candidate list.
- **B2 (P1): `$el` in script context is not lowered in 5 of 6 targets.** Documented in `examples/Modal.rozie` as "root element access for vanilla-JS lib integration" but only Lit's emitter rewrites it (→ `this`); the other 5 emit the literal identifier and produce runtime `ReferenceError`s. Documented workaround (`ref="X"` + `$refs.X`) does work — but the doc/behavior mismatch is a trust-erosion issue.

## Signal for the Build

If Phase 999.1 is going to land any vanilla-JS-engine port in the v1.1 timeframe, two compiler fixes are pre-requisites — neither is in the existing ROADMAP:

1. **(B1) Hoist user-authored `<script>` `import` statements to module top in React/Solid/Angular/Lit emitters.** The cleanest implementation likely lives in the script-lowering pass: partition the AST into `(imports, body)` and emit imports above the component function/class while emitting the body inside it. This is a meaningful compiler change, not a one-line fix — needs new test fixtures covering "wrapper component imports a third-party engine."
2. **(B2) Either lower `$el` in script context across all 6 targets, OR emit a clean diagnostic and remove the aspirational documentation.** If lowered, the per-target rewrites are mechanical: `$el` → `templateRef.value` (Vue) / `ref.current` (React via a synthetic root-ref) / `nodeRef` (Svelte via a synthetic `bind:this`) / `rootRef` (Solid) / `elementRef.nativeElement` (Angular via `inject(ElementRef)`) / `this` (Lit, already done).

Once those land, the Phase 999.1 candidate slate is unblocked. Until then, the dogfood-port narrative is half-real: it works for Vue/Svelte authors but breaks for the 4 ecosystems where the cross-framework story matters most (Svelte and Solid devs are the named beneficiaries in the ROADMAP, and Solid is one of the 4 broken targets).

**Suggested follow-up spikes:**
- Spike 002 — flatpickr port, but **using a fixture without user imports** (mock the SortableJS-equivalent inside `<script>` as `globalThis.flatpickr`) to isolate `r-model:value` two-way binding behavior across all 6 targets from the import bug.
- Spike 003 — prototype the import-hoisting fix in a worktree branch; re-run this spike against the patched compiler; verify all 6 targets become TS1232-clean.
