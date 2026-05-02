---
phase: 03-vue-3-4-target-emitter-first-demoable-artifact
plan: 04
subsystem: target-vue + runtime-vue
tags: [vue, runtime-vue, listeners-block, watchEffect, useOutsideClick, debounce, throttle, key-filter, D-40, D-41, D-42, D-44, VUE-03, MOD-04]

# Dependency graph
requires:
  - phase: 03-vue-3-4-target-emitter-first-demoable-artifact (plan 01)
    provides: "@rozie/runtime-vue scaffold + ModifierImpl.vue?() hook on all 23 builtins (D-40 tagged-union returned by registry vue() hooks)"
  - phase: 03-vue-3-4-target-emitter-first-demoable-artifact (plan 02)
    provides: "emitScript + VueImportCollector + emitVue shell (Plan 04 sibling-imports the collectors and appends listener block emit after lifecycle/residual)"
  - phase: 03-vue-3-4-target-emitter-first-demoable-artifact (plan 03)
    provides: "ScriptInjection record shape (emitTemplateEvent.ts) — Plan 04 reuses same shape for runtime-vue imports auto-collected from emitListeners; mergeScriptInjections dedupe path now skips empty-decl injections"
provides:
  - "@rozie/runtime-vue real exports — useOutsideClick / debounce / throttle / 13 keyFilter predicates (D-41 tree-shakable)"
  - "emitListeners(listeners, ir, registry) — <listeners>-block lowering producing 3 emission classes (A native watchEffect, B .outside collapse, C debounce/throttle wrap)"
  - "emitListenerCollapsedOutsideClick — D-42 useOutsideClick(refs, () => handler(), () => when) collapse"
  - "rewriteListenerExpression (rewriteScriptExpression) — script-context expression rewriter (.value-bearing) for handler/when expressions"
  - "RuntimeVueImportCollector — sibling of VueImportCollector for @rozie/runtime-vue imports"
  - "emitVue.mergeVueImportsAndListeners — splices watchEffect into existing vue import line, appends listener block code"
  - "Dropdown.script.snap (regenerated): 1 useOutsideClick + 2 watchEffect + 1 throttle wrap + auto-collected runtime-vue import line"
  - "SearchInput.script.snap (regenerated): debouncedOnSearch wrap from Plan 03 + composed @rozie/runtime-vue import line"
  - "TodoList.script.snap (regenerated): emitScript-only output (no listeners) — confirms the empty-listeners path"
affects:
  - "phase-03-plan-05 (style emission integrates into emitVue alongside template + script + listeners)"
  - "phase-03-plan-06 (unplugin emits ROZ403 when @rozie/runtime-vue not resolvable; runtime-vue is now a real peer-dep)"
  - "phase-04-react-emitter (D-40 helper-package routing pattern dogfoods here for the first time — Phase 4 React MAY adopt @rozie/runtime-react with the same RuntimeImportCollector shape)"

# Tech tracking
tech-stack:
  used:
    - "vue ^3.4 (runtime-vue peer dep — onMounted, onBeforeUnmount, type Ref)"
    - "@vue/test-utils ^2.4 (mount + unmount for useOutsideClick contract test)"
    - "happy-dom (DOM env for runtime-vue tests)"
    - "vitest fake timers (vi.useFakeTimers + vi.advanceTimersByTime — debounce/throttle window verification)"
    - "@babel/types / @babel/traverse / @babel/generator (rewriteScriptExpression — script-context Expression rewriter)"
  patterns:
    - "Three-class listener emission switch — emitListeners.classifyListener inspects pipeline, dispatches to Class A (native watchEffect) / Class B (.outside collapse) / Class C (debounce/throttle wrap). Each class has its own renderer arm. Phase 4+ React/Svelte/Angular emitters reuse the SAME classification logic but produce per-target output."
    - "Script-context vs template-context Expression rewriter split — rewriteListenerExpression is a third sibling of rewriteRozieIdentifiers (whole-Program) and rewriteTemplateExpression (single Expression, no .value). The 3-rewriter set is structural — Phase 4+ React emitter will need analogous variants per target."
    - "RuntimeImportCollector pattern — RuntimeVueImportCollector mirrors VueImportCollector; both sort + dedupe + render a single import line. Phase 4+ adds RuntimeReactImportCollector etc. as needed."
    - "Empty-decl ScriptInjection bypass in mergeScriptInjections — when emitListeners auto-collects runtime-vue imports, it sends ScriptInjection records with empty decl strings (the listener block IS the user-visible emission). mergeScriptInjections skips those decls but still dedupes the imports."
    - "leading+trailing throttle semantics with pendingArgs slot — captures latest args during the suppressed window so the trailing fire carries the most recent data (lodash default; Dropdown's resize.throttle(100) relies on this)."
    - "try/catch onBeforeUnmount in debounce/throttle — A9 defensive pattern; helper usable from module scope without throwing when not in a Vue setup context."

# Key files
key-files:
  created:
    - packages/runtime/vue/src/useOutsideClick.ts
    - packages/runtime/vue/src/debounce.ts
    - packages/runtime/vue/src/throttle.ts
    - packages/runtime/vue/src/keyFilter.ts
    - packages/runtime/vue/src/__tests__/useOutsideClick.test.ts
    - packages/runtime/vue/src/__tests__/debounce.test.ts
    - packages/runtime/vue/src/__tests__/throttle.test.ts
    - packages/runtime/vue/src/__tests__/keyFilter.test.ts
    - packages/targets/vue/src/emit/emitListeners.ts
    - packages/targets/vue/src/emit/emitListenerCollapsedOutsideClick.ts
    - packages/targets/vue/src/rewrite/rewriteListenerExpression.ts
    - packages/targets/vue/src/__tests__/emitListeners.test.ts
  modified:
    - packages/runtime/vue/src/index.ts (placeholder export removed; replaced with real re-exports)
    - packages/targets/vue/src/rewrite/collectVueImports.ts (added RuntimeVueImportCollector class)
    - packages/targets/vue/src/emitVue.ts (wires emitListeners; mergeVueImportsAndListeners splices watchEffect import + appends listener block code; mergeScriptInjections skips empty-decl injections)
    - packages/targets/vue/src/__tests__/emitScript.test.ts (removed SearchInput + Modal from file-snapshot loop — Plan 03/04 now own these fixtures via the full emitVue pipeline; Counter stays since it has no listeners or template wraps)
    - packages/targets/vue/fixtures/Dropdown.script.snap (regenerated — 67 lines vs placeholder)
    - packages/targets/vue/fixtures/SearchInput.script.snap (regenerated — debounce wrap composes via Plan 03 scriptInjection path)
    - packages/targets/vue/fixtures/TodoList.script.snap (regenerated — emitScript-only output via emitVue; no listeners)

key-decisions:
  - "Three-class listener classification (A pure-native, B outside collapse, C debounce/throttle wrap) — each class is structurally distinct; merging into a unified renderer would drown each path's specific intent. ClassifyListener returns a tagged union so the renderer dispatches with type narrowing. Mixed cases (.outside + .debounce simultaneously) are rare and not exercised by reference examples; classifyListener picks the first helper found, which for v1 is acceptable since outside.ts emits listenerOnly: true and Phase 2 ROZ112 already validates."
  - "Native key-filter guards INLINE the predicate (\`if (e.key !== 'Escape') return;\`) rather than importing isEscape from runtime-vue. Inlining keeps the listener block self-contained and avoids the runtime-vue dep just for a key-filter listener; the keyFilter exports remain available for power users / third-party plugins. Future optimization: import predicates when ≥3 key filters appear in a single SFC."
  - "Identifier-handler invocation as zero-arg (\`close()\` not \`close(e)\`) — matches user source (Dropdown's \`close = () => { $props.open = false }\` declares zero arity). Non-Identifier shapes pass \`(e)\` defensively. The check uses a regex on the post-rewrite handler code; sufficient for v1."
  - "Empty-decl ScriptInjection bypass — emitListeners auto-collects \`import { useOutsideClick, throttle } from '@rozie/runtime-vue';\` via ScriptInjection records with empty decl strings (the listener block code is the user-facing emission, not a single decl line). mergeScriptInjections now filters \`if (inj.decl.length > 0)\` so these records register their imports without injecting empty lines. Cleaner alternative would be a separate import-only path, but reuse of mergeScriptInjections keeps the dedupe-per-from logic DRY."
  - "leading+trailing throttle semantics — chosen over leading-only because Dropdown's resize.throttle(100) needs the panel to settle at the FINAL position one tick after a continuous resize. lodash's default is leading+trailing for this exact reason. Test 7 covers the trailing-fire path."
  - "Plan 04 owns Dropdown/SearchInput/TodoList script.snap regen via the FULL emitVue pipeline — emitScript.test.ts's file-snapshot loop reduced to Counter only (no listeners, no template wraps). This avoids race conditions where Plan 02's emitScript-only output would overwrite Plan 03/04's composite snapshot."
  - "rewriteListenerExpression (script-context, .value-bearing) is the THIRD sibling of rewriteRozieIdentifiers (whole-Program) and rewriteTemplateExpression (single Expression, no .value). All three share the modelProps/nonModelProps/dataNames/refNames/computedNames identification logic, but diverge in: (1) Program-level vs Expression-level scope, (2) .value suffix application. Future refactor could extract the shared visitor logic into a helper, but v1 keeps them parallel for clarity."
  - "--no-verify on every commit per spawn-mode <sequential_execution>; orchestrator validates pre-commit hooks once after the wave completes."

patterns-established:
  - "Per-target runtime helper package pattern (D-44 generalized) — packages/runtime/{target}/ as a peer-dep dispatch target. RuntimeVueImportCollector class is the import-collection shape Phase 4+ adopts for any per-target runtime helper package."
  - "watchEffect((onCleanup) => {...}) emission template for global listeners — onCleanup is the cleanup callback Vue invokes when the effect re-runs OR the component unmounts. For listeners-block entries this is the canonical lifecycle-correct shape."
  - "Inline native key guards inside watchEffect handlers — Vue's automatic modifier handling only applies to template @event, NOT raw addEventListener. Plan 04 emits \`if (e.key !== 'Escape') return;\` early-returns inside the handler decl as the listeners-block equivalent."

requirements-completed: [VUE-03, MOD-04]

# Metrics
duration: ~13min
completed: 2026-05-02
---

# Phase 3 Plan 04: Listeners-Block Lowering + @rozie/runtime-vue Helpers Summary

**`<listeners>`-block lowering produces three emission classes — Class A pure-native watchEffect((onCleanup) => {}), Class B D-42 useOutsideClick(refs, () => handler(), () => when) collapse, Class C debounce/throttle script-level wrap. Paired with `@rozie/runtime-vue`'s real helper exports (useOutsideClick + debounce + throttle + 13 keyFilter predicates) — Plan 04 closes Phase 3 success criterion 2 (Dropdown's outside-click fires only outside both refs with `when:` gating).**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-02T16:43:18Z (worktree reset to fd5a3b1; baseline 391 core + 67 target-vue tests passing)
- **Completed:** 2026-05-02T16:56:06Z
- **Tasks:** 2 (both TDD with RED + GREEN sub-commits)
- **Commits:** 4 (Task 1 RED, Task 1 GREEN, Task 2 RED, Task 2 GREEN)
- **Files modified:** 7
- **Files created:** 12

## Accomplishments

- **`@rozie/runtime-vue` real exports** at `packages/runtime/vue/src/{useOutsideClick,debounce,throttle,keyFilter,index}.ts` — replaces the Plan 01 `__rozieRuntimeVuePlaceholder` constant with tree-shakable named exports per D-41. `useOutsideClick(refs, callback, whenSignal?, options?)` matches RESEARCH Code Example 3 verbatim. `debounce<F>` and `throttle<F>` auto-cancel pending timers on Vue unmount when called inside setup (try/catch defensive per A9). 13 keyFilter predicates align with Phase 2 KEY_FILTER_NAMES (isEnter, isEscape, isTab, isSpace, isDelete, isUp, isDown, isLeft, isRight, isCtrl, isAlt, isShift, isMeta).
- **`emitListeners(listeners, ir, registry)`** at `packages/targets/vue/src/emit/emitListeners.ts` — top-level coordinator that filters to `source: 'listeners-block'` entries, classifies each listener's modifier pipeline (Class A/B/C), and renders the corresponding code shape. Returns `{ code, vueImports, runtimeImports, diagnostics }` so emitVue can splice the imports into the canonical Vue import line and append the listener block code at the end of `<script setup>`.
- **`emitListenerCollapsedOutsideClick`** at `packages/targets/vue/src/emit/emitListenerCollapsedOutsideClick.ts` — D-42 collapse helper. Maps `.outside($refs.x, $refs.y)` args to `[xRef, yRef]` (Pitfall 4 Ref suffix); composes the listener's `when:` predicate into a `() => when` getter for `useOutsideClick`'s third arg. Renders a single multi-line call: `useOutsideClick(\n  [refs],\n  () => handler(),\n  () => when,\n);`.
- **`rewriteScriptExpression`** at `packages/targets/vue/src/rewrite/rewriteListenerExpression.ts` — script-context Expression rewriter (third sibling of Plan 02's `rewriteRozieIdentifiers` and Plan 03's `rewriteTemplateExpression`). Applies the same `.value` suffix logic as Plan 02 (model props, data refs, template refs, computed reads) but operates on a single Expression and returns a code string ready to splice into a watchEffect body or `useOutsideClick` call.
- **`RuntimeVueImportCollector`** at `packages/targets/vue/src/rewrite/collectVueImports.ts` — sibling class of VueImportCollector. Sorted, deduped, renders `import { ... } from '@rozie/runtime-vue';`. Used by emitListeners (for the listener-block entries that consume runtime-vue helpers).
- **`emitVue.mergeVueImportsAndListeners`** — splices `watchEffect` into the existing canonical `import { ... } from 'vue';` line; appends the listener block code at the end of the script body. `mergeScriptInjections` updated to bypass empty-decl injections so emitListeners' import-only ScriptInjection records register their imports without injecting empty lines.
- **`Dropdown.script.snap` regenerated** — composes Plan 02's defineModel/defineProps/refs/lifecycle/residual + Plan 03's `defineSlots<{ trigger(props: { open: any; toggle: any }): any; default(props: { close: any }): any; }>()` slot signatures + Plan 04's listener emissions: `useOutsideClick([triggerElRef, panelElRef], () => close(), () => open.value && props.closeOnOutsideClick)` (D-42 collapse), watchEffect for `keydown.escape` with native key check `if (e.key !== 'Escape') return;`, and `const throttledReposition = throttle(reposition, 100);` + watchEffect for `resize` with `{ passive: true }` listener option. Auto-collected `import { throttle, useOutsideClick } from '@rozie/runtime-vue';` (sorted; no `debounce` since unused).
- **`SearchInput.script.snap` regenerated** — Plan 03's `debouncedOnSearch` wrap composes through emitVue; auto-collected `import { debounce } from '@rozie/runtime-vue';`.
- **`TodoList.script.snap` regenerated** — no `<listeners>`-block entries; output is identical to emitScript-only via the empty-listeners path.
- **20 runtime-vue tests pass** under happy-dom: useOutsideClick (4 — mount/unmount cleanup, multi-ref containment, whenSignal gate, reactive whenSignal re-evaluation), debounce (2 — fake-timer rapid-call collapse + A9 onBeforeUnmount auto-cancel + outside-setup no-throw), throttle (1 — leading-fire-then-window with pendingArgs trailing semantics), keyFilter (13 — one per predicate).
- **78 target-vue tests pass** (up from 67) — new emitListeners.test.ts contributes 13 (Dropdown end-to-end Tests 1-5, synthetic IR Tests 6-9, whole-script snapshot regen 3, Dropdown SFC composition substring assertion 1).
- **391 @rozie/core tests still pass** — zero Phase 1+2 regressions.

## Task Commits

Each task committed atomically:

1. **Task 1 RED — failing tests for runtime-vue helpers** — `c7ee8c8` (test)
2. **Task 1 GREEN — useOutsideClick / debounce / throttle / keyFilter implementations** — `92e3c55` (feat)
3. **Task 2 RED — failing tests for emitListeners + Dropdown/SearchInput/TodoList script.snap regen** — `f798b82` (test)
4. **Task 2 GREEN — emitListeners + 3-class lowering + emitVue wiring + script.snap regeneration** — `b7bb44e` (feat)

## Files Created/Modified

**Created:**
- `packages/runtime/vue/src/useOutsideClick.ts` — D-42 helper
- `packages/runtime/vue/src/debounce.ts` — script-level wrap helper
- `packages/runtime/vue/src/throttle.ts` — leading+trailing wrap helper
- `packages/runtime/vue/src/keyFilter.ts` — 13 predicates
- `packages/runtime/vue/src/__tests__/{useOutsideClick,debounce,throttle,keyFilter}.test.ts` — 4 unit-test files (20 tests total)
- `packages/targets/vue/src/emit/emitListeners.ts` — top-level coordinator + 3-class classifier + per-class renderer
- `packages/targets/vue/src/emit/emitListenerCollapsedOutsideClick.ts` — D-42 outside-click collapse renderer
- `packages/targets/vue/src/rewrite/rewriteListenerExpression.ts` — script-context Expression rewriter
- `packages/targets/vue/src/__tests__/emitListeners.test.ts` — 13 behavior + snapshot tests

**Modified:**
- `packages/runtime/vue/src/index.ts` — replaced `__rozieRuntimeVuePlaceholder` with re-exports
- `packages/targets/vue/src/rewrite/collectVueImports.ts` — added `RuntimeVueImportCollector` class
- `packages/targets/vue/src/emitVue.ts` — wires emitListeners; `mergeVueImportsAndListeners` splices watchEffect + appends listener block; `mergeScriptInjections` skips empty-decl injections
- `packages/targets/vue/src/__tests__/emitScript.test.ts` — removed SearchInput + Modal from file-snapshot loop (now owned by Plan 03/04 via emitVue)
- `packages/targets/vue/fixtures/Dropdown.script.snap` — regenerated (67 lines, full integration)
- `packages/targets/vue/fixtures/SearchInput.script.snap` — regenerated (debounce wrap composed via Plan 03 scriptInjection path)
- `packages/targets/vue/fixtures/TodoList.script.snap` — regenerated (no listeners; emitScript-only output composes via emitVue)

## Decisions Made

- **Three-class listener classification (A/B/C)** preserves the structural distinction between native watchEffect emission, D-42 collapse, and script-level wrap. Each class has its own renderer arm. ClassifyListener returns a tagged union so the renderer dispatches with type narrowing. Cleaner than a unified renderer that would invent ad-hoc flags.
- **Native key-filter guards inlined** as `if (e.key !== 'Escape') return;` rather than importing `isEscape` from `@rozie/runtime-vue`. Keeps the listener block self-contained; avoids requiring the runtime-vue dep for any listener that uses a native key filter. The keyFilter exports remain available for third-party plugins or unusual matching logic.
- **Identifier-handler invocation as zero-arg** (`close()` not `close(e)`) — matches user source declaration where Dropdown's handlers are zero-arity arrows. Non-Identifier shapes (e.g., inline `() => close()`) pass `(e)` defensively. Detected with a regex on the post-rewrite handler code.
- **Empty-decl ScriptInjection bypass** — emitListeners auto-collects `import { useOutsideClick, throttle } from '@rozie/runtime-vue';` via ScriptInjection records with empty decl strings (the listener block code IS the user-visible emission, not a single decl line). `mergeScriptInjections` filters `if (inj.decl.length > 0)` so these records register their imports without injecting empty lines. Reuses Plan 03's dedupe-per-from logic; simpler than authoring a new import-only path.
- **leading+trailing throttle semantics** chosen over leading-only — Dropdown's `resize.throttle(100)` needs the panel to settle at the FINAL position one tick after a continuous resize. lodash's default behavior. Test 7 covers the trailing-fire path with the `pendingArgs` slot capturing latest args during the suppressed window.
- **Plan 04 owns Dropdown/SearchInput/TodoList script.snap regen** via the FULL emitVue pipeline; emitScript.test.ts's file-snapshot loop reduced to Counter only. Without this Plan 02's emitScript-only output would race-overwrite Plan 04's composite snapshot.
- **Three-rewriter set is structural** — rewriteRozieIdentifiers (whole-Program, .value-bearing), rewriteTemplateExpression (single Expression, NO .value), rewriteListenerExpression (single Expression, .value-bearing). All three share identification logic but diverge on scope + suffix application. Future refactor could extract a shared visitor helper, but v1 keeps them parallel for clarity.
- **`--no-verify` on every commit:** per the spawn-mode `<sequential_execution>` block; orchestrator validates pre-commit hooks once after the wave completes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Throttle test #7 expected wrong fire count for the post-trailing immediate path**

- **Found during:** Task 1 GREEN run
- **Issue:** The test asserted `throttled(4)` after the trailing fire would fire immediately, but the trailing fire resets internal `last` to its OWN fire time. Since the test only advanced 120ms total and the trailing fired at 100ms, `throttled(4)` at t=120ms was within the new 100ms window and was suppressed.
- **Fix:** Added `vi.advanceTimersByTime(120)` before `throttled(4)` so the test correctly verifies the post-trailing-window immediate-fire eligibility.
- **Files modified:** `packages/runtime/vue/src/__tests__/throttle.test.ts`
- **Verification:** All 20 runtime-vue tests pass.
- **Committed in:** `92e3c55` (Task 1 GREEN — folded in alongside throttle implementation)

**2. [Rule 1 — Bug] `arg.ref` for `.outside($refs.x)` is the BARE identifier, not the prefixed string**

- **Found during:** Task 2 GREEN initial test run
- **Issue:** My initial `refArgToIdentifier` (in emitListenerCollapsedOutsideClick.ts) and `renderModifierArg` (in emitListeners.ts) both checked `if (arg.ref.startsWith('$refs.'))` and only stripped the prefix when present. But the peggy modifier grammar at `modifier-grammar.peggy` line 47-49 already strips `$refs.` — `arg.ref` carries just `triggerEl` (no prefix). My code was producing `[triggerEl, panelEl]` instead of `[triggerElRef, panelElRef]`. Test 1 caught it.
- **Fix:** Removed the prefix-strip branch; always append `Ref` suffix to `arg.ref`. Verified Dropdown.script.snap shows `[triggerElRef, panelElRef]`.
- **Files modified:** `packages/targets/vue/src/emit/emitListenerCollapsedOutsideClick.ts`, `packages/targets/vue/src/emit/emitListeners.ts`
- **Verification:** All 13 emitListeners tests pass.
- **Committed in:** `b7bb44e` (Task 2 GREEN)

**3. [Rule 1 — Bug] `onCleanup(() => removeEventListener(...));` produced double-semicolon `}););`**

- **Found during:** Task 2 GREEN initial test run + first snapshot inspection
- **Issue:** I built `removeCall` ending with `;` then wrapped it as `onCleanup(() => ${removeCall});` which produced `onCleanup(() => removeEventListener(...););` — semantically valid JS but ugly and parsed by readers as a malformation.
- **Fix:** Split into `addCallNoSemi` / `removeCallNoSemi` (without trailing `;`), wrap inside the arrow body, then append `;` once at the outer statement boundary.
- **Files modified:** `packages/targets/vue/src/emit/emitListeners.ts`
- **Verification:** Dropdown.script.snap line 59 + 66 now show clean `onCleanup(() => document.removeEventListener('keydown', handler));`.
- **Committed in:** `b7bb44e` (Task 2 GREEN)

**4. [Rule 2 — Missing Critical] emitScript.test.ts file-snapshot loop overlapped with Plan 04 ownership**

- **Found during:** Task 2 GREEN final test run
- **Issue:** Plan 02's emitScript.test.ts file-snapshot loop ran emitScript-only output through `toMatchFileSnapshot` for SearchInput/Modal (and previously Counter). After Plan 04 regenerated SearchInput.script.snap from the FULL emitVue pipeline (which includes the debounce wrap from Plan 03's scriptInjection merge), Plan 02's emitScript-only output diverged — it didn't have the debounce wrap. The two tests would race-overwrite each other.
- **Fix:** Removed SearchInput + Modal from emitScript.test.ts's file-snapshot loop. Plan 03 (Modal) and Plan 04 (SearchInput/Dropdown/TodoList) own these fixtures via the full emitVue pipeline. Counter stays in emitScript.test.ts since it has no listeners or template wraps — emitScript-only output equals emitVue script-body output.
- **Files modified:** `packages/targets/vue/src/__tests__/emitScript.test.ts`
- **Verification:** All 78 target-vue tests pass; no test races on shared fixture paths.
- **Committed in:** `b7bb44e` (Task 2 GREEN)

---

**Total deviations:** 4 auto-fixed (3 emitter bugs, 1 missing-critical Plan-02-fixture-ownership cleanup)
**Impact on plan:** All auto-fixes essential for `<done>` and `<verification>` criteria to pass. No scope creep.

## Issues Encountered

- **Worktree branch base mismatch on first action:** the spawn prompt's `EXPECTED_BASE=fd5a3b1...` was AHEAD of HEAD's `6198097...` (HEAD was Plan 02-04's WR fixes; expected base was Plan 03's completion). Reset HEAD via `git reset --hard fd5a3b1...` to align with expected base; this is the correct base since Plan 04 builds on Plans 01-03 not on Plan 02-04.
- **`pnpm --filter` blocked in sandbox; `pnpm exec vitest run --root <pkg>` works:** initial test invocations via `pnpm --filter @rozie/runtime-vue test --run` were denied by the sandbox; switched to `pnpm exec vitest run --root packages/runtime/vue` which executed cleanly. All 20 runtime-vue tests + 78 target-vue tests + 391 core tests verified green.

## User Setup Required

None — no external service configuration required for Plan 04 implementation.

Plan 06 (P5) will require user/CI to run `pnpm --filter vue-vite-demo exec playwright install chromium` once before e2e tests run end-to-end (T-3-01-04 mitigation, inherited from Plan 01).

## Next Phase Readiness

**Plan 05 ready to start (style emission):**
- emitVue accepts the `<style scoped>...</style>` placeholder slot — Plan 05 replaces it with real `emitStyle(ir.styles)` output that produces both scoped and `:root`-extracted global blocks.

**Plan 06 ready to start (unplugin + demo wiring):**
- emitVue produces a complete `<template>` + `<script setup>` + `<style>` SFC text (style block still TODO Plan 05). The unplugin layer wraps this, attaches magic-string source maps, and routes through @vitejs/plugin-vue.
- @rozie/runtime-vue is now publishable (not a placeholder); Plan 06 unplugin can emit ROZ403 if @rozie/runtime-vue is not resolvable at consumer config-load time (Pitfall 8).

No new blockers introduced; STATE.md Open Questions tracker (OQ3, OQ2, OQ4) still applies.

## Self-Check: PASSED

All claimed files verified present in worktree:
- `packages/runtime/vue/src/useOutsideClick.ts` — FOUND
- `packages/runtime/vue/src/debounce.ts` — FOUND
- `packages/runtime/vue/src/throttle.ts` — FOUND
- `packages/runtime/vue/src/keyFilter.ts` — FOUND
- `packages/runtime/vue/src/__tests__/useOutsideClick.test.ts` — FOUND
- `packages/runtime/vue/src/__tests__/debounce.test.ts` — FOUND
- `packages/runtime/vue/src/__tests__/throttle.test.ts` — FOUND
- `packages/runtime/vue/src/__tests__/keyFilter.test.ts` — FOUND
- `packages/targets/vue/src/emit/emitListeners.ts` — FOUND
- `packages/targets/vue/src/emit/emitListenerCollapsedOutsideClick.ts` — FOUND
- `packages/targets/vue/src/rewrite/rewriteListenerExpression.ts` — FOUND
- `packages/targets/vue/src/__tests__/emitListeners.test.ts` — FOUND
- `packages/targets/vue/fixtures/Dropdown.script.snap` — FOUND (regenerated, 67 lines)
- `packages/targets/vue/fixtures/SearchInput.script.snap` — FOUND (regenerated)
- `packages/targets/vue/fixtures/TodoList.script.snap` — FOUND (regenerated)

All claimed commits verified present in `git log --oneline`:
- `c7ee8c8` (Task 1 RED) — FOUND
- `92e3c55` (Task 1 GREEN) — FOUND
- `f798b82` (Task 2 RED) — FOUND
- `b7bb44e` (Task 2 GREEN) — FOUND

Test execution: `pnpm exec vitest run --root packages/runtime/vue` — 4 files, 20 tests passed. `pnpm exec vitest run --root packages/targets/vue` — 7 files, 78 tests passed. `pnpm exec vitest run --root packages/core` — 35 files, 391 tests passed.

---
*Phase: 03-vue-3-4-target-emitter-first-demoable-artifact*
*Completed: 2026-05-02*
