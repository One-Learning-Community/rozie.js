// Phase 5 success criterion #4 — @input.debounce(300) parity across all 4
// target frameworks. Plan 05-05 Task 1 fills in Svelte + Angular paths and
// flips it.todo → it. Vue + React paths are runnable now (Phases 3 + 4
// shipped emitters).
//
// Test shape: parameterize over targets, compile examples/SearchInput.rozie
// to each, mount the compiled component in a per-framework happy-dom +
// test-utils harness, dispatch 5 input events spaced 50ms apart, advance
// timers by 300ms, assert the user's onSearch handler fired EXACTLY ONCE
// with the final input value.

import { describe, it } from 'vitest';

const TARGETS = ['vue', 'react', 'svelte', 'angular'] as const;
type _Target = (typeof TARGETS)[number];

describe('SearchInput debounce timing parity (Phase 5 success criterion #4)', () => {
  for (const target of TARGETS) {
    if (target === 'vue' || target === 'react') {
      it.todo(`${target}: @input.debounce(300) fires once after 300ms quiescence`);
      // Plan 05-05 Task 1 lifts these to it() — they should already work
      // since Phases 3+4 shipped vue + react emitters with debounce. Wave 0
      // marks as todo to keep CI green until the parity harness is wired.
    } else {
      it.todo(`${target}: @input.debounce(300) fires once after 300ms quiescence (Plan 05-05 Wave 3)`);
    }
  }
});
