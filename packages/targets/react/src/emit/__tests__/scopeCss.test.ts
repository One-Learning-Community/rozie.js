/**
 * scopeCss `:deep()` recognition tests (quick task 260526-mk4) +
 * `:global()` wrap on React-specific deep-lifted output (quick task 260526-no7).
 *
 * Verifies that the React target's scope-rewrite pass:
 *   1. Hoists the inner selector of `:deep(...)` into the parent selector,
 *      wrapped in CSS Modules' `:global(...)` pseudo so the bundler does
 *      NOT hash the lifted class names (React-only — Solid/Svelte/Lit each
 *      have their own equivalent mechanism, Angular uses `::ng-deep`, Vue
 *      byte-slices `:deep()` verbatim).
 *   2. Skips the scope-attr suffix (`[data-rozie-s-<hash>]`) on the lifted
 *      `:global(...)` wrap.
 *   3. Distributes `:deep(a, b)` by cloning the parent selector once per
 *      inner branch (matches Vue 3.4+ scoped-CSS semantics).
 */
import { describe, expect, it } from 'vitest';
import { scopeCss } from '../scopeCss.js';

const HASH = 'abc123';
const SCOPE_ATTR = `[data-rozie-s-${HASH}]`;

describe('scopeCss — :deep() cross-component escape hatch', () => {
  it(':deep(.x) — inner wrapped in :global, NO scope attr anywhere', () => {
    const out = scopeCss(':deep(.x) { color: red; }', HASH);
    expect(out).toContain(':global(.x)');
    expect(out).not.toContain(':deep');
    expect(out).not.toContain(SCOPE_ATTR);
  });

  it('.outer :deep(.inner) — outer scoped, inner wrapped in :global', () => {
    const out = scopeCss('.outer :deep(.inner) { color: red; }', HASH);
    expect(out).toContain(`.outer${SCOPE_ATTR}`);
    expect(out).toContain(':global(.inner)');
    expect(out).not.toContain(`.inner${SCOPE_ATTR}`);
    expect(out).not.toContain(':deep');
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+:global\(\.inner\)/);
  });

  it('.outer > :deep(.a > .b) — combinator inside :deep preserved INSIDE the :global wrap', () => {
    const out = scopeCss('.outer > :deep(.a > .b) { color: red; }', HASH);
    expect(out).toContain(`.outer${SCOPE_ATTR}`);
    // The child combinator inside the :deep payload lives INSIDE the :global()
    // wrap — NOT outside it. `:global(.a) > :global(.b)` would be wrong.
    expect(out).toMatch(
      /\.outer\[data-rozie-s-abc123\]\s*>\s*:global\(\.a\s*>\s*\.b\)/,
    );
    expect(out).not.toContain(`.a${SCOPE_ATTR}`);
    expect(out).not.toContain(`.b${SCOPE_ATTR}`);
    expect(out).not.toContain(':deep');
  });

  it('.outer :deep(.a, .b) — distributes across the comma-separated list, each branch :global-wrapped', () => {
    const out = scopeCss('.outer :deep(.a, .b) { color: red; }', HASH);
    // Should produce two selectors: `.outer[scope] :global(.a)` and
    // `.outer[scope] :global(.b)`. postcss-selector-parser preserves any
    // leading whitespace inside the comma-separated inner selectors (e.g.
    // `:deep(.a, .b)` keeps the space before `.b`), which surfaces as
    // `:global( .b)` — the leading space is harmless to CSS Modules.
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+:global\(\s*\.a\s*\)/);
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+:global\(\s*\.b\s*\)/);
    expect(out).not.toContain(':deep');
    expect(out).not.toContain(`.a${SCOPE_ATTR}`);
    expect(out).not.toContain(`.b${SCOPE_ATTR}`);
  });

  it(':deep(:not(.x)) — the WHOLE deep payload lives inside :global, :not stays unwrapped', () => {
    const out = scopeCss(':deep(:not(.x)) { color: red; }', HASH);
    // The :not(...) is preserved inside the :global() wrap; neither the
    // outer compound nor :not's inner get the scope attr.
    expect(out).toContain(':global(:not(.x))');
    expect(out).not.toContain(SCOPE_ATTR);
    expect(out).not.toContain(':deep');
  });

  it('plain rules unaffected — non-:deep selectors still get the scope attr without :global', () => {
    const out = scopeCss(
      '.plain { color: blue; } .outer :deep(.inner) { color: red; }',
      HASH,
    );
    expect(out).toMatch(/\.plain\[data-rozie-s-abc123\]/);
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+:global\(\.inner\)/);
    // The plain rule's `.plain` is NOT wrapped in :global — only deep-lifted
    // compounds opt out of CSS Modules hashing.
    expect(out).not.toContain(':global(.plain)');
  });

  it('does not crash on a malformed :deep without args', () => {
    // postcss-selector-parser is forgiving; this should round-trip.
    // We don't promise specific behavior — only "no crash".
    expect(() => scopeCss(':deep { color: red; }', HASH)).not.toThrow();
  });
});

/**
 * Phase 17 Plan 03 (SPEC-R1 non-Lit arm / SPEC-R4a) — `::part(name)` consumer
 * rules are a CROSS-SHADOW mechanism that only has meaning on Lit. On React
 * (and Solid/Svelte) they must be DROPPED in `scopeCss` — not scope-mangled
 * into a `[data-rozie-s-<hash>]` selector that would leak broken/global CSS.
 * The drop is INDEPENDENT of the `:deep` code path (SPEC-R5 byte-identity).
 */
describe('scopeCss — ::part() cross-shadow no-op strip (SPEC-R4a)', () => {
  it('drops a `<child>::part(body)` rule entirely — no ::part, no scope-attr leakage', () => {
    const out = scopeCss('rozie-part-card::part(body) { color: red; }', HASH);
    expect(out).not.toContain('::part');
    // The dropped rule must NOT survive scope-mangled.
    expect(out).not.toContain(`rozie-part-card${SCOPE_ATTR}`);
    expect(out).not.toContain('color: red');
  });

  it('drops ONLY the ::part rule — a co-present ordinary rule still gets scoped', () => {
    const out = scopeCss(
      'rozie-part-card::part(body) { color: red; }\n.card-body { padding: 1rem; }',
      HASH,
    );
    // ::part rule gone.
    expect(out).not.toContain('::part');
    expect(out).not.toContain('color: red');
    // Ordinary co-present rule survives, scoped as usual.
    expect(out).toMatch(/\.card-body\[data-rozie-s-abc123\]/);
    expect(out).toContain('padding: 1rem');
  });

  it(':deep regression guard — a sibling :deep rule still lowers to :global, ::part rule gone', () => {
    const out = scopeCss(
      '.outer :deep(.inner) { color: red; }\nrozie-part-card::part(body) { color: blue; }',
      HASH,
    );
    // :deep lowering unchanged (SPEC-R5).
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+:global\(\.inner\)/);
    // ::part rule dropped.
    expect(out).not.toContain('::part');
    expect(out).not.toContain('color: blue');
  });

  it('does not throw on a ::part rule (no diagnostic surfaced from the strip)', () => {
    expect(() => scopeCss('rozie-part-card::part(body) { color: red; }', HASH)).not.toThrow();
  });
});
