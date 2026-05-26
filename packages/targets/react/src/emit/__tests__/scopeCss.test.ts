/**
 * scopeCss `:deep()` recognition tests (quick task 260526-mk4).
 *
 * Verifies that the React target's scope-rewrite pass:
 *   1. Hoists the inner selector of `:deep(...)` into the parent selector.
 *   2. Skips the scope-attr suffix (`[data-rozie-s-<hash>]`) on the lifted
 *      parts.
 *   3. Distributes `:deep(a, b)` by cloning the parent selector once per
 *      inner branch (matches Vue 3.4+ scoped-CSS semantics).
 *
 * Mirrored across the four scope-rewriting targets (react / solid / svelte /
 * lit). Vue's emitStyle byte-slices `:deep()` verbatim — see the Vue target's
 * emitStyle smoke test. Angular has its own `::ng-deep` lowering.
 */
import { describe, expect, it } from 'vitest';
import { scopeCss } from '../scopeCss.js';

const HASH = 'abc123';
const SCOPE_ATTR = `[data-rozie-s-${HASH}]`;

describe('scopeCss — :deep() cross-component escape hatch', () => {
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
    // The child combinator survives.
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s*>\s*\.a\s*>\s*\.b/);
  });

  it('.outer :deep(.a, .b) — distributes across the comma-separated list', () => {
    const out = scopeCss('.outer :deep(.a, .b) { color: red; }', HASH);
    // Should produce two selectors: `.outer[scope] .a` and `.outer[scope] .b`.
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.a/);
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.b/);
    expect(out).not.toContain(':deep');
    expect(out).not.toContain(`.a${SCOPE_ATTR}`);
    expect(out).not.toContain(`.b${SCOPE_ATTR}`);
  });

  it(':deep(:not(.x)) — nested-selector-list pseudo inside :deep is unscoped', () => {
    const out = scopeCss(':deep(:not(.x)) { color: red; }', HASH);
    expect(out).toContain(':not(.x)');
    // Neither the outer compound nor the inner of :not get the scope attr.
    expect(out).not.toContain(SCOPE_ATTR);
    expect(out).not.toContain(':deep');
  });

  it('plain rules unaffected — non-:deep selectors still get the scope attr', () => {
    const out = scopeCss(
      '.plain { color: blue; } .outer :deep(.inner) { color: red; }',
      HASH,
    );
    expect(out).toMatch(/\.plain\[data-rozie-s-abc123\]/);
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.inner/);
  });

  it('does not crash on a malformed :deep without args', () => {
    // postcss-selector-parser is forgiving; this should round-trip.
    // We don't promise specific behavior — only "no crash".
    expect(() => scopeCss(':deep { color: red; }', HASH)).not.toThrow();
  });
});
