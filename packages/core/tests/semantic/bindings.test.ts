// Phase 2 Plan 02-01 Task 1: smoke import for @babel/traverse + Task 3: BindingsTable behavior tests.
//
// The smoke test confirms that @babel/traverse@^7.29.0 is installed, importable
// via default-export, and callable. Plan 02-01 Task 3 extends this file with
// the full BindingsTable test suite (9 behavior tests). Plan 02 (validators)
// then adds further tests for unknownRefValidator etc. via separate files.
import { describe, expect, it } from 'vitest';
import traverse from '@babel/traverse';

describe('@babel/traverse smoke (Plan 02-01 Task 1)', () => {
  it('default export is a function', () => {
    expect(typeof traverse).toBe('function');
  });
  // Plan 01 Task 3 will add: it('builds BindingsTable for Counter.rozie', ...)
  // Plan 02 will add: it('runs unknownRefValidator', ...) etc.
});
