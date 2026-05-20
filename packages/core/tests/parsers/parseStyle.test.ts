// PARSE-06 — <style> block parser tests.
// Implementation: packages/core/src/parsers/parseStyle.ts (Plan 03 Task 4).
// Anchors paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { splitBlocks } from '../../src/splitter/splitBlocks.js';
import { parseStyle } from '../../src/parsers/parseStyle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

function loadStyle(name: string) {
  const source = readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
  const blocks = splitBlocks(source, `${name}.rozie`);
  if (!blocks.style) throw new Error(`${name}.rozie has no <style> block`);
  return { source, content: blocks.style.content, contentLoc: blocks.style.contentLoc };
}

describe('parseStyle (PARSE-06)', () => {
  it('Counter.rozie style has 5 rules and zero :root escapes', () => {
    const { source, content, contentLoc } = loadStyle('Counter');
    const { node, diagnostics } = parseStyle(content, contentLoc, source, 'Counter.rozie');
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    expect(node!.rules.length).toBe(5);
    for (const r of node!.rules) {
      expect(r.isRootEscape).toBe(false);
    }
    const selectors = node!.rules.map(r => r.selector);
    expect(selectors).toEqual([
      '.counter',
      '.counter.hovering',
      '.value',
      'button',
      'button:disabled',
    ]);
  });

  it('Dropdown.rozie style flags :root rule with isRootEscape: true', () => {
    const { source, content, contentLoc } = loadStyle('Dropdown');
    const { node, diagnostics } = parseStyle(content, contentLoc, source, 'Dropdown.rozie');
    expect(diagnostics).toEqual([]);
    expect(node!.rules.length).toBe(3);
    const escapeRules = node!.rules.filter(r => r.isRootEscape);
    expect(escapeRules.length).toBe(1);
    expect(escapeRules[0]!.selector).toBe(':root');
    // Byte-accurate loc: the slice at rule.loc.start in the source begins with ':root'.
    expect(source.slice(escapeRules[0]!.loc.start, escapeRules[0]!.loc.start + 5)).toBe(':root');
  });

  it('Modal.rozie style flags :root rule with isRootEscape: true', () => {
    const { source, content, contentLoc } = loadStyle('Modal');
    const { node, diagnostics } = parseStyle(content, contentLoc, source, 'Modal.rozie');
    expect(diagnostics).toEqual([]);
    const escapeRules = node!.rules.filter(r => r.isRootEscape);
    expect(escapeRules.length).toBe(1);
    expect(escapeRules[0]!.selector).toBe(':root');
  });

  it('byte-accurate loc threading — Counter.rozie .counter rule starts at correct absolute offset', () => {
    const { source, content, contentLoc } = loadStyle('Counter');
    const { node } = parseStyle(content, contentLoc, source, 'Counter.rozie');
    const counterRule = node!.rules.find(r => r.selector === '.counter')!;
    // The slice at the rule's absolute start should begin with '.counter'.
    expect(source.slice(counterRule.loc.start, counterRule.loc.start + 8)).toBe('.counter');
    expect(counterRule.loc.start).toBeGreaterThanOrEqual(contentLoc.start);
    expect(counterRule.loc.end).toBeLessThanOrEqual(contentLoc.end);
  });

  it('mixed :root selector "(:root, .other)" emits ROZ081 and is NOT flagged as escape', () => {
    const synthetic = ':root, .other { color: red; }';
    const { node, diagnostics } = parseStyle(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics.some(d => d.code === 'ROZ081')).toBe(true);
    expect(node!.rules.length).toBe(1);
    expect(node!.rules[0]!.isRootEscape).toBe(false);
  });

  it('emits ROZ080 on PostCSS parse error', () => {
    const synthetic = '.foo { unbalanced';
    const { diagnostics } = parseStyle(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics.some(d => d.code === 'ROZ080')).toBe(true);
  });

  it('does NOT throw on hostile input — D-08 collected-not-thrown', () => {
    const synthetic = '!@#$%^&*();;;';
    let threw = false;
    try {
      parseStyle(synthetic, { start: 0, end: synthetic.length }, synthetic);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it('preserves cssText verbatim for downstream Phase 2 consumption', () => {
    const { source, content, contentLoc } = loadStyle('Counter');
    const { node } = parseStyle(content, contentLoc, source, 'Counter.rozie');
    expect(node!.cssText).toBe(content);
  });

  it('preserves selector text verbatim including pseudo-classes (button:disabled)', () => {
    const { source, content, contentLoc } = loadStyle('Counter');
    const { node } = parseStyle(content, contentLoc, source, 'Counter.rozie');
    const sel = node!.rules.map(r => r.selector);
    expect(sel).toContain('button:disabled');
  });
});

describe('parseStyle — @portal blocks (Spike 004)', () => {
  it('recognizes `@portal item { ul {} li {} }` as a portal-block rule with 2 children', () => {
    const css = '@portal item {\n  ul { list-style: none; }\n  li { padding: 0.5rem; }\n}';
    const { node, diagnostics } = parseStyle(css, { start: 0, end: css.length }, css);
    expect(diagnostics).toEqual([]);
    const portalBlocks = node!.rules.filter(r => r.kind === 'portal-block');
    expect(portalBlocks.length).toBe(1);
    expect(portalBlocks[0]!.portalName).toBe('item');
    expect(portalBlocks[0]!.children!.length).toBe(2);
    expect(portalBlocks[0]!.children!.map(c => c.selector)).toEqual(['ul', 'li']);
    // The @portal inner rules must NOT also appear as top-level scoped rules.
    const plainRules = node!.rules.filter(r => r.kind !== 'portal-block');
    expect(plainRules.length).toBe(0);
  });

  it('a plain rule alongside a @portal block lands as a plain rule, not double-collected', () => {
    const css = '.box { color: red; }\n@portal item {\n  ul { margin: 0; }\n}';
    const { node, diagnostics } = parseStyle(css, { start: 0, end: css.length }, css);
    expect(diagnostics).toEqual([]);
    const plain = node!.rules.filter(r => r.kind !== 'portal-block');
    const portal = node!.rules.filter(r => r.kind === 'portal-block');
    expect(plain.length).toBe(1);
    expect(plain[0]!.selector).toBe('.box');
    expect(portal.length).toBe(1);
    expect(portal[0]!.children!.length).toBe(1);
  });

  it('portal-block child loc byte-slices to the inner selector verbatim', () => {
    const css = '@portal item {\n  ul { list-style: none; }\n}';
    const { node } = parseStyle(css, { start: 0, end: css.length }, css);
    const child = node!.rules.find(r => r.kind === 'portal-block')!.children![0]!;
    expect(css.slice(child.loc.start, child.loc.start + 2)).toBe('ul');
  });

  it('emits ROZ082 when @portal is nested inside @media', () => {
    const css = '@media (min-width: 600px) {\n  @portal x {\n    ul { margin: 0; }\n  }\n}';
    const { node, diagnostics } = parseStyle(css, { start: 0, end: css.length }, css);
    expect(diagnostics.some(d => d.code === 'ROZ082')).toBe(true);
    // The invalid @portal must not be collected as a portal-block rule.
    expect(node!.rules.some(r => r.kind === 'portal-block')).toBe(false);
  });

  it('allows @media nested INSIDE @portal (valid direction — no ROZ082)', () => {
    const css = '@portal item {\n  @media (min-width: 600px) {\n    ul { margin: 0; }\n  }\n}';
    const { node, diagnostics } = parseStyle(css, { start: 0, end: css.length }, css);
    expect(diagnostics.some(d => d.code === 'ROZ082')).toBe(false);
    const portal = node!.rules.find(r => r.kind === 'portal-block')!;
    expect(portal.portalName).toBe('item');
    // walkRules descends into the nested @media, so `ul` is collected.
    expect(portal.children!.map(c => c.selector)).toEqual(['ul']);
  });

  it('emits ROZ084 on an empty-params @portal block', () => {
    const css = '@portal {\n  ul { margin: 0; }\n}';
    const { node, diagnostics } = parseStyle(css, { start: 0, end: css.length }, css);
    expect(diagnostics.some(d => d.code === 'ROZ084')).toBe(true);
    expect(node!.rules.some(r => r.kind === 'portal-block')).toBe(false);
  });

  it('does NOT register or emit ROZ083 (out of scope — no :style string-literal parser)', () => {
    const css = '@portal item { ul { margin: 0; } }';
    const { diagnostics } = parseStyle(css, { start: 0, end: css.length }, css);
    expect(diagnostics.some(d => d.code === 'ROZ083')).toBe(false);
  });
});
