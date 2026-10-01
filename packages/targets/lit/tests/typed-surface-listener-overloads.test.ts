// Typed public surface P1 (Lit) — the typed `addEventListener` /
// `removeEventListener` overloads are the ONE runtime-visible addition the
// typed surface is allowed (global constraints). This pins that (a) their
// implementations are a verbatim `super` pass-through of all three arguments
// (behaviour-identical to the inherited method), and (b) a component without
// `<emits>` gains neither the overloads nor the event map (byte-identity).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { parse } from '../../../core/src/parse.js';
import { emitLit } from '../src/emitLit.js';

const EXAMPLES = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../examples');

function compileExample(name: string): string {
  const source = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return emitLit(ir!, { filename: `${name}.rozie`, source }).code;
}

describe('Lit typed listener overloads (typed-surface P1)', () => {
  it('TypedEvents: implementations are a verbatim super pass-through', () => {
    const code = compileExample('TypedEvents');
    expect(code).toContain(
      '  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {\n' +
        '    super.addEventListener(type, listener, options);\n' +
        '  }',
    );
    expect(code).toContain(
      '  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {\n' +
        '    super.removeEventListener(type, listener, options);\n' +
        '  }',
    );
    // Exactly one implementation each (the rest are body-less overloads).
    expect(code.match(/super\.addEventListener\(/g)).toHaveLength(1);
    expect(code.match(/super\.removeEventListener\(/g)).toHaveLength(1);
    expect(code).toContain(
      "export interface RozieTypedEventsEventMap extends Omit<HTMLElementEventMap, 'ping' | 'reset' | 'select' | 'row-open'> {",
    );
  });

  it('a component without <emits> gains neither the overloads nor an event map', () => {
    for (const name of ['Counter', 'Dropdown', 'Modal']) {
      const code = compileExample(name);
      expect(code).not.toMatch(/^\s+(add|remove)EventListener[<(]/m);
      expect(code).not.toContain('EventMap');
      expect(code).not.toContain('super.addEventListener');
    }
  });
});
