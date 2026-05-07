// Phase 06.2 P1 Task 2 — isPascalCase shared util tests.
// Implementation: packages/core/src/ir/utils/isPascalCase.ts.
// Locks the D-116 promotion: byte-identical behavior to the React emitter's
// previous local isCustomComponent.
import { describe, expect, it } from 'vitest';
import { isPascalCase } from '../../src/ir/utils/isPascalCase.js';

describe('isPascalCase (Phase 06.2 P1 D-116)', () => {
  it('returns true for canonical PascalCase identifiers', () => {
    expect(isPascalCase('Modal')).toBe(true);
    expect(isPascalCase('TreeNode')).toBe(true);
    expect(isPascalCase('CardHeader')).toBe(true);
    // Single uppercase letter — boundary case for component-library naming.
    expect(isPascalCase('A')).toBe(true);
    expect(isPascalCase('Z')).toBe(true);
  });

  it('returns false for HTML tags / custom-elements / namespaced tags', () => {
    expect(isPascalCase('div')).toBe(false);
    expect(isPascalCase('button')).toBe(false);
    expect(isPascalCase('my-comp')).toBe(false);
    expect(isPascalCase('svelte:fragment')).toBe(false);
    expect(isPascalCase('ng-container')).toBe(false);
  });

  it('returns false for empty + non-letter starts', () => {
    expect(isPascalCase('')).toBe(false);
    expect(isPascalCase('a')).toBe(false);
    expect(isPascalCase('1Foo')).toBe(false); // digit-start
    expect(isPascalCase('-Foo')).toBe(false);
    expect(isPascalCase(':host')).toBe(false);
  });
});
