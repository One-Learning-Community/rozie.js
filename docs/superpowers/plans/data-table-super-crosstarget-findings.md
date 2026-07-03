# DataTableSuperDemo — cross-target findings (Task 8)

Source: `examples/demos/DataTableSuperDemo.rozie` — composes `DataTable` + `Column` + 10
drop-ins from SOURCE via `<components>`, compiled per-target by the VR host
(`tests/visual-regression`). Tasks 1–7 built and validated this demo on Vue only. This
task builds all 6 targets and drives it on each, to produce an honest per-target map.

Render-smoke loop lives in `tests/visual-regression/specs/data-table-super.spec.ts`
(`super demo renders a table [<target>]`, one per target). All other tests in that file
remain Vue-only (unchanged scope from Tasks 1–7).

## 0. Build result

`pnpm --filter @rozie/visual-regression build` (no `ROZIE_VR_TARGETS` filter — all 6)
completed **cleanly on the first attempt** — 0 compile errors on any of the 6 targets,
including `solid` (the documented flaky "aggregateBindingErrors" native-rolldown crash
under contention did NOT reproduce this run; no rebuild-in-isolation was needed). This
is the first full 6-target build of this demo since the scaffold — a clean compile
across DataTable + Column + 10 drop-ins composed from source, on all 6 targets, is
itself a meaningful result.

## 1. Render smoke (feature × target)

| Target  | Compiles | Renders (`dt-super` + ≥1 row) |
|---------|:--------:|:-----------------------------:|
| vue     | ✅ | ✅ |
| react   | ✅ | ✅ |
| svelte  | ✅ | ✅ |
| angular | ✅ | ✅ |
| solid   | ✅ | ✅ |
| lit     | ✅ | ✅ |

All 6 targets compile and render the full composed demo (1,500-row dataset, 8 columns,
11 `r-model` slices, 10 cross-tree drop-ins). `pnpm --filter @rozie/visual-regression exec
playwright test data-table-super --reporter=line` → **16/16 passed** (6 new render-smoke
tests + 10 pre-existing Vue-only behavioral tests, unchanged).

## 2. Feature × target matrix (flagged unknowns, driven this task)

Legend: ✅ works · ⚠️ works with a caveat · ❌ broken (symptom + root-cause guess below).

| Feature | vue | react | svelte | angular | solid | lit |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Grid-mode toggle (→ `role=grid`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Imperative panel: `verb-expandAll` → `expanded` readout | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Imperative panel: `verb-applyGrouping` → `grouping` readout | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Theme swap (`ctl-theme`→material) → header bg computed-style change | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ (expected) |
| Grouping via GroupBar UI (seed + render + remove-×) | ✅ | ✅ | ✅ | ❌ (cascades) | ✅ | ✅ |
| `virtual` toggle (`:key`-remount workaround) → real windowed rows | ✅ (22 rows) | ❌ (2 spacer rows) | ❌ (2) | ❌ (2) | ❌ (2) | ❌ (2) |

## 3. Root-cause candidates

### 3.1 `virtual` toggle: `:key`-forces-remount is a VUE-ONLY primitive — compiler gap
**Symptom:** Checking `ctl-virtual` renders 22 real body rows on Vue, but only the 2
zero-height spacer `<tr>`s on react/svelte/angular/solid/lit — i.e. the demo's documented
`:key="String($data.virtual)"` remount workaround (needed because `DataTable`'s
Virtualizer is built once at `$onMount` from the initial `virtual` prop) **only works on
Vue**.

**Root cause (confirmed via emitted output):**
- **React**: the compiled JSX call for `<DataTable>` (`jsx(se,{ref:m,data:f,…})`) carries
  **no `key` prop at all** — `:key` was dropped entirely by the React emitter. Grepping
  the whole bundle for a `key:` prop assignment near the component call finds nothing.
  React DOES support key-forces-remount natively (changing an element's `key` unmounts +
  remounts it) — the gap is that the compiler never emits the `key` JSX attribute for a
  Rozie `:key` binding on a composed child.
- **Svelte**: `:key` compiles to an ordinary reactive **prop** passed into the child
  (`St(Nt(Xe,{get key(){return e(A)}, …`) — a plain `key` prop value, not Svelte 5's
  `{#key expr}…{/key}` keyed-block construct that actually forces destroy/recreate. Since
  `DataTable.rozie` doesn't declare a `key` prop, this is inert data with no remount
  effect.
- **Solid / Angular / Lit**: no `key`/keyed-block/structural-directive handling found
  near the component invocation either — `:key` is either dropped or passed through as an
  inert value, consistent with the observed no-remount behavior.

**This is the single highest-value finding of the pass**: `:key`-forces-remount is used
elsewhere in the codebase for the same reason (the demo's own comment references
`SortableListShowcaseDemo.rozie`'s `forceFallback`/`swapThreshold`/`cloneable` knobs using
the identical idiom) — any demo/consumer relying on it for a construction-time-only prop
is Vue-only today. Decide: (a) implement real per-target keyed-remount codegen (React
`key` prop passthrough, Svelte `{#key}` wrapping, Solid `<Show keyed>`/manual
teardown-remount, Angular structural-directive recreation, Lit `keyed()` directive — note
`r-external`'s Lit `keyed()` wrapping, per `project_r_external_marker`, may be a related
precedent), or (b) treat `virtual` (and any construction-time-only prop) as a documented
Vue-only-live-toggle limitation and make `virtual` itself reactive in the component
instead (the alternative flagged back in Task 4).

### 3.2 Imperative-handle panel: broken on Angular only — `$refs` on a composed child resolves to `nativeElement`, not the component instance
**Symptom:** On Angular, clicking `verb-expandAll` / `verb-applyGrouping` (and by
extension every other `$refs.tbl.<verb>()` button in the panel) does nothing — the
`expanded`/`grouping` readouts never update. All 5 other targets pass this check
cleanly (10/10 verbs already proven on Vue per Task 6; now also confirmed working on
react/svelte/solid/lit for the two verbs driven this task).

**Root cause (confirmed via emitted output):** the compiled Angular click handler is:
```js
f("click",function(){ … const r=M(43); return _((o=r())==null?null:o.nativeElement.expandAll()) })
```
i.e. the codegen unconditionally derefs the Angular `viewChild` query result through
`.nativeElement` before calling the verb. That's correct for a `ref` on a **plain host
DOM element**, but `tbl` is a `ref` on a **composed Rozie child component**
(`<DataTable ref="tbl">`) whose `$expose`d verbs (`expandAll`, `applyGrouping`, …) live on
the **component instance**, not on its native DOM node — `nativeElement.expandAll` is
`undefined`, so the click throws `TypeError: … .expandAll is not a function` and the
readout never updates.

This differs from Phase 66's already-shipped composed-ref → Handle resolution
(`project_phase66_composed_ref_handle_typing`: "shared core resolver; react/solid
Handle-iface, others instance") — that phase covered `$refs` reads from the `<script>`
block; this is the **first proof** that `$refs.<name>.<verb>()` called **inline from a
template `@click` expression** on a composed child takes a different Angular codegen path
that still hard-codes `.nativeElement`. Likely a narrow, mechanical compiler fix (branch
the Angular inline-`$refs`-member-call codegen the same way the `<script>`-block resolver
already does: skip `.nativeElement` when the ref target is a composed Rozie component,
not a plain DOM element).

This also explains the cascading "Grouping via GroupBar" ❌ on Angular in the matrix
above — that check seeds grouping via the same `verb-applyGrouping` button before
asserting GroupBar renders/reacts, so it fails for the identical reason, not a second bug.

### 3.3 Theme swap: React NOOP — compiler bug, `r-model` + `@change` on the same element emit duplicate JSX `onChange` keys
**Symptom:** Selecting "material" in `ctl-theme` never changes the header cell's computed
background-color on React (stays at the base value indefinitely). Every other target
(vue/svelte/solid/angular) shows a real computed-style change; Lit's NOOP is the
already-documented, expected shadow-DOM case (see 3.4) — **React's NOOP is a NEW,
previously-unflagged finding**, since `ctl-theme` uses light-DOM `document.head` injection
that should reach React exactly like Vue.

**Root cause (confirmed via emitted output):** the compiled `<select data-testid=
"ctl-theme">` JSX props object literal is:
```js
{ …, value:j, onChange:a=>re(a.target.value), onChange:a=>{H(j)}, … }
```
— **two properties named `onChange` in the same object literal**. Per plain JS object
literal semantics, the second occurrence silently overwrites the first at parse time, so
only `a=>{H(j)}` (the `@change="applyTheme($data.theme)"` handler) survives in the actual
emitted props object; `re(a.target.value)` (the `r-model="$data.theme"` two-way write)
is **completely discarded** — the select's underlying state (`j`) never updates, so every
subsequent `@change` call reads the same stale closure value (`"base"`), forever
re-applying the no-op "base" theme regardless of what the user picks.

The other 5 targets don't hit this because `r-model` and an explicit same-event listener
lower to **structurally separate bindings**, not a single merged props object with a
colliding key: Vue emits `onUpdate:modelValue` (r-model) + `onChange` (explicit) as two
distinct vnode prop keys; Lit emits separate `@input=` / `@change=` directives; Svelte and
Solid attach the bind and the explicit listener as two independent `addEventListener`
registrations. **React is the only target whose codegen path collapses both into one
JSX object literal under the identical `onChange` key**, so this is a real,
narrowly-scoped React-emitter bug: whenever a `<select>`/`<input>` carries BOTH `r-model`
and an explicit listener for the SAME native event name, the emitter must merge them into
one handler that runs both (r-model write, then the explicit handler) instead of emitting
two properties with the same key.

### 3.4 Theme swap: Lit NOOP — expected, shadow-DOM encapsulation (pre-existing, Task 7 finding)
Unchanged from Task 7's documented finding: `document.head`-injected `<style>` (light-DOM
global) cannot cross Lit's shadow-DOM boundary, so DataTable's shadow root never sees the
skin sheet. Confirmed again this task (header bg stays identical before/after switching
to material). Real per-target theming gap, not fixed here (out of this task's scope).

### 3.5 Compiler splitter opaque-block gap (carried over from Task 7, unrelated to this task's builds)
Documented in progress.md: literal tag-shaped text inside a `.rozie` comment can silently
defeat the block splitter (`[ROZ500] Internal: no diagnostic to format`, zero real
diagnostic). Worked around in prose during Task 7; not re-triggered this task since no
new prose was added to the demo. Flagged here only to keep this doc the single
consolidated record per the task brief.

### 3.6 Editing is grid-mode-gated (carried over from Task 4, demo-authoring note, not re-driven every target this task)
`onGridKeyDown`'s Enter/F2-to-edit keymap no-ops outside grid mode; the Vue-only editing
spec already switches to grid mode first. Not re-driven cross-target this task (outside
the 4 flagged checks in scope) — Task 4/6 already proved editing on Vue; cross-target
editing parity remains unverified and is a candidate for a future pass, not a new finding.

## 4. Launch-readiness read

The demo **compiles and renders on all 6 targets** with zero build errors — that alone is
a meaningful validation of the `<components>` cross-tree composition path (DataTable +
Column + 10 drop-ins from source) at this scale (1,500 rows, 11 two-way bindings, 4
scoped slots). Of the specific unknowns flagged going into this task, the results split
roughly into "confirmed working," "confirmed broken with a precise, narrow root cause,"
and "confirmed broken with an already-known, accepted root cause":

- **Confirmed working broadly**: grid-mode toggling (6/6), the imperative `$refs`-handle
  panel (5/6 — Vue/React/Svelte/Solid/Lit), GroupBar rendering + click-driven
  add/remove/clear (5/6, same targets).
- **Confirmed broken, NEW findings with precise root causes** (both look like small,
  mechanical, high-confidence compiler fixes, not architecture problems): Angular's
  inline-`@click`-`$refs`-to-composed-child-verb codegen wrongly derefs `.nativeElement`
  (§3.2); React's `r-model` + same-event `@listener` on one element collide on a single
  `onChange` JSX key, silently dropping the r-model write (§3.3).
  These are the two prioritized bugs to fix out of this pass — both are narrowly
  scoped and both have an exact repro (this demo) and an exact code location.
- **Confirmed broken, bigger/pre-existing architecture gap**: `:key`-forces-remount is
  Vue-only (§3.1) — every other target either drops the `:key` binding or treats it as an
  inert prop, so any construction-time-only-prop workaround using this idiom (this demo's
  `virtual`, and the pre-existing `SortableListShowcaseDemo.rozie` knobs) silently fails
  everywhere except Vue. This is the highest-leverage finding of the whole pass because it
  is a *reusable idiom* already load-bearing elsewhere in the codebase, not a one-off.
- **Confirmed broken, already-known and accepted**: Lit theme-swap NOOP (shadow-DOM
  encapsulation, §3.4) — unchanged from Task 7, not a new regression.

Net read: the demo itself is sound and dogfoods the real composition surface well: the
compiler didn't choke on the scale or the cross-tree `<components>` wiring on any target.
What it *did* surface, precisely because this was the first full cross-target drive of
these three specific idioms (construction-time-remount-via-`:key`, inline-template
`$refs`-to-composed-child-verb calls on Angular, and `r-model`+matching-native-event
collisions on React), is that all three have real per-target gaps that were previously
invisible because every prior validation of them was Vue-only. None of these are launch
blockers for the demo itself (the imperative panel and theme switcher are both explicitly
opt-in/gated features in this demo), but `:key`-forces-remount (§3.1) in particular
deserves a compiler-team ticket before it's leaned on again for a *shipped* (non-demo)
`@rozie-ui` family.
