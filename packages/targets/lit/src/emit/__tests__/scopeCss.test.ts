/**
 * scopeCss `:deep()` recognition tests (quick task 260526-mk4).
 *
 * Lit target — mirrors the React/Solid/Svelte per-target tests. See
 * packages/targets/react/src/emit/__tests__/scopeCss.test.ts for the
 * shared design rationale.
 *
 * Lit-specific caveat: lifting the scope attribute works WITHIN one
 * shadow root but does NOT cross shadow-DOM boundaries. Cross-shadow
 * styling is `::part()` territory, out of scope for this task. The
 * compiler-side rewrite is the same; consumers targeting Lit should be
 * aware of the runtime boundary. See docs/guide/features.md.
 */
import { describe, expect, it } from 'vitest';
import { scopeCss } from '../scopeCss.js';

const HASH = 'abc123';
const SCOPE_ATTR = `[data-rozie-s-${HASH}]`;

describe('scopeCss (lit) — :deep() cross-component escape hatch', () => {
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

  it(':host and ::slotted rules remain exempt from scoping', () => {
    // Lit shadow-DOM exemption stays — :deep() interacts only with the
    // (rare) selectors that pass through the scope walker.
    const out = scopeCss(':host { color: red; } ::slotted(.x) { color: blue; }', HASH);
    expect(out).not.toContain(SCOPE_ATTR);
    expect(out).toContain(':host');
    expect(out).toContain('::slotted(.x)');
  });

  it('does not crash on a malformed :deep without args', () => {
    expect(() => scopeCss(':deep { color: red; }', HASH)).not.toThrow();
  });
});

describe('scopeCss (lit) — ::part() cross-shadow styling bridge (Phase 17)', () => {
  it('child::part(body) — scope attr BEFORE ::part; part name literal/un-hashed', () => {
    const out = scopeCss('rozie-part-card::part(body) { color: red; }', HASH);
    // Scope attr lands BETWEEN the child-tag compound and ::part (SPEC-R2).
    expect(out).toMatch(/rozie-part-card\[data-rozie-s-abc123\]::part\(body\)/);
    // The child-tag compound KEEPS its scope attr (cross-shadow match key).
    expect(out).toContain(`rozie-part-card${SCOPE_ATTR}`);
    // Part name `body` is literal: NO hash inside/after the part name (SPEC-R6).
    expect(out).not.toMatch(/::part\(body\[data-rozie-s/);
    expect(out).not.toMatch(/::part\(body\)\[data-rozie-s/);
    expect(out).not.toMatch(/body\[data-rozie-s-abc123\]/);
    // ::part pseudo survives verbatim (it is NOT stripped like :deep).
    expect(out).toContain('::part(body)');
  });

  it('.wrap child::part(body) — both compounds scoped, ::part literal at tail', () => {
    const out = scopeCss('.wrap rozie-part-card::part(body) { color: red; }', HASH);
    expect(out).toMatch(
      /\.wrap\[data-rozie-s-abc123\]\s+rozie-part-card\[data-rozie-s-abc123\]::part\(body\)/,
    );
    // Part name still literal — no hash on `body`.
    expect(out).not.toMatch(/body\[data-rozie-s-abc123\]/);
  });

  it('::part name carries no adjacent scope hash (SPEC-R6 literal name)', () => {
    const out = scopeCss('rozie-part-card::part(body) { color: red; }', HASH);
    // The only `[data-rozie-s-...]` occurrence must be on the child-tag compound,
    // not inside the part-name pseudo.
    const occurrences = out.match(/\[data-rozie-s-abc123\]/g) ?? [];
    expect(occurrences.length).toBe(1);
    expect(out).toMatch(/rozie-part-card\[data-rozie-s-abc123\]::part\(body\)/);
  });

  it('::part is NOT routed through whole-rule shadow exemption (keeps scope attr)', () => {
    // Pitfall 2: if ::part went through selectorIsShadowExempt, the child-tag
    // compound would lose its scope attr and match every child instance.
    const out = scopeCss('rozie-part-card::part(body) { color: red; }', HASH);
    expect(out).toContain(SCOPE_ATTR);
    expect(out).not.toMatch(/^rozie-part-card::part\(body\)/);
  });

  it(':deep() regression — ::part branch does NOT perturb :deep output (SPEC-R5)', () => {
    // Byte-identical guard: this is the exact assertion shape from the :deep
    // suite above; it must keep holding after the ::part branch lands.
    const out = scopeCss('.board :deep(.inner) { color: red; }', HASH);
    expect(out).toContain(`.board${SCOPE_ATTR}`);
    expect(out).toContain('.inner');
    expect(out).not.toContain(`.inner${SCOPE_ATTR}`);
    expect(out).not.toContain(':deep');
    expect(out).not.toContain('::part');
    expect(out).toMatch(/\.board\[data-rozie-s-abc123\]\s+\.inner/);
  });
});
