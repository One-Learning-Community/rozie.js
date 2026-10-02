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

  // Release-0.8.0 audit B6: a model prop's `<kebab-prop>-change` event (what
  // the controllable property dispatches) is part of the typed event map, typed
  // with the prop's own TS type, even when <emits> declares nothing else.
  it('model props contribute their <prop>-change events to the event map', () => {
    const source = `<rozie name="ModelEvents">
<props>
{
  open: { type: Boolean, default: false, model: true },
  pageSize: { type: Number, default: 10, model: true },
}
</props>
<emits>
{}
</emits>
<template>
<div>{{ $props.open }}</div>
</template>
</rozie>`;
    const { ast } = parse(source, { filename: 'ModelEvents.rozie' });
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    const code = emitLit(ir!, { filename: 'ModelEvents.rozie', source }).code;
    expect(code).toContain(
      "export interface RozieModelEventsEventMap extends Omit<HTMLElementEventMap, 'open-change' | 'page-size-change'> {\n" +
        "  'open-change': CustomEvent<boolean>;\n" +
        "  'page-size-change': CustomEvent<number>;\n" +
        '}',
    );
    // ...and the names match what the controllable properties dispatch.
    expect(code).toContain("eventName: 'open-change'");
    expect(code).toContain("eventName: 'page-size-change'");
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
