/**
 * Quick 260930-814 — Lit union-aware `@property` attribute converter.
 *
 * Pre-fix bug: `renderType()` picked a union prop's `@property({ type })`
 * token from the union's FIRST member only, so the author-side member order
 * decided the HTML-attribute conversion on Lit:
 *   - `[Number, String]` → `type: Number` → `'auto'` became `NaN`;
 *   - `[String, Number]` → `type: String` → `'600'` never became a number;
 *   - `[Object, String]` → `type: Object` → `JSON.parse('auto')` threw → `null`;
 *   - model `[Number, String]` → coerce `Number(value)` → `'auto'` became `NaN`;
 *   - model `[Boolean, String]` → coerce `value !== null` → any string became `true`.
 *
 * Fix: one ORDER-INDEPENDENT classifier (`classifyUnionAttr`) keyed on the
 * union's member SET, shared by the model and non-model paths. Every corpus
 * union shape that was already correct is pinned byte-identical below.
 *
 * Every assertion is anchored to the prop's OWN `@property(...)` line so one
 * prop cannot satisfy another prop's assertion.
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';
import { rozieNumberOrStringAttr } from '../../../../runtime/lit/src/rozieNumberOrStringAttr.js';

function compile(source: string): string {
  const { ast } = parse(source, { filename: 'UnionProbe.rozie' });
  if (!ast) throw new Error('parse failed');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lower failed');
  const { code } = emitLit(ir, { filename: 'UnionProbe.rozie', source });
  return code;
}

function component(propsBody: string): string {
  return `<rozie name="UnionProbe">
<props>
{
${propsBody}
}
</props>
<template><div>x</div></template>
</rozie>`;
}

/** The single `@property(...)` line declaring `field` (a prop name or `_x_attr`). */
function propertyLine(code: string, field: string): string {
  const re = new RegExp(`@property\\(.*\\) ${field}[!?:]`);
  const lines = code.split('\n').filter((l) => re.test(l));
  expect(lines, `exactly one @property line for ${field}`).toHaveLength(1);
  return lines[0]!.trim();
}

/** The single `attributeChangedCallback` dispatch line for `attr`. */
function attrCallbackLine(code: string, attr: string): string {
  const lines = code
    .split('\n')
    .filter((l) => l.includes(`if (name === '${attr}')`) && l.includes('notifyAttributeChange'));
  expect(lines, `exactly one attributeChangedCallback line for ${attr}`).toHaveLength(1);
  return lines[0]!.trim();
}

function runtimeImportLine(code: string): string {
  return code.split('\n').find((l) => l.includes("from '@rozie/runtime-lit'")) ?? '';
}

const NUMBER_STRING_DECORATOR = '@property({ converter: { fromAttribute: rozieNumberOrStringAttr } })';
const BOOLEAN_STRING_CONVERTER =
  "{ fromAttribute: (v: string | null) => (v === null ? false : v === 'true' ? true : v === 'false' ? false : v === '' ? true : v) }";

describe('260930-814 — non-model Number+String union (either order)', () => {
  const code = compile(
    component(`  a: { type: [Number, String], default: 480 },
  b: { type: [String, Number], default: 480 },`),
  );

  it('[Number, String] emits the rozieNumberOrStringAttr converter', () => {
    const line = propertyLine(code, 'a');
    expect(line).toBe(`${NUMBER_STRING_DECORATOR} a: number | string = 480;`);
    expect(line).not.toContain('type: Number');
    expect(line).not.toContain('type: String');
  });

  it('[String, Number] emits the same converter (member order means nothing)', () => {
    const line = propertyLine(code, 'b');
    expect(line).toBe(`${NUMBER_STRING_DECORATOR} b: string | number = 480;`);
    expect(line).not.toContain('type: Number');
    expect(line).not.toContain('type: String');
  });

  it('the @rozie/runtime-lit import names rozieNumberOrStringAttr', () => {
    expect(runtimeImportLine(code)).toMatch(/\brozieNumberOrStringAttr\b/);
  });

  it('end-to-end: the emitted converter symbol maps attribute strings correctly', () => {
    const symbol = /fromAttribute: (\w+) \}/.exec(propertyLine(code, 'a'))![1];
    expect(symbol).toBe(rozieNumberOrStringAttr.name);
    expect(rozieNumberOrStringAttr('auto')).toBe('auto');
    expect(rozieNumberOrStringAttr('600')).toBe(600);
  });
});

describe('260930-814 — control: no Number+String union, no new import', () => {
  it('a Number/String-only component emits no rozieNumberOrStringAttr anywhere', () => {
    const code = compile(
      component(`  n: { type: Number, default: 1 },
  s: { type: String, default: 'x' },
  m: { type: Number, default: 0, model: true },`),
    );
    expect(code).not.toContain('rozieNumberOrStringAttr');
    expect(propertyLine(code, 'n')).toBe('@property({ type: Number, reflect: true }) n: number = 1;');
    expect(propertyLine(code, 's')).toBe("@property({ type: String, reflect: true }) s: string = 'x';");
  });
});

describe('260930-814 — model props share the classifier', () => {
  const code = compile(
    component(`  d: { type: [Number, String], default: 0, model: true },
  e: { type: [Boolean, String], default: false, model: true },`),
  );

  it('model [Number, String] converts the attribute mirror and the coerce', () => {
    expect(propertyLine(code, '_d_attr')).toBe(
      "@property({ converter: { fromAttribute: rozieNumberOrStringAttr }, attribute: 'd' }) _d_attr: number | string = 0;",
    );
    const cb = attrCallbackLine(code, 'd');
    expect(cb).toContain('notifyAttributeChange(value === null ? 0 : rozieNumberOrStringAttr(value))');
    expect(cb).not.toContain('Number(value)');
    expect(runtimeImportLine(code)).toMatch(/\brozieNumberOrStringAttr\b/);
  });

  it('model [Boolean, String] uses the non-model Boolean/String semantics', () => {
    expect(propertyLine(code, '_e_attr')).toBe(
      `@property({ converter: ${BOOLEAN_STRING_CONVERTER}, attribute: 'e' }) _e_attr: boolean | string = false;`,
    );
    const cb = attrCallbackLine(code, 'e');
    expect(cb).toContain(
      "notifyAttributeChange(value === null ? false : value === 'true' ? true : value === 'false' ? false : value === '' ? true : value)",
    );
    expect(cb).not.toContain('value !== null');
  });

  it('model [String, Number] converts identically to [Number, String]', () => {
    const c2 = compile(component(`  d: { type: [String, Number], default: 0, model: true },`));
    expect(propertyLine(c2, '_d_attr')).toBe(
      "@property({ converter: { fromAttribute: rozieNumberOrStringAttr }, attribute: 'd' }) _d_attr: string | number = 0;",
    );
    expect(attrCallbackLine(c2, 'd')).toContain('rozieNumberOrStringAttr(value)');
  });
});

describe('260930-814 — String + complex members read the attribute as a string in any order', () => {
  const code = compile(
    component(`  c: { type: [Object, String], default: 'x' },
  j: { type: [Function, String], default: 'k' },`),
  );

  it('[Object, String] emits type: String', () => {
    expect(propertyLine(code, 'c')).toBe("@property({ type: String }) c: any | string = 'x';");
  });

  it('[Function, String] emits type: String', () => {
    expect(propertyLine(code, 'j')).toBe(
      "@property({ type: String }) j: (((...args: any[]) => any) | null) | string = 'k';",
    );
  });

  it('emits no rozieNumberOrStringAttr', () => {
    expect(code).not.toContain('rozieNumberOrStringAttr');
  });
});

describe('260930-814 — byte-identity pins for every unchanged corpus union shape', () => {
  const code = compile(
    component(`  g: { type: [Boolean, String], default: false },
  f: { type: [Element, Object], default: null },
  h: { type: [String, Function], default: 'k' },
  i: { type: [String, Array, Object, Function], default: '' },
  expanded: { type: [Object, Boolean], default: () => ({}), model: true },
  value: { type: [String, Object], default: '', model: true },`),
  );

  it('non-model [Boolean, String] keeps the full inline converter line', () => {
    expect(propertyLine(code, 'g')).toBe(
      `@property({ converter: ${BOOLEAN_STRING_CONVERTER} }) g: boolean | string = false;`,
    );
  });

  it('[Element, Object] stays type: Object', () => {
    expect(propertyLine(code, 'f')).toBe('@property({ type: Object }) f: Element | any = null;');
  });

  it('[String, Function] stays type: String', () => {
    expect(propertyLine(code, 'h')).toBe(
      "@property({ type: String }) h: string | (((...args: any[]) => any) | null) = 'k';",
    );
  });

  it('[String, Array, Object, Function] stays type: String', () => {
    expect(propertyLine(code, 'i')).toBe(
      "@property({ type: String }) i: string | any[] | any | (((...args: any[]) => any) | null) = '';",
    );
  });

  it('model [Object, Boolean] stays type: Object + cast coerce', () => {
    expect(propertyLine(code, '_expanded_attr')).toBe(
      "@property({ type: Object, attribute: 'expanded' }) _expanded_attr: any | boolean = {};",
    );
    expect(attrCallbackLine(code, 'expanded')).toBe(
      "if (name === 'expanded') this._expandedControllable.notifyAttributeChange(value as unknown as any | boolean);",
    );
  });

  it('model [String, Object] stays type: String + cast coerce', () => {
    expect(propertyLine(code, '_value_attr')).toBe(
      "@property({ type: String, attribute: 'value' }) _value_attr: string | any = '';",
    );
    expect(attrCallbackLine(code, 'value')).toBe(
      "if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as string | any);",
    );
  });

  it('none of these shapes pulls in rozieNumberOrStringAttr', () => {
    expect(code).not.toContain('rozieNumberOrStringAttr');
  });
});
