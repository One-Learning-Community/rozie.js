// Phase 5 Plan 05-01 Wave 0 — 5 whole-component fixture snapshot scaffold.
//
// Each example .rozie compiles to a {name}.ts.snap fixture; per-example
// substring invariants follow Plan 05-04 once the emitter is real.
//
// Wave 0 marks every test as it.todo so vitest exits 0 while the harness
// is wired but not yet exercised. Plan 05-04 flips them to it() and adds
// the smoke test that @angular/compiler successfully consumes the emitted
// inline-template standalone-component class.
//
// Example list mirrors Vue + React + Svelte harnesses for cross-target parity.
import { describe, it } from 'vitest';

const EXAMPLE_NAMES = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'] as const;

describe('emitAngular — 5 whole-component fixture snapshots (Plan 05-04 fills)', () => {
  for (const name of EXAMPLE_NAMES) {
    it.todo(`${name}.ts.snap — Plan 05-04 fills`);
  }
});

describe('emitAngular — Plan 05-04 smoke tests (@angular/compiler accepts emitted output)', () => {
  for (const name of EXAMPLE_NAMES) {
    it.todo(`${name} compiles cleanly via @angular/compiler — Plan 05-04 fills`);
  }
});
