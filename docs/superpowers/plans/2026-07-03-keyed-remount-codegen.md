# Keyed-Remount Codegen (component `:key` → real remount on all 6 targets) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Make a component-level `:key="expr"` binding force a real destroy+recreate (remount) on all six targets. Today only Vue remounts; React drops the `key`, Svelte/Angular forward it as an inert prop, Solid drops it, Lit forwards it inert. This is a **parity launch blocker** — 4 shipped `@rozie-ui` families rely on the idiom (data-table, sortable-list, flatpickr, captcha) and Flatpickr/Captcha publish it as consumer API. Root cause: `docs/superpowers/plans/data-table-super-crosstarget-findings.md` §3.1.

**Architecture:** Add one additive-optional IR field marking a component `:key` as a remount key (mirroring the `isExternal` precedent), populated in lowering and consumed by each emitter to produce that target's native keyed-remount construct. Vue already works and is the behavioral oracle.

**Tech Stack:** `packages/core` (IR + lowering), `packages/targets/{react,svelte,solid,angular,lit}` (emitters), the per-target `__tests__` + `snapshot-suite` + `tests/dist-parity` + `tests/visual-regression` suites.

## Global Constraints

- **Additive-optional IR change** — `remountKeyExpression?: Expression` on `TemplateElementIR` (`packages/core/src/ir/types.ts`), exactly like the existing optional `isExternal?` field (`types.ts:849`). No front-end/parser rebless from an additive-optional field.
- **Disambiguation (critical):** a `:key` on an element under `r-for` is the LOOP key (→ `TemplateLoopIR.keyExpression`, `types.ts:1136`) and must NOT be treated as a remount key. The marker fires ONLY for a `key` binding on a `tagKind === 'component' | 'self'` element that the `r-for` path did not consume.
- **Vue is unchanged and needs NO task** — it already emits a bare component `:key` as a real working vnode-key remount (Vue has no `key`-drop filter outside loops). It is the oracle for verification. **Therefore Task 1 must NOT strip the raw `key` binding from `.attributes`** (doing so silently deletes Vue's working remount — there is no Vue task to re-add it). Task 1 only ADDS `remountKeyExpression` alongside the retained raw binding.
- **Per-emitter strip (replaces the Task-1 strip):** each non-Vue emitter task, when it emits its remount construct from `remountKeyExpression`, MUST also suppress the raw `key` binding on that element so no inert `key` prop/attr is also emitted. React and Solid already drop a bare `key`/`:key` via `isConsumedAttribute` (no-op for them); Svelte, Angular, and Lit currently forward it inert and must strip it at their own seam. Vue keeps emitting the raw `:key` (correct) and is left alone.
- Each emitter task is **red-first** (a fixture proving the current inert/dropped output, then the corrected construct) + **byte-identity** discipline: rebless per-target `snapshot-suite`/`composition` snapshots and `tests/dist-parity` fixtures; the drift must be ONLY component-`:key` sites.
- Emitter-change validation: `turbo run test --force --continue` (cold; target snapshots drift), `pnpm --filter dist-parity bootstrap` after `build --force`, and the relevant `turbo run typecheck --filter=…<target>… --force`.
- Known pre-existing unrelated failure: `@rozie/docs#test` surface-hash gate (date-picker/pdf/wavesurfer) fails on clean `main` — ignore it (bisect-confirmed), do not "fix" by bumping hashes here.
- Env: host `node_modules` healthy (macOS); NO Docker; do NOT run `pnpm vr-preview:build` (hangs — use `pnpm --filter @rozie/visual-regression build`, or `ROZIE_VR_TARGETS=<t>` to scope).

---

### Task 1: Shared IR marker + lowering

**Files:**
- Modify: `packages/core/src/ir/types.ts` (add `remountKeyExpression?: Expression` to `TemplateElementIR`, ~L788-866)
- Modify: `packages/core/src/ir/lowerers/lowerTemplate.ts` (`lowerBareElement` ~L855; the generic binding push ~L360-368; `findKeyExpression` ~L374-383)
- Test: `packages/core/src/ir/**/__tests__/` (a lowering unit test)

**Interfaces:**
- Produces: `TemplateElementIR.remountKeyExpression?: Expression`. Set when a `key` binding exists on a `tagKind === 'component' | 'self'` element NOT consumed by an enclosing `r-for`. **The raw `key` binding is RETAINED in `attributes`** (Vue still emits it as a working vnode key; each non-Vue emitter strips it at its own seam — see Global Constraints). All later per-target tasks consume this field.

- [ ] **Step 1: Write the failing lowering test**

Assert: lowering `<MyComp :key="foo" />` yields a `TemplateElementIR` with `remountKeyExpression` set to the `foo` expression AND the raw `key` binding STILL PRESENT in `.attributes` (retained, not stripped); lowering `<div r-for="x in xs" :key="x.id" />` still yields a `TemplateLoopIR` with `keyExpression`, does NOT set `remountKeyExpression`, and (assert this too) the loop-key strip behavior on the inner element is unchanged from base; lowering `<MyComp r-for="x in xs" :key="x.id" />` (component under r-for) → loop key, `remountKeyExpression` NOT set; lowering a plain `<div :key="k">` (non-component) does NOT set `remountKeyExpression` and is byte-identical to base. Use the existing core lowering test harness (find a sibling test under `packages/core/src/ir` that calls the lowerer).

- [ ] **Step 2: Run it — verify RED** (`remountKeyExpression` undefined today).

- [ ] **Step 3: Implement**

Add the optional field to `TemplateElementIR` (mirror `isExternal?`). In `lowerBareElement`, after collecting `attributes`, if the element is a component/self tag and has a `key` binding and is not on the r-for-consumed path, COPY that binding's expression into `remountKeyExpression` — **do NOT drop the raw `key` binding from `attributes`** (Vue relies on it; per-emitter tasks strip it later). Guard the `<Comp r-for :key>` case (the r-for path already routes `:key` via `findKeyExpression`/`TemplateLoopIR.keyExpression` — do not double-handle). Note: the guard matches `a.kind === 'binding' && a.name === 'key'` — a `{{ }}`-interpolated key lowers to `kind: 'interpolated'` and is out of scope (add a one-line comment noting this for the emitter tasks).

- [ ] **Step 4: Run test — GREEN.** Then run core suite cold: `turbo run test --force --continue --filter=@rozie/core`. Additive-optional → no snapshot drift expected; if any drifts, investigate (the field must not change existing emit — emitters don't consume it yet).

- [ ] **Step 5: Commit** `feat(core): mark component-level :key as a remount key in IR (remountKeyExpression)`

---

### Task 2: React — emit `key={expr}`

**Files:** Modify `packages/targets/react/src/emit/emitTemplateNode.ts` (`emitElement` component path ~L255/306/423); `emitTemplateAttribute.ts` (`isConsumedAttribute` ~L83-90). Test: `packages/targets/react/src/__tests__/composition.test.ts`.

**Interfaces:** Consumes `remountKeyExpression`. Produces a `key={<expr>}` JSX attribute on the composed-component call. The loop-key drop in `isConsumedAttribute` stays for the r-for path.

- [ ] **Step 1: RED fixture** — `compileReact('<MyComp :key="String(v)" />')` currently emits no `key:` on the component call; assert it SHOULD emit `key={String(v)}`. Show it fails.
- [ ] **Step 2: Implement** — in `emitElement`'s component branch, if `node.remountKeyExpression`, add `key={<emittedExpr>}` to the JSX props. (React natively remounts a component when its `key` changes.)
- [ ] **Step 3: GREEN** + rebless: `turbo run test --force --continue --filter=@rozie/target-react`; refresh any `composition`/`snapshot-suite` snapshots that legitimately gained a `key` (only component-`:key` sites). React typecheck.
- [ ] **Step 4: Commit** `feat(react): emit key= for component :key (real remount, was dropped)`

---

### Task 3: Lit — reuse `keyed()`

**Files:** Modify `packages/targets/lit/src/emit/emitTemplate.ts` (component emit ~L1533/`emitElementOpenTag`:1218; the `isExternal`/`keyed()` precedent at :1672-1674; state flag :207-212/:281-293); `emitLit.ts` (import gate :436-442). Test: clone `packages/targets/lit/src/__tests__/r-external-keyed.test.ts`.

**Interfaces:** Consumes `remountKeyExpression`. Wraps the component invocation in `${keyed(<expr>, html\`…\`)}`, setting `keyedUsed` so the `import { keyed } from 'lit/directives/keyed.js'` is emitted.

- [ ] **Step 1: RED fixture** — component `:key` currently emits an inert `.key=` property binding; assert it SHOULD wrap in `keyed(<expr>, …)` + import present. Show fail.
- [ ] **Step 2: Implement** — reuse the exact `isExternal` `keyed()` path, but source the key from `remountKeyExpression` instead of `this._rozieReconcileSeq`. Ensure the inert `.key=` binding is no longer emitted for this element. Gate the import via the existing `keyedUsed` flag.
- [ ] **Step 3: GREEN** + rebless (lit snapshots) + lit typecheck: `turbo run test --force --continue --filter=@rozie/target-lit`.
- [ ] **Step 4: Commit** `feat(lit): wrap component :key in keyed() for real remount (reuses r-external precedent)`

---

### Task 4: Svelte — wrap in `{#key expr}…{/key}`

**Files:** Modify `packages/targets/svelte/src/emit/emitTemplateNode.ts` (`emitElement` component path ~L478/519; model on the block emission in `emitConditional` ~L232 and `emitLoop` ~L264-342; note the loop-local `stripKey` :329-337). Test: `packages/targets/svelte/src/__tests__/composition.test.ts`.

**Interfaces:** Consumes `remountKeyExpression`. Emits `{#key <expr>}<Child …/>{/key}` around the component invocation; the inert `get key(){…}` prop is no longer forwarded.

- [ ] **Step 1: RED fixture** — component `:key` currently forwards `get key(){…}` as an inert prop; assert it SHOULD emit a `{#key <expr>}…{/key}` wrapper and NOT forward `key` as a prop. Show fail.
- [ ] **Step 2: Implement** — wrap the component invocation string in a `{#key …}{/key}` block (model on `emitConditional`/`emitLoop` block string construction), and stop forwarding the `key` binding for this element.
- [ ] **Step 3: GREEN** + rebless (svelte `snapshot-suite`) + svelte-check: `turbo run test --force --continue --filter=@rozie/target-svelte`.
- [ ] **Step 4: Commit** `feat(svelte): wrap component :key in {#key} block for real remount (was inert prop)`

---

### Task 5: Solid — `<Show keyed when={expr}>`

**Files:** Modify `packages/targets/solid/src/emit/emitTemplateNode.ts` (`emitElement` component path ~L634/673/726); `emitTemplateAttribute.ts` (`isConsumedAttribute` key drop :117-124); model on `emitConditional.ts` `buildShow` :39-47 (import `solidImports.add('Show')` :56). Test: `packages/targets/solid/src/__tests__/composition.test.ts`.

**Interfaces:** Consumes `remountKeyExpression`. Wraps the component in `<Show keyed when={<expr>}>…</Show>` (Solid's `keyed` prop forces child re-creation when `when` changes); registers the `Show` import; stops dropping the key.

- [ ] **Step 1: RED fixture** — component `:key` currently dropped; assert it SHOULD wrap in `<Show keyed when={<expr>}>` + `Show` import. Show fail.
- [ ] **Step 2: Implement** — model on `buildShow`; ensure the wrapped child stays a single element and the key expr feeds `when`. Add `Show` to imports. (Note: `keyed` on `<Show>` recreates children when the `when` value changes — verify this is the semantics; if `keyed` alone isn't sufficient for a value-change remount, use a dispose+recreate keyed on the expr.)
- [ ] **Step 3: GREEN** + rebless (solid `snapshots`) + solid lint/typecheck: `turbo run test --force --continue --filter=@rozie/target-solid`.
- [ ] **Step 4: Commit** `feat(solid): wrap component :key in <Show keyed> for real remount (was dropped)`

---

### Task 6: Angular — structural recreation (HARDEST)

**Files:** Modify `packages/targets/angular/src/emit/emitTemplateNode.ts` (`emitElement` component path ~L481/504; the loop-local `stripKey` :323-331; model on `emitConditional.ts` :47 and `emitLoop` :275-336). Test: `packages/targets/angular/src/__tests__/composition.test.ts`.

**Interfaces:** Consumes `remountKeyExpression`. Emits a structural construct that destroys+recreates the component view when the key changes, and stops forwarding the inert `[key]` input.

- [ ] **Step 1: RED fixture** — component `:key` currently forwards an inert `[key]` input; assert it SHOULD emit a keyed structural-recreation construct and NOT a `[key]` input. Show fail.
- [ ] **Step 2: Implement** — Angular has no first-class remount-on-key block. Preferred: a keyed `@for (k of [<expr>]; track k) { <Child …/> }` (single-element array tracked by the key → Angular destroys+recreates the embedded view when the key changes), modeled on `emitLoop`'s `@for` string. Alternatives if that's unclean: `*ngComponentOutlet` swap, or an `@if` toggle keyed on the expr. Remove the inert `[key]` input forwarding. **If the construct choice is non-obvious or risks broad snapshot churn, report DONE_WITH_CONCERNS with the tradeoff rather than forcing it.**
- [ ] **Step 3: GREEN** + rebless (angular `snapshot-suite`) + angular-typecheck (ngtsc must accept the emitted template): `turbo run test --force --continue --filter=@rozie/target-angular`. Review the drift: only component-`:key` sites.
- [ ] **Step 4: Commit** `feat(angular): structural-recreate component :key for real remount (was inert [key] input)`

---

### Task 7: Cross-target verification + dist-parity rebless

**Files:** `tests/dist-parity/fixtures` (rebless), `tests/visual-regression/specs/data-table-super.spec.ts` (extend the virtual-toggle check across all 6).

**Interfaces:** Confirms the feature end-to-end: the `DataTableSuperDemo` `virtual` toggle (which uses `:key="String($data.virtual)"`) now renders real windowed rows on ALL SIX targets (was Vue-only per §3.1 — the acceptance signal).

- [ ] **Step 1: Rebless dist-parity** — `pnpm build --force` the targets, then `pnpm --filter dist-parity bootstrap`; confirm `tests/dist-parity/parity.test.ts` is green (byte-identical across compile-API vs dist for every reference example × target). Any drift must be component-`:key` sites only.
- [ ] **Step 2: Full 6-target VR build** — `pnpm --filter @rozie/visual-regression build` (watch for the transient solid rolldown flake — rebuild that target in isolation to confirm real vs flake).
- [ ] **Step 3: Extend + run the virtual-toggle smoke across all 6** — generalize the existing Vue `virtual` windowing assertion in `data-table-super.spec.ts` to a per-target loop asserting each target renders real windowed rows (`>5 && <50`, ruling out the 2-spacer empty render) after toggling `ctl-virtual`. Every target must now PASS (was ❌ on 5/6). Do NOT weaken — a target still showing 2 spacer rows is a real miss to fix in that target's task, not to assert around.
- [ ] **Step 4: Commit** `test(keyed-remount): verify component :key remounts on all 6 targets (data-table virtual toggle) + rebless dist-parity`

---

## Self-Review

**Spec coverage:** shared IR marker (T1) → React/Lit/Svelte/Solid/Angular emit (T2–T6) → dist-parity + VR verification (T7). The `<Comp r-for :key>` disambiguation is handled in T1 and re-stated as a constraint. Vue unchanged (oracle). ✓
**Placeholder scan:** each task names its exact seam (file:line from the scoping pass) and the target construct; the two genuinely uncertain spots (Solid `keyed`-on-`<Show>` value-change semantics; Angular construct choice) are flagged as DONE_WITH_CONCERNS decision points, not hand-waves. ✓
**Sequencing:** T1 must land first (all emitters consume its field). Angular (T6) is last of the emitters (hardest + highest churn). T7 requires all emitters. ✓

## Execution Handoff

Subagent-driven, per the active skill. T1 first (core IR, no emitter conflicts); then T2→T6 in ascending difficulty; then T7.
