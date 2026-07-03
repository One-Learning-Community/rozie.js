// Quick task 260703-12j — RED-first regression test for scoped `@media` /
// `@supports` / `@container` at-rule survival.
//
// Bug: `parseStyle`'s top-level `root.walkRules` pass descends INTO a
// top-level conditional-group at-rule (postcss's `walkRules` recurses by
// design) and collects each INNER selector rule as a bare, unconditional
// scoped rule — silently dropping the `@media (...) { ... }` wrapper and
// hoisting a conditional guard to unconditional. This is an a11y regression
// for `packages/ui/dialog/src/Dialog.rozie`'s
// `@media (prefers-reduced-motion: no-preference)` guard: after the bug, its
// enter animations run unconditionally.
//
// This file asserts, at the AST/IR level (target-agnostic, tightest gate) AND
// at the emit level (React's postcss `scopeCss` descent path + Vue's native
// `<style scoped>` byte-slice path), that the wrapper survives and inner
// selectors are scoped inside it. It also asserts ROZ082 (`@portal` nested
// inside `@media`) is unaffected by the fix.
//
// Task 1 is RED-first: every assertion below except the ROZ082 guard MUST
// FAIL until Task 2 lands the shared parseStyle/lowerStyles fix.
import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { compile } from '../compile.js';
import type { StyleRule } from '../ast/blocks/StyleAST.js';
import { emitStyle as emitReactStyle } from '../../../targets/react/src/emit/emitStyle.js';
import { computeScopeHash } from '../../../targets/react/src/emit/scopeHash.js';
import { emitStyle as emitVueStyle } from '../../../targets/vue/src/emit/emitStyle.js';

/** Wrap a `<style>` body in a minimal valid component (template-only, no script). */
function withStyle(name: string, styleBody: string, templateBody = '<div class="box"></div>'): string {
  return `<rozie name="${name}">

<template>
${templateBody}
</template>

<style>
${styleBody}
</style>

</rozie>`;
}

/**
 * Locate the FULL text of the first at-rule in `css` whose prelude starts
 * with `atRuleName` (e.g. `@media`), by counting braces to find the matching
 * close — avoids fragile greedy/non-greedy regex over nested braces.
 */
function extractAtRuleBlock(css: string, atRuleName: string): string | null {
  const startIdx = css.indexOf(atRuleName);
  if (startIdx === -1) return null;
  const openBraceIdx = css.indexOf('{', startIdx);
  if (openBraceIdx === -1) return null;
  let depth = 0;
  for (let i = openBraceIdx; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(startIdx, i + 1);
    }
  }
  return null;
}

function loadInline(name: string, styleBody: string, templateBody?: string) {
  const src = withStyle(name, styleBody, templateBody);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return { ir: lowered.ir, src };
}

describe('scopedAtRule — AST/IR level (parse + lowerToIR)', () => {
  it('a top-level scoped @media survives as ONE scoped rule whose slice includes "@media"', () => {
    const { ir, src } = loadInline(
      'AtRuleSurvival',
      '.box { color: #111; }\n@media (prefers-color-scheme: dark) {\n.box { color: #eee; }\n}',
    );
    const scopedRules = ir.styles.scopedRules as StyleRule[];
    const slices = scopedRules.map((r) => src.slice(r.loc.start, r.loc.end));

    expect(
      slices.some((s) => s.includes('@media') && s.includes('.box') && s.includes('#eee')),
    ).toBe(true);
  });

  it('the inner dark .box rule is NOT also collected as a separate unconditional scoped rule', () => {
    const { ir, src } = loadInline(
      'AtRuleSurvivalNoHoist',
      '.box { color: #111; }\n@media (prefers-color-scheme: dark) {\n.box { color: #eee; }\n}',
    );
    const scopedRules = ir.styles.scopedRules as StyleRule[];
    const slices = scopedRules.map((r) => src.slice(r.loc.start, r.loc.end).trim());

    // Before the fix, the hoisted inner rule's OWN slice is exactly this text
    // (no @media wrapper). After the fix it must not appear as a bare entry.
    expect(slices).not.toContain('.box { color: #eee; }');
  });

  it('nested at-rules (@supports > @media) are preserved verbatim as ONE scoped rule', () => {
    const { ir, src } = loadInline(
      'AtRuleNesting',
      '@supports (display: grid) {\n@media (min-width: 40rem) {\n.grid { display: grid; }\n}\n}',
      '<div class="grid"></div>',
    );
    const scopedRules = ir.styles.scopedRules as StyleRule[];
    const slices = scopedRules.map((r) => src.slice(r.loc.start, r.loc.end));
    const supportsSlices = slices.filter((s) => s.includes('@supports'));

    expect(supportsSlices.length).toBe(1);
    expect(supportsSlices[0]).toContain('@media');
    expect(supportsSlices[0]).toContain('.grid');
  });
});

describe('scopedAtRule — emit level (React scopeCss descent + Vue native byte-slice)', () => {
  it('React: emitted moduleCss wraps the scoped inner selector INSIDE @media', () => {
    const { ir, src } = loadInline(
      'AtRuleReact',
      '.box { color: #111; }\n@media (prefers-color-scheme: dark) {\n.box { color: #eee; }\n}',
    );
    const scopeHash = computeScopeHash('AtRuleReact', 'AtRuleReact.rozie');
    const result = emitReactStyle(ir.styles, src, scopeHash);

    const mediaBlock = extractAtRuleBlock(result.moduleCss, '@media (prefers-color-scheme: dark)');
    expect(mediaBlock).not.toBeNull();
    expect(mediaBlock).toContain(`.box[data-rozie-s-${scopeHash}]`);
  });

  it('Vue: emitted scoped CSS keeps the inner selector INSIDE the native @media block', () => {
    const { ir, src } = loadInline(
      'AtRuleVue',
      '.box { color: #111; }\n@media (prefers-color-scheme: dark) {\n.box { color: #eee; }\n}',
    );
    const result = emitVueStyle(ir.styles, src);

    const mediaBlock = extractAtRuleBlock(result.scoped, '@media (prefers-color-scheme: dark)');
    expect(mediaBlock).not.toBeNull();
    // Vue's emitStyle does no postcss rewrite of its own (native <style scoped>
    // scoping happens downstream at the actual SFC compile step) — the raw
    // inner `.box` selector must still be present, INSIDE the wrapper.
    expect(mediaBlock).toContain('.box');
  });
});

describe('scopedAtRule — ROZ082 guard unchanged (@portal nested inside @media)', () => {
  it('still fires ROZ082 for @media { @portal item { ul {} } }', () => {
    const src = withStyle(
      'AtRulePortalGuard',
      '@media (min-width: 600px) {\n  @portal item {\n    ul { margin: 0; }\n  }\n}',
    );
    const result = compile(src, { target: 'vue', filename: 'AtRulePortalGuard.rozie' });
    const roz082 = result.diagnostics.filter((d) => d.code === 'ROZ082');
    expect(roz082.length).toBe(1);
  });
});
