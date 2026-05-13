/**
 * composition tests — Plan 06.4-01 Task 2 markers.
 *
 * Plan 06.4-02 (P2) fills these in with assertions covering cross-rozie
 * composition (D-LIT side-effect import → customElements.define registration)
 * and self-reference within the same .rozie file.
 */
import { describe, it } from 'vitest';

describe('composition — Lit cross-component + self-reference (P2 deferred)', () => {
  it.todo('emits `import \'./Foo.rozie\';` (side-effect, no symbol bind) for <components> entries (Plan 06.4-02)');
  it.todo('emits `<rozie-foo>` tag inside html`...` for component references (Plan 06.4-02)');
  it.todo('handles self-reference via the same customElements.define registration (no forwardRef needed) (Plan 06.4-02)');
  it.todo('emits TreeNode.rozie recursion correctly across all 8 reference examples (Plan 06.4-02)');
});
