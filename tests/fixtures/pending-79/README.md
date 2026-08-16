# Pending Phase 79 fixtures — TEMPORARY HOME

These two fixtures are the `DynamicSlots` producer/consumer pair from Phase 79 decision **D-10**.
Their **final home is `examples/`** — `examples/DynamicSlots.rozie` and
`examples/DynamicSlotsConsumer.rozie`. Plan **79-13** `git mv`s them there and registers them in
`tests/dist-parity/scripts/bootstrap-fixtures.mjs`.

## Why they are not in `examples/` yet

They exist to carry syntax the compiler does not support until later in Phase 79:

- a bound `:name` on `<slot>` (dynamic slot names) — lands in **79-06** (IR) / **79-07** (matching)
- a non-identifier (kebab) slot name — legal only after **79-03**..**79-05** retire ROZ127's
  identifier-shape check

`examples/` is a **compile-enforced corpus**: `packages/cli/src/__tests__/multi-target.test.ts`
expands a directory input as `${dir}/**/*.rozie` (see `packages/cli/src/utils/expandInputs.ts`) and
runs the full build matrix over it, so *every* `.rozie` under `examples/` — recursively, including
`examples/demos/` — must compile clean on all targets. Authoring these two there before the compiler
can build them turns `@rozie/cli`'s M2 and M7 tests red for roughly ten waves.

Parking them here keeps `examples/` green while the emitter work lands. Nothing under `tests/`
compile-enforces its `.rozie` files; the only walker is the ROZ095 AC-24 corpus scan in
`packages/core/src/ir/__tests__/validateSlotRecordPropCollision.test.ts`, which parses and lowers
each file and tolerates ones that do not yet lower.

## Do not

- Do **not** register these in `bootstrap-fixtures.mjs` from here — registration happens in 79-13,
  *after* the `git mv`, so the dist-parity fixture paths match D-10.
- Do **not** "fix" them to compile against the current compiler. They are red-first artifacts; the
  compiler moves to meet them, not the other way round.
- Do **not** leave them here once Phase 79 completes. If this directory still exists at phase end,
  79-13 did not run its move step.

## Provenance

Authored by plan 79-02 (commits `175b86e3`, `45eee55d`) directly into `examples/`. Relocated here
during the Wave 1 post-merge gate, which caught the `examples/` compile-enforcement that 79-02's plan
had not accounted for.
