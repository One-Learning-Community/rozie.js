// Phase 10 — `<style lang="scss">` SCSS preprocessing tests (Plan 10-03).
// Implementation: packages/core/src/parsers/parseStyle.ts (SCSS pre-pass).
//
// Covers the Wave-0 SCSS cases from 10-PATTERNS.md §"Wave-0 Test Gap":
// happy-path SCSS compile, :root+@portal routing post-SCSS, ROZ085 (missing
// sass — loadSass mocked null), ROZ086 (invalid SCSS — collected, loc in
// block), ROZ087 (unrecognized lang — both hint branches), and a
// plain-CSS-unregressed assertion.
//
// Self-contained: SCSS/CSS bodies are inline source strings — these tests do
// NOT depend on the Plan 10-04 PortalListStyledScss fixture.
import { describe, expect, it, vi } from 'vitest';
import { parseStyle } from '../../src/parsers/parseStyle.js';

describe('parseStyle — <style lang="scss"> SCSS pre-pass (Phase 10)', () => {
  it('happy path: nesting + $variable + @mixin/@include + & parent-ref compiles to plain CSS', () => {
    const scss = [
      '$brand: #3366ff;',
      '@mixin pad { padding: 0.5rem; }',
      '.card {',
      '  color: $brand;',
      '  @include pad;',
      '  .title { font-weight: bold; }',
      '  &:hover { color: red; }',
      '}',
    ].join('\n');
    const { node, diagnostics } = parseStyle(
      scss,
      { start: 0, end: scss.length },
      scss,
      undefined,
      'scss',
    );
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    // The CSS handed downstream contains only plain CSS — no SCSS tokens.
    expect(node!.cssText).not.toContain('$');
    expect(node!.cssText).not.toContain('@mixin');
    expect(node!.cssText).not.toContain('@include');
    // `&:hover` is flattened to `.card:hover` — no bare `&` survives.
    expect(node!.cssText).not.toContain('&');
    // Compiled selectors: nesting flattened, mixin expanded into `.card`.
    const selectors = node!.rules.map(r => r.selector);
    expect(selectors).toContain('.card');
    expect(selectors).toContain('.card .title');
    expect(selectors).toContain('.card:hover');
    // The compiled `.card` rule carries the resolved variable, not `$brand`.
    expect(node!.cssText).toContain('#3366ff');
    expect(node!.lang).toBe('scss');
  });

  it('routing: a :root rule and an @portal block inside SCSS route identically to plain CSS', () => {
    const scss = [
      '$gap: 1rem;',
      ':root { --rozie-gap: 8px; }',
      '@portal item {',
      '  ul { list-style: none; }',
      '  li { padding: $gap; }',
      '}',
    ].join('\n');
    const { node, diagnostics } = parseStyle(
      scss,
      { start: 0, end: scss.length },
      scss,
      undefined,
      'scss',
    );
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    // :root escape-hatch flagged exactly as a plain-CSS :root rule would be.
    const escapeRules = node!.rules.filter(r => r.isRootEscape);
    expect(escapeRules.length).toBe(1);
    expect(escapeRules[0]!.selector).toBe(':root');
    // @portal block collected as a portal-block rule with its inner children.
    const portalBlocks = node!.rules.filter(r => r.kind === 'portal-block');
    expect(portalBlocks.length).toBe(1);
    expect(portalBlocks[0]!.portalName).toBe('item');
    expect(portalBlocks[0]!.children!.map(c => c.selector)).toEqual(['ul', 'li']);
  });

  it('ROZ086: invalid SCSS yields one collected error diagnostic, never thrown, loc inside the block', () => {
    const scss = '.broken { color: ; @include nonexistent-mixin; }';
    const contentLoc = { start: 100, end: 100 + scss.length };
    let threw = false;
    let result: ReturnType<typeof parseStyle> | undefined;
    try {
      result = parseStyle(scss, contentLoc, scss, undefined, 'scss');
    } catch {
      threw = true;
    }
    // D-08: collected-not-thrown — parseStyle must never propagate the exception.
    expect(threw).toBe(false);
    expect(result).toBeDefined();
    const { node, diagnostics } = result!;
    expect(node).toBeNull();
    const roz086 = diagnostics.filter(d => d.code === 'ROZ086');
    expect(roz086.length).toBe(1);
    expect(roz086[0]!.severity).toBe('error');
    // SPEC-REQ-5: the loc start falls within the <style> block content span.
    expect(roz086[0]!.loc.start).toBeGreaterThanOrEqual(contentLoc.start);
    expect(roz086[0]!.loc.start).toBeLessThanOrEqual(contentLoc.end);
  });

  it('ROZ087: a non-scss/non-css lang ("stylus") fires one error diagnostic with node null', () => {
    const css = '.a { color: red; }';
    const { node, diagnostics } = parseStyle(
      css,
      { start: 0, end: css.length },
      css,
      undefined,
      'stylus',
    );
    expect(node).toBeNull();
    const roz087 = diagnostics.filter(d => d.code === 'ROZ087');
    expect(roz087.length).toBe(1);
    expect(roz087[0]!.severity).toBe('error');
    expect(roz087[0]!.message).toContain('stylus');
  });

  it('ROZ087: lang="less" carries the Less-aware deferral hint', () => {
    const css = '.a { color: red; }';
    const { node, diagnostics } = parseStyle(
      css,
      { start: 0, end: css.length },
      css,
      undefined,
      'less',
    );
    expect(node).toBeNull();
    const roz087 = diagnostics.filter(d => d.code === 'ROZ087');
    expect(roz087.length).toBe(1);
    expect(roz087[0]!.severity).toBe('error');
    // The Less branch hint names "less" and points to scss / plain CSS.
    expect((roz087[0]!.hint ?? '').toLowerCase()).toContain('less');
    expect(roz087[0]!.hint).toMatch(/scss|plain CSS/i);
  });

  it('ROZ087: case-insensitive + trimmed — "  SCSS  " is recognized, not ROZ087', () => {
    const scss = '.a { .b { color: red; } }';
    const { node, diagnostics } = parseStyle(
      scss,
      { start: 0, end: scss.length },
      scss,
      undefined,
      '  SCSS  ',
    );
    expect(diagnostics.some(d => d.code === 'ROZ087')).toBe(false);
    expect(node).not.toBeNull();
    expect(node!.rules.map(r => r.selector)).toContain('.a .b');
  });

  // WR-01 (34-REVIEW) — pin the SCSS engine-rule byte-slice behavior. NOTE the
  // load-bearing subtlety: SCSS *nesting* `:root { .cm-editor { ... } }` does
  // NOT reach the engine-DOM escape hatch — dart-sass flattens it to a
  // DESCENDANT combinator `:root .cm-editor { ... }` BEFORE postcss.parse runs,
  // which `isPureRootSelector` correctly rejects (it is a single multi-token
  // selector, not pure `:root`). So a SCSS author must write the engine block
  // with an EXPLICIT bare-:root rule (no nesting) to opt in. This test pins
  // BOTH facts: (a) SCSS nesting flattens to a scoped rule (no root-block), and
  // (b) the rule's `loc` indexes the COMPILED CSS (cssText), NOT opts.source —
  // the pre-existing SCSS byte-slice limitation the emitters inherit (slicing
  // from opts.source for an SCSS block yields a mis-aligned slice; the WR-01
  // follow-up is to slice from cssText for SCSS). Regression anchor for both.
  it('WR-01: SCSS nesting `:root { .sel {} }` flattens to a scoped `:root .sel` rule (NOT a root-block); loc indexes compiled CSS', () => {
    const scss = [
      '$accent: #4f46e5;',
      ':root {',
      '  .cm-editor {',
      '    color: $accent;',
      '  }',
      '}',
    ].join('\n');
    const { node, diagnostics } = parseStyle(
      scss,
      { start: 0, end: scss.length },
      scss,
      undefined,
      'scss',
    );
    expect(diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    // dart-sass flattened the nesting to `:root .cm-editor` — a scoped rule,
    // NOT a root-block engine escape hatch.
    expect(node!.rules.some(r => r.kind === 'root-block')).toBe(false);
    const flattened = node!.rules.find(r => r.selector === ':root .cm-editor');
    expect(flattened).toBeDefined();
    expect(flattened!.isRootEscape).toBe(false);
    // The rule loc indexes the COMPILED CSS (cssText), which carries the
    // resolved `#4f46e5` (not `$accent`). Slicing cssText at the loc recovers
    // the compiled rule; slicing the raw SCSS `source` at the same offsets
    // would be mis-aligned (the WR-01 limitation).
    const compiledSlice = node!.cssText.slice(flattened!.loc.start, flattened!.loc.end);
    expect(compiledSlice).toContain('.cm-editor');
    expect(compiledSlice).toContain('#4f46e5');
    expect(compiledSlice).not.toContain('$accent');
  });

  it('plain-CSS unregressed: lang="css" parses byte-identically to a plain <style>', () => {
    const css = '.counter { color: red; }\nbutton:disabled { opacity: 0.5; }';
    const plain = parseStyle(css, { start: 0, end: css.length }, css);
    const tagged = parseStyle(css, { start: 0, end: css.length }, css, undefined, 'css');
    expect(plain.diagnostics).toEqual([]);
    expect(tagged.diagnostics).toEqual([]);
    // cssText is the raw body verbatim for the plain-CSS path.
    expect(plain.node!.cssText).toBe(css);
    expect(tagged.node!.cssText).toBe(css);
    // Per-rule nodeLoc offsets are precise (unchanged).
    expect(plain.node!.rules.map(r => ({ s: r.selector, loc: r.loc }))).toEqual(
      tagged.node!.rules.map(r => ({ s: r.selector, loc: r.loc })),
    );
    const counter = plain.node!.rules.find(r => r.selector === '.counter')!;
    expect(css.slice(counter.loc.start, counter.loc.start + 8)).toBe('.counter');
  });

  it('plain-CSS unregressed: no lang argument leaves cssText raw and lang absent', () => {
    const css = '.x { color: blue; }';
    const { node, diagnostics } = parseStyle(css, { start: 0, end: css.length }, css);
    expect(diagnostics).toEqual([]);
    expect(node!.cssText).toBe(css);
    expect(node!.lang).toBeUndefined();
  });
});

// ROZ085 — `sass` not installed. The resolveSass module is mocked so loadSass()
// returns null, simulating the optional peer being absent.
describe('parseStyle — ROZ085 (sass not installed)', () => {
  it('emits exactly one ROZ085 error and returns node null when loadSass is null', async () => {
    vi.resetModules();
    vi.doMock('../../src/parsers/resolveSass.js', () => ({
      loadSass: () => null,
    }));
    const { parseStyle: parseStyleMocked } = await import('../../src/parsers/parseStyle.js');
    const scss = '.a { .b { color: red; } }';
    const { node, diagnostics } = parseStyleMocked(
      scss,
      { start: 0, end: scss.length },
      scss,
      undefined,
      'scss',
    );
    expect(node).toBeNull();
    const roz085 = diagnostics.filter(d => d.code === 'ROZ085');
    expect(roz085.length).toBe(1);
    expect(roz085[0]!.severity).toBe('error');
    // The message names the sass package; the hint gives an install command.
    expect(roz085[0]!.message.toLowerCase()).toContain('sass');
    expect((roz085[0]!.hint ?? '').toLowerCase()).toContain('install');
    vi.doUnmock('../../src/parsers/resolveSass.js');
    vi.resetModules();
  });
});
