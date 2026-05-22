// Quick task 260521-oao Task 1 — lowerProps `required` field + ROZ014 diagnostic.
// Implementation: packages/core/src/ir/lowerers/lowerProps.ts.
import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../../src/diagnostics/Diagnostic.js';
import type { PropsAST } from '../../src/ast/blocks/PropsAST.js';
import { parseProps } from '../../src/parsers/parseProps.js';
import { collectPropDecls } from '../../src/semantic/collectors/collectPropDecls.js';
import { createEmptyBindings } from '../../src/semantic/bindings.js';
import { lowerProps } from '../../src/ir/lowerers/lowerProps.js';

function lower(propsObjectLiteral: string): {
  props: ReturnType<typeof lowerProps>;
  diagnostics: Diagnostic[];
} {
  const { node, diagnostics: parseDiagnostics } = parseProps(
    propsObjectLiteral,
    { start: 0, end: propsObjectLiteral.length },
    propsObjectLiteral,
  );
  expect(parseDiagnostics).toEqual([]);
  const bindings = createEmptyBindings();
  collectPropDecls(node as PropsAST, bindings);
  const diagnostics: Diagnostic[] = [];
  const props = lowerProps(node as PropsAST, bindings, diagnostics);
  return { props, diagnostics };
}

describe('lowerProps — required field (260521-oao)', () => {
  it('sets required === true for `{ type: T, required: true }`', () => {
    const { props, diagnostics } = lower('{ item: { type: Object, required: true } }');
    expect(props).toHaveLength(1);
    expect(props[0]!.required).toBe(true);
    expect(props[0]!.defaultValue).toBeNull();
    expect(diagnostics).toEqual([]);
  });

  it('sets required === false when no `required:` key is present', () => {
    const { props } = lower('{ item: { type: String } }');
    expect(props[0]!.required).toBe(false);
  });

  it('sets required === false for `required: false`', () => {
    const { props } = lower('{ item: { type: String, required: false } }');
    expect(props[0]!.required).toBe(false);
  });

  it('sets required === false for a non-boolean `required:` value (e.g. `required: 0`)', () => {
    const { props } = lower('{ item: { type: String, required: 0 } }');
    expect(props[0]!.required).toBe(false);
  });

  it('drops the default and emits exactly one ROZ014 warning for `required: true` + `default:`', () => {
    const { props, diagnostics } = lower('{ count: { type: Number, default: 5, required: true } }');
    expect(props[0]!.required).toBe(true);
    expect(props[0]!.defaultValue).toBeNull();
    const roz014 = diagnostics.filter((d) => d.code === 'ROZ014');
    expect(roz014).toHaveLength(1);
    expect(roz014[0]!.severity).toBe('warning');
  });

  it('preserves the default and emits no ROZ014 for `{ default: 5 }` with no `required:`', () => {
    const { props, diagnostics } = lower('{ count: { type: Number, default: 5 } }');
    expect(props[0]!.required).toBe(false);
    expect(props[0]!.defaultValue).not.toBeNull();
    expect(diagnostics.filter((d) => d.code === 'ROZ014')).toHaveLength(0);
  });
});
