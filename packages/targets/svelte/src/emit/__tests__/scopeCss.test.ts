/**
 * scopeCss `:deep()` recognition tests (quick task 260526-mk4).
 *
 * Svelte target — mirrors the React/Solid/Lit per-target tests. See
 * packages/targets/react/src/emit/__tests__/scopeCss.test.ts for the
 * shared design rationale.
 *
 * The Svelte target's caller wraps the scopeCss output in Svelte 5's
 * `:global { ... }` block; these tests exercise the raw rewriter output.
 */
import { describe, expect, it } from 'vitest';
import { scopeCss } from '../scopeCss.js';

const HASH = 'abc123';
const SCOPE_ATTR = `[data-rozie-s-${HASH}]`;

describe('scopeCss (svelte) — :deep() cross-component escape hatch', () => {
  it(':deep(.x) — inner lifted, NO scope attr anywhere', () => {
    const out = scopeCss(':deep(.x) { color: red; }', HASH);
    expect(out).toContain('.x');
    expect(out).not.toContain(':deep');
    expect(out).not.toContain(SCOPE_ATTR);
  });

  it('.outer :deep(.inner) — outer scoped, inner unscoped', () => {
    const out = scopeCss('.outer :deep(.inner) { color: red; }', HASH);
    expect(out).toContain(`.outer${SCOPE_ATTR}`);
    expect(out).toContain('.inner');
    expect(out).not.toContain(`.inner${SCOPE_ATTR}`);
    expect(out).not.toContain(':deep');
  });

  it('.outer > :deep(.a > .b) — combinator inside :deep preserved', () => {
    const out = scopeCss('.outer > :deep(.a > .b) { color: red; }', HASH);
    expect(out).toContain(`.outer${SCOPE_ATTR}`);
    expect(out).toContain('.a');
    expect(out).toContain('.b');
    expect(out).not.toContain(`.a${SCOPE_ATTR}`);
    expect(out).not.toContain(`.b${SCOPE_ATTR}`);
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s*>\s*\.a\s*>\s*\.b/);
  });

  it('.outer :deep(.a, .b) — distributes across comma list', () => {
    const out = scopeCss('.outer :deep(.a, .b) { color: red; }', HASH);
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.a/);
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.b/);
    expect(out).not.toContain(':deep');
  });

  it(':deep(:not(.x)) — nested-list pseudo inside :deep is unscoped', () => {
    const out = scopeCss(':deep(:not(.x)) { color: red; }', HASH);
    expect(out).toContain(':not(.x)');
    expect(out).not.toContain(SCOPE_ATTR);
    expect(out).not.toContain(':deep');
  });

  it('plain rules unaffected', () => {
    const out = scopeCss(
      '.plain { color: blue; } .outer :deep(.inner) { color: red; }',
      HASH,
    );
    expect(out).toMatch(/\.plain\[data-rozie-s-abc123\]/);
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.inner/);
  });

  it('does not crash on a malformed :deep without args', () => {
    expect(() => scopeCss(':deep { color: red; }', HASH)).not.toThrow();
  });
});

/**
 * Phase 17 Plan 03 (SPEC-R1 non-Lit arm / SPEC-R4a) — `::part(name)` consumer
 * rules are a cross-shadow mechanism with meaning only on Lit. On Svelte they
 * must be DROPPED in `scopeCss` rather than scope-mangled (the caller later
 * wraps the survivors in a `:global { ... }` block — a dropped rule must not
 * reach it). The drop is independent of the `:deep` code path (SPEC-R5).
 */
describe('scopeCss (svelte) — ::part() cross-shadow no-op strip (SPEC-R4a)', () => {
  it('drops a `<child>::part(body)` rule entirely — no ::part, no scope-attr leakage', () => {
    const out = scopeCss('rozie-part-card::part(body) { color: red; }', HASH);
    expect(out).not.toContain('::part');
    expect(out).not.toContain(`rozie-part-card${SCOPE_ATTR}`);
    expect(out).not.toContain('color: red');
  });

  it('drops ONLY the ::part rule — a co-present ordinary rule still gets scoped', () => {
    const out = scopeCss(
      'rozie-part-card::part(body) { color: red; }\n.card-body { padding: 1rem; }',
      HASH,
    );
    expect(out).not.toContain('::part');
    expect(out).not.toContain('color: red');
    expect(out).toMatch(/\.card-body\[data-rozie-s-abc123\]/);
    expect(out).toContain('padding: 1rem');
  });

  it(':deep regression guard — a sibling :deep rule still lowers (inner unscoped), ::part rule gone', () => {
    const out = scopeCss(
      '.outer :deep(.inner) { color: red; }\nrozie-part-card::part(body) { color: blue; }',
      HASH,
    );
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.inner/);
    expect(out).not.toContain(`.inner${SCOPE_ATTR}`);
    expect(out).not.toContain('::part');
    expect(out).not.toContain('color: blue');
  });

  it('does not throw on a ::part rule (no diagnostic surfaced from the strip)', () => {
    expect(() => scopeCss('rozie-part-card::part(body) { color: red; }', HASH)).not.toThrow();
  });
});
