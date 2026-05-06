// Phase 5 Plan 05-01 Wave 0 — 5 whole-SFC fixture snapshot scaffold.
//
// Each example .rozie compiles to a .svelte.snap fixture; per-example
// substring invariants follow Plan 05-02 once the emitter is real.
//
// Wave 0 marks every test as it.todo so vitest exits 0 while the harness
// is wired but not yet exercised. Plan 05-02 flips them to it() and adds
// the smoke test that compileSvelte(emitted, { generate: 'client' })
// must NOT throw.
//
// Example list mirrors Vue + React harnesses for cross-target parity.
import { describe, it } from 'vitest';

const EXAMPLE_NAMES = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'] as const;

describe('emitSvelte — 5 whole-SFC fixture snapshots (Plan 05-02 fills)', () => {
  for (const name of EXAMPLE_NAMES) {
    it.todo(`${name}.svelte.snap — Plan 05-02 fills`);
  }
});

describe('emitSvelte — Plan 05-02 smoke tests (svelte/compiler parses emitted output)', () => {
  for (const name of EXAMPLE_NAMES) {
    it.todo(`${name} compiles cleanly via svelte/compiler — Plan 05-02 fills`);
  }
});
