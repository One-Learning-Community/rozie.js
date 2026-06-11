# Phase 41 Wave-0 De-Risk Probe (throwaway)

Proves the SINGLE load-bearing unknown of the FlowCanvas controlled-graph
redesign: that a two-way `r-model:graph` **deep-object** write-back — emitting a
FRESH `{nodes,connections}` object via `$model.graph` (the React-Flow
`applyNodeChanges` immutable-update idiom) — round-trips to the bound consumer
and is echo-safe on **all 6 targets**, compiled with **NO** `packages/targets/*`
or `packages/core/*` change.

This GATES the entire redesign (41-CONTEXT `<wave0_gate>`). If any target needed
an emitter change, that would be a scope-fence BLOCKER.

## Files

- `Probe.rozie` — engine-less component with ONE `graph: { type: Object, model: true }`
  prop. `$onMount` emits a fresh-object write-back after 50ms; `$watch(() => $props.graph)`
  counts fires (echo-safety).
- `ProbeConsumer.rozie` — self-binds `r-model:graph="$data.g"` into `Probe`; renders
  `{{ $data.g.nodes.length }}` (the make-or-break readout). `$expose({ stress })`
  drives the 60x drag-frequency stress.
- `run-probe.mjs` — the driver: compile-all-6 gate + per-target Vite build + Playwright
  mount + behavioral asserts (readout, echo-safety, stress convergence) + validation
  feasibility micro-check.
- `vite.probe.config.ts` — per-target build config (modeled on `tests/visual-regression/vite.config.ts`).
- `host/entry.<target>.ts` — per-target mount idioms (React createRoot / Vue createApp /
  Svelte mount / Solid render / Lit custom-element / Angular createComponent).

## Run

```sh
cd tests/visual-regression          # so the 6 framework plugins + chromium resolve
node ../../packages/ui/rete/scripts/probe-41/run-probe.mjs
```

PASS = all 6 green (compile, readout==1, bounded watchFires, stress converges,
validation feasible) → exits 0. The no-emitter-change hypothesis HOLDS.

## Result (2026-06-11)

ALL 6 GREEN. readout==1 on every target after the fresh-object write-back;
watchFires==1 (echo-safe); 60x stress converged; zero error diagnostics; scope
fence held (no `packages/targets`/`packages/core` change). See `41-01-SUMMARY.md`.
