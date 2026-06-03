/**
 * scopeCss `:deep()` recognition tests (quick task 260526-mk4) +
 * bare-unwrap of React deep-lifted output (Phase 25 — was `:global()`, 260526-no7).
 *
 * Verifies that the React target's scope-rewrite pass:
 *   1. Hoists the inner selector of `:deep(...)` into the parent selector as a
 *      BARE selector (NO `:global(...)` wrap — Phase 25 emits plain `.css`, not
 *      CSS Modules, where `:global(...)` is dead syntax that drops the rule).
 *      Solid/Svelte/Lit each have their own mechanism, Angular uses `::ng-deep`,
 *      Vue byte-slices `:deep()` verbatim.
 *   2. Skips the scope-attr suffix (`[data-rozie-s-<hash>]`) on the lifted
 *      bare selector.
 *   3. Distributes `:deep(a, b)` by cloning the parent selector once per
 *      inner branch (matches Vue 3.4+ scoped-CSS semantics).
 */
import { describe, expect, it } from 'vitest';
import { scopeCss } from '../scopeCss.js';

const HASH = 'abc123';
const SCOPE_ATTR = `[data-rozie-s-${HASH}]`;

describe('scopeCss — :deep() cross-component escape hatch', () => {
  it(':deep(.x) — inner unwrapped to bare `.x`, NO :global, NO scope attr anywhere', () => {
    const out = scopeCss(':deep(.x) { color: red; }', HASH);
    expect(out).toMatch(/\.x\s*\{/);
    expect(out).not.toContain(':global');
    expect(out).not.toContain(':deep');
    expect(out).not.toContain(SCOPE_ATTR);
  });

  it('.outer :deep(.inner) — outer scoped, inner bare (plain descendant selector)', () => {
    const out = scopeCss('.outer :deep(.inner) { color: red; }', HASH);
    expect(out).toContain(`.outer${SCOPE_ATTR}`);
    expect(out).not.toContain(':global');
    expect(out).not.toContain(`.inner${SCOPE_ATTR}`);
    expect(out).not.toContain(':deep');
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.inner/);
  });

  it('.outer > :deep(.a > .b) — combinator inside :deep spliced in as a bare child selector', () => {
    const out = scopeCss('.outer > :deep(.a > .b) { color: red; }', HASH);
    expect(out).toContain(`.outer${SCOPE_ATTR}`);
    // The child combinator inside the :deep payload becomes a real CSS child
    // combinator: `.outer[scope] > .a > .b`. Neither lifted compound is scoped.
    expect(out).toMatch(
      /\.outer\[data-rozie-s-abc123\]\s*>\s*\.a\s*>\s*\.b/,
    );
    expect(out).not.toContain(':global');
    expect(out).not.toContain(`.a${SCOPE_ATTR}`);
    expect(out).not.toContain(`.b${SCOPE_ATTR}`);
    expect(out).not.toContain(':deep');
  });

  it('.outer :deep(.a, .b) — distributes across the comma-separated list, each branch bare', () => {
    const out = scopeCss('.outer :deep(.a, .b) { color: red; }', HASH);
    // Should produce two selectors: `.outer[scope] .a` and `.outer[scope] .b`.
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.a/);
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.b/);
    expect(out).not.toContain(':global');
    expect(out).not.toContain(':deep');
    expect(out).not.toContain(`.a${SCOPE_ATTR}`);
    expect(out).not.toContain(`.b${SCOPE_ATTR}`);
  });

  it(':deep(:not(.x)) — the whole deep payload unwrapped bare, :not stays unscoped', () => {
    const out = scopeCss(':deep(:not(.x)) { color: red; }', HASH);
    // The :not(...) is spliced in bare; neither the outer compound nor :not's
    // inner get the scope attr.
    expect(out).toContain(':not(.x)');
    expect(out).not.toContain(':global');
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
    expect(out).not.toContain(':global');
    // The plain rule's `.plain` IS scoped; the deep-lifted `.inner` is NOT.
    expect(out).not.toContain(`.inner${SCOPE_ATTR}`);
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

  it(':deep regression guard — a sibling :deep rule still lowers bare, ::part rule gone', () => {
    const out = scopeCss(
      '.outer :deep(.inner) { color: red; }\nrozie-part-card::part(body) { color: blue; }',
      HASH,
    );
    // :deep lowers to a bare descendant selector (Phase 25 — no :global).
    expect(out).toMatch(/\.outer\[data-rozie-s-abc123\]\s+\.inner/);
    expect(out).not.toContain(':global');
    // ::part rule dropped.
    expect(out).not.toContain('::part');
    expect(out).not.toContain('color: blue');
  });

  it('does not throw on a ::part rule (no diagnostic surfaced from the strip)', () => {
    expect(() => scopeCss('rozie-part-card::part(body) { color: red; }', HASH)).not.toThrow();
  });
});
