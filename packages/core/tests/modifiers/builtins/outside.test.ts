// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-04 fills these in.
//
// MOD-04 .outside(...refs) — fires only when event target is outside ALL
// listed refs; no-arg defaults to $el.
import { describe, it } from 'vitest';

describe('builtin: .outside — Plan 02-04', () => {
  it.todo('.outside($refs.triggerEl, $refs.panelEl) → ModifierPipelineEntry { kind: "wrap", modifier: "outside", args: [refExpr, refExpr] }');
  it.todo('.outside() (no args) → entry with args: [] (defaults to $el at emit time per MOD-04)');
  it.todo('.outside("string-literal") → ROZ112 invalid arg shape (refExpr expected)');
});
