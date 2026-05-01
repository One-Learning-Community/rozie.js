// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-04 fills these in.
//
// MOD-02 modifier registry: ModifierRegistry class + registerModifier API
// (D-22b SemVer-stable) + registerBuiltins(registry) populates the 11+
// built-in modifiers per D-22.
import { describe, it } from 'vitest';

describe('ModifierRegistry — Plan 02-04', () => {
  it.todo('new ModifierRegistry().has("outside") === false (empty registry)');
  it.todo('registerBuiltins(reg).has("outside") === true and 11+ other builtins');
  it.todo('registerModifier(reg, "swipe", impl) succeeds');
  it.todo('registerModifier with duplicate name throws (conflict detection per RESEARCH.md ModifierRegistry.register)');
  it.todo('reg.list() returns sorted array of registered modifier names');
  it.todo('Snapshot fixtures/modifiers/registry-builtins.snap captures registerBuiltins-populated registry');
});
