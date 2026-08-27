---
spike: 012
name: emitter-shape-matrix
type: standard
validates: "Given a construct × structural-context grid compiled to all 6 targets, when target-agnostic invariants run over the emit, then NEW emitter bugs surface that the current green suite (dist-parity byte-identity + relaxed leaf typecheck) misses"
verdict: VALIDATED
related: []
tags: [emitter, test-infrastructure, generative, invariants, tsc, scope-walk, phase-73, this-rewrite, lit, angular, solid, shadowing]
---

# Spike 012: Emitter Shape-Matrix Torture Harness

## What This Validates

Given a programmatic **construct × structural-context** grid, compiled to all six
targets via `compile(src, { target })`, when target-agnostic **invariants** (not
golden strings) run over the emit, then it surfaces the class of emitter bug that
survives a fully-green suite: correct output for the happy-path shape, broken
output when the same construct appears **one structural level deeper**.

Motivated by three Phase-73 escapes that passed dist-parity 1001/1001 + all six
target suites + full Linux VR, caught only by adversarial review. Those are now
fixed — so success here = finding **new, still-live** escapes, on the thesis that
the surgical fixes were shape-specific and the matrix crosses them with contexts
the fixes never covered.

## How to Run

```bash
# @rozie/core dist must be built (it is, committed): packages/core/dist/index.mjs
node .planning/spikes/012-emitter-shape-matrix/run.mjs
```

No install. Babel + the pinned `tsc` resolve from the repo (`packages/core` and
`tests/strict-conformance` respectively); type resolution for the tsc invariant
symlinks the committed `packages/ui/combobox/packages/{react,solid,lit}`
node_modules. Runtime ≈ 1.6 s for the whole grid (26 cells × 6 targets + 3
batched tsc runs).

- `probe.mjs` — Stage-A feasibility probe (compile plumbing + babel parse).
- `lib/generate.mjs` — construct × context → `.rozie` source strings.
- `lib/invariants.mjs` — scope-walk (free value idents) + nested-`this` invariants.
- `lib/tsc-invariant.mjs` — batched strict `tsc --noEmit` for react/solid/lit.
- `run.mjs` — orchestrator: baseline calibration, grid, invariants, ledger.

## Architecture (the harness in four moves)

1. **Generator** — three high-yield constructs (the Phase-73 classes), each
   crossed with a set of structural contexts that vary where/how the construct
   is placed: `poly-model-guard` × {top-arrow, if, for, while, switch, try,
   double-if, nested-helper, in-operator, reread-in-call, logical}; `onmount-
   cleanup-local` × {plain-const, object/array/renamed/nested/default
   destructure, let-then-assign, two-locals}; `expose-verb-shadow` × {helper-
   param, catch-param, for-of-var, destructured-param, arrow-param, nested-fn}.

2. **Compile fan** — every cell → all 6 targets via `compile()`. A cell whose
   compile reports an **error diagnostic** is generator noise (invalid input),
   recorded separately, never an escape. A cell that makes compile **throw** is
   the worst escape (contract: compile never throws).

3. **Invariants** (target-agnostic, not golden):
   - **scope-walk** (all 6): free value-space identifier with no binding and not
     a known global → the `v`/`timer` TS2304 class. Calibrated against a
     per-target baseline vocabulary built from known-good reference emits + the
     *fixed* Phase-73 fixtures, so the signal is low-noise (baseline vocab across
     all six targets was just `crypto` + the Vue/Svelte compiler macros).
   - **nested-`this`** (fires on class targets): a `this` inside a nested plain
     `function` → runtime `this===undefined`; catches the Lit/Angular bug without
     needing an Angular-template typecheck.
   - **strict tsc** (react/solid/lit): batched `tsc --noEmit` (reuses the
     strict-conformance recipe) catches type-space escapes scope-walk can't see —
     narrowing TS2322, arity TS2554.

4. **Ledger** — group escapes by (construct × context), root-cause to a seam.

## Investigation Trail

- **Stage A (plumbing).** `compile(src, {target, filename, sourceMap:false})` →
  `{ code, diagnostics }`, never throws (by contract). All 6 targets compiled the
  known CR-01 shape clean (it's fixed — Solid emits the `value()` accessor, no
  bare `v`). Babel parses the emit. Gate passed.
- **First grid run (scope-walk only).** 154/156 clean compiles, **0** scope-walk
  escapes — but **2 compile THROWS** my harness had mis-filed as "generator
  noise." Reclassified: a throw on valid Rozie is an escape. The throw is on
  `expose-verb-shadow / catch-param` (angular + lit).
- **Realized scope-walk alone under-covers.** The 73-02 motivating bug was a
  TS2322 *narrowing* failure with no free identifier — invisible to scope-walk.
  Added the batched strict-tsc invariant (react/solid/lit). Re-run surfaced 10
  tsc escapes across 8 more cells.
- **Honesty pass (strict-only vs real).** Verified escapes under the leaves'
  *relaxed* flags: the Solid TS2322 vanishes (strict-consumer-only, same root
  family as the documented "Solid poly-narrow gap = BACKLOG"); the Lit TS2683 is
  strict-only but is the *symptom* of a config-independent **runtime** bug.
- **Root-caused by reading the emit.** Lit *and* Angular emit `$props.value` →
  `this.value` **inside a nested plain `function inner()`** — `this` is not the
  component there. React emits the correct closure `value` (no `this`). Added a
  target-agnostic nested-`this` invariant; it flags Angular too (which strict-tsc
  didn't cover). Confirmed all three class-target bugs trace to one seam:
  `packages/targets/lit/src/rewrite/scopeAwareSkip.ts` (mirrored in Angular),
  whose `hasShadowingBinding` enumerates function params + inner let/const/var but
  **not** `CatchClause.param` and **not** inner `FunctionDeclaration` names, and
  whose rewrite has no nested-`this` awareness.

## Results

**VERDICT: VALIDATED — emphatically.** The generative matrix found **5 distinct
escaping (construct × context) shapes → 4 root-caused bug classes**, none caught
by the green suite (dist-parity is byte-identity; leaf typecheck is relaxed;
these exact shapes have no fixtures). Generator noise was **0** — every escape is
a real emitter defect on a cell that compiled without an error diagnostic. See
`BUG-LEDGER.md`.

**Why the green suite missed them:** dist-parity asserts the emit is *unchanged*,
not that it's *correct* — it would have happily cemented every one of these
(cf. the `snapshot-tests-cement-bugs` learning). The leaf typecheck runs under
relaxed flags, hiding the Solid TS2322. And no fixture exercises these
one-level-deeper shapes because the corpus grows one-fixture-per-fix.

**The three class-target bugs share one seam** — `scopeAwareSkip.ts` is an
`@experimental` guard documented only for the destructured-parameter case; the
matrix mechanically enumerated three sibling scope cases (catch param, nested
function-decl name, nested `this`) the author never imagined. This is the exact
"the shape a fixture tests, plus one structural twist" failure the spike targeted.

### Find-rate summary

| Metric | Initial grid | Expanded grid |
|---|---|---|
| Cells generated | 26 (3 constructs) | 49 (8 constructs) |
| Compiles | 156 | 294 |
| Generator noise (real diagnostics) | 0 | 6 (all correct compiler diagnostics) |
| Root-caused bug classes | 4 | 4 + 4 = 8 |
| Severity | 1 crash, 1 runtime, 1 wrong-call, 1 strict-type | + 1 crash, 2 broken-emit, 1 strict-type |

**Fix outcome:** the initial 4 (BUG-1..4) + the expansion crash (NEW-1) are FIXED
(6 red-first regression fixtures + 1 reblessed; dist-parity 1001/1001, regressions
113, target suites green). NEW-2/3/4 are filed OPEN in `BUG-LEDGER.md`. Every
nested-scope sigil variant added in the expansion compiled clean — proof
`redirectNestedThis` (BUG-2's fix) generalized correctly.

The 6 "generator noise" cells in the expanded grid are the compiler CORRECTLY
emitting diagnostics (Angular `ROZ720` for an r-for loop-var/state collision,
`ROZ621`/`ROZ722` for unsupported modifier chains) — the harness's throw-vs-
diagnostic-vs-clean classification kept those out of the escape count.

### What the harness is (deliverable #2)

A ~350-LOC standalone rig proving the approach. To productionize as the CI layer
the remote-control brief describes: wrap `run.mjs` as a vitest suite under
`tests/shape-matrix/`, assert `escapes.length === KNOWN_OPEN` (a ratchet, so new
escapes fail CI while the open backlog is acknowledged), and broaden the grid
(the remaining constructs: `$computed`, `$watch`, `r-for`+slot, event modifiers,
`$emit`, portal slots, bare boolean attr). The invariants (scope-walk +
nested-`this` + batched tsc) already generalize to any construct.

## Requirements That Emerged

- **REQ-33 (test infra):** the shape-matrix asserts **invariants**, never golden
  strings — dist-parity owns byte-identity. The two are orthogonal layers.
- **REQ-34 (harness discipline):** a compile **throw** and an **error
  diagnostic** are different — throw = escape (contract violation), diagnostic =
  generator noise. Never conflate.
- **REQ-35 (invariant honesty):** classify every tsc escape as real-under-any-
  config vs strict-consumer-only vs strict-only-symptom-of-runtime-bug. Verify
  under the leaves' *relaxed* flags before filing; do not over-claim.
- **REQ-36 (calibration):** scope-walk needs a per-target baseline vocabulary
  from known-good emits (incl. the *fixed* fixtures for the tortured construct) or
  framework macros (`defineProps`, `$state`) read as false escapes.
