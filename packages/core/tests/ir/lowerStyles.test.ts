// lowerStyles — StyleAST → StyleSection partition tests (Spike 004).
// Implementation: packages/core/src/ir/lowerers/lowerStyles.ts
import { describe, expect, it } from 'vitest';
import { parseStyle } from '../../src/parsers/parseStyle.js';
import { lowerStyles } from '../../src/ir/lowerers/lowerStyles.js';

function lower(css: string) {
  const { node, diagnostics } = parseStyle(css, { start: 0, end: css.length }, css);
  expect(diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  return lowerStyles(node!);
}

describe('lowerStyles (Spike 004 — portalRules bucket)', () => {
  it('partitions a @portal block into portalRules, not scopedRules', () => {
    const css = '.box { color: red; }\n@portal item {\n  ul { margin: 0; }\n  li { padding: 0; }\n}';
    const section = lower(css);
    expect(section.portalRules.length).toBe(1);
    expect(section.scopedRules.length).toBe(1);
    expect(section.rootRules.length).toBe(0);
  });

  it('preserves portalName + children on the lowered portal rule', () => {
    const css = '@portal item {\n  ul { margin: 0; }\n  li { padding: 0; }\n}';
    const section = lower(css);
    const portalRule = section.portalRules[0] as {
      kind: string;
      portalName: string;
      children: { selector: string }[];
    };
    expect(portalRule.kind).toBe('portal-block');
    expect(portalRule.portalName).toBe('item');
    expect(portalRule.children.map(c => c.selector)).toEqual(['ul', 'li']);
  });

  it('a :root rule still routes to rootRules, plain rules to scopedRules', () => {
    const css = ':root { --x: 1; }\n.box { color: red; }\n@portal item { ul {} }';
    const section = lower(css);
    expect(section.rootRules.length).toBe(1);
    expect(section.scopedRules.length).toBe(1);
    expect(section.portalRules.length).toBe(1);
  });

  it('a @portal-free StyleAST yields an empty portalRules bucket', () => {
    const css = '.box { color: red; }';
    const section = lower(css);
    expect(section.portalRules).toEqual([]);
  });
});
