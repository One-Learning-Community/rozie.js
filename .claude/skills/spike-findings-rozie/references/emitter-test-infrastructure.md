# Emitter test infrastructure — invariant harnesses over generated output

How to find emitter bugs the green suite misses. Spike 012 found 5 escaping shapes → 4 root-caused
bug classes (1 crash, 1 runtime, 1 wrong-call, 1 strict-type), 0 generator noise.

## Requirements

From the `killer-component-ports` idea.

- **REQ-33** — the shape-matrix asserts target-agnostic **INVARIANTS**, never golden strings.
  dist-parity owns byte-identity. Orthogonal layers; do not duplicate.
- **REQ-34** — a compile **THROW** and an error **DIAGNOSTIC** are different. A throw on valid Rozie
  is an escape (contract: `compile()` never throws); a diagnostic is generator noise. Never conflate.
- **REQ-35** — classify every `tsc` escape as real-under-any-config vs strict-consumer-only vs
  strict-only-symptom-of-a-runtime-bug. Verify under the leaves' RELAXED flags before filing.
- **REQ-36** — the free-identifier invariant needs a per-target **baseline vocabulary** built from
  known-good emits, or framework macros (`defineProps`, `$state`) read as false escapes. Observed
  baseline was just `crypto` + Vue/Svelte macros — near-zero-noise signal.
- **REQ-38 (open, emitter-backlog candidate)** — React's `$computed`→`useMemo` dep-array analysis
  includes **module-scope imported identifiers** as deps (`}, [lexical])`). Harmless (stable identity)
  but imprecise; module-scope imports should be excluded from the reactive dep set. Red-first fixable.

## How to Build It

Drive the public `compile(src, { target })` from a plain `.mjs`: resolve `@babel/*` via
`createRequire(packages/core/package.json)`, import `compile` from the built
`packages/core/dist/index.mjs` by absolute path — no install needed. Generate `.rozie` sources
programmatically as construct × structural-context, then assert invariants:

1. **Babel scope-walk** for free value-space identifiers (calibrated against per-target baseline vocab)
2. **Nested-`this` walk** (class-target runtime bugs)
3. **Batched strict `tsc --noEmit`** reusing `tests/strict-conformance` options + the committed
   `combobox` leaf `node_modules` for type resolution

## What to Avoid

Snapshot tests cement bugs — a fixture that captures buggy emit locks it in. Invariants don't.

## Origin

Spike: 012 — sources in `sources/012-emitter-shape-matrix/`
