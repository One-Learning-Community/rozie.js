/**
 * validateEmitNameCollision.test.ts — quick task 260812-i67, Task 1 (ROZ997).
 *
 * Drives through `lowerToIR` (NOT the validator in isolation) so the wiring
 * into the shared compile()/@rozie/unplugin chokepoint is proven, in the style
 * of the sibling `__tests__` files.
 *
 * NOTE on ROZ981 coexistence: a kebab/camel pair ('sort-change' +
 * 'sortChange') ALSO fires ROZ981 (Phase 61's Svelte-normalization collapse —
 * strip-hyphen+lowercase) from the semantic validators. The two equivalences
 * differ (ROZ981 collides case-only pairs ROZ997 does not; ROZ997 collides
 * snake+camel pairs ROZ981 does not) — neither subsumes the other, so these
 * assertions FILTER by code and pin exactly the ROZ997 surface.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { canonicalEventKey } from '../../diagnostics/canonicalEventKey.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';

function lower(src: string): { diagnostics: Diagnostic[] } {
  const registry = createDefaultRegistry();
  const { ast, diagnostics: parseDiags } = parse(src, {
    filename: 'Collider.rozie',
  });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.code).join(', ')}`,
    );
  }
  const { diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    filename: 'Collider.rozie',
  });
  return { diagnostics: [...parseDiags, ...irDiags] };
}

function componentWithEmits(...names: string[]): string {
  const calls = names.map((n) => `  $emit('${n}');`).join('\n');
  return `<rozie name="Collider">
<template>
  <button type="button" @click="fire()">go</button>
</template>
<script>
function fire() {
${calls}
}
</script>
</rozie>
`;
}

function roz997(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(
    (d) => d.code === RozieErrorCode.EMIT_NAME_CANONICAL_COLLISION,
  );
}

describe('validateEmitNameCollision (ROZ997) — via lowerToIR', () => {
  it('kebab + camel: exactly one ROZ997 error naming both spellings and the shared canonical key', () => {
    const { diagnostics } = lower(
      componentWithEmits('sort-change', 'sortChange'),
    );
    const hits = roz997(diagnostics);
    expect(hits.length).toBe(1);
    const hit = hits[0]!;
    expect(hit.severity).toBe('error');
    expect(hit.message).toContain("'sort-change'");
    expect(hit.message).toContain("'sortChange'");
    expect(hit.message).toContain("'sortChange'"); // the shared canonical key
    expect(hit.hint).toContain('ONE spelling');
  });

  it('snake + camel (the genuinely-silent pre-change shape): exactly one ROZ997', () => {
    const { diagnostics } = lower(
      componentWithEmits('sort_change', 'sortChange'),
    );
    const hits = roz997(diagnostics);
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain("'sort_change'");
    expect(hits[0]!.message).toContain("'sortChange'");
    // Pin the pre-normalization rationale: the bare canonicalEventKey does NOT
    // equate these two (identifier fast path keeps 'sort_change' verbatim) —
    // the validator's underscore→hyphen pre-normalization is what groups them.
    expect(canonicalEventKey('sort_change')).toBe('sort_change');
    expect(canonicalEventKey('sortChange')).toBe('sortChange');
  });

  it('snake + kebab: exactly one ROZ997', () => {
    const { diagnostics } = lower(
      componentWithEmits('sort_change', 'sort-change'),
    );
    expect(roz997(diagnostics).length).toBe(1);
  });

  it('three-way group (kebab + camel + snake): exactly ONE ROZ997 for the group, not one per pair', () => {
    const { diagnostics } = lower(
      componentWithEmits('sort-change', 'sortChange', 'sort_change'),
    );
    const hits = roz997(diagnostics);
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain("'sort-change'");
    expect(hits[0]!.message).toContain("'sortChange'");
    expect(hits[0]!.message).toContain("'sort_change'");
  });

  it('two independent colliding groups: one ROZ997 each, in first-occurrence source order', () => {
    const { diagnostics } = lower(
      componentWithEmits('sort-change', 'row-select', 'sortChange', 'rowSelect'),
    );
    const hits = roz997(diagnostics);
    expect(hits.length).toBe(2);
    expect(hits[0]!.message).toContain("'sort-change'");
    expect(hits[1]!.message).toContain("'row-select'");
  });

  it('distinct, non-colliding emits: zero ROZ997', () => {
    const { diagnostics } = lower(
      componentWithEmits('save', 'cancel', 'row-select'),
    );
    expect(roz997(diagnostics).length).toBe(0);
  });

  it('a single emit: zero ROZ997', () => {
    const { diagnostics } = lower(componentWithEmits('sort-change'));
    expect(roz997(diagnostics).length).toBe(0);
  });

  it('zero emits: zero ROZ997', () => {
    const { diagnostics } = lower(`<rozie name="Collider">
<template>
  <button type="button">go</button>
</template>
</rozie>
`);
    expect(roz997(diagnostics).length).toBe(0);
  });

  it('the same $emit name written twice: zero ROZ997 (lower.ts dedupes by exact string)', () => {
    const { diagnostics } = lower(
      componentWithEmits('sort-change', 'sort-change'),
    );
    expect(roz997(diagnostics).length).toBe(0);
  });
});
