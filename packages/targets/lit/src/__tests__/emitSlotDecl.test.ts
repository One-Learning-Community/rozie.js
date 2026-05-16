/**
 * emitSlotDecl unit tests — Plan 06.4-02 Task 2.
 *
 * Verifies per-slot emission per D-LIT-14 (queryAssignedElements correction):
 *   - `@state() private _hasSlot<X> = false` presence boolean
 *   - `@queryAssignedElements({ slot: 'X', flatten: true })` query field
 *   - slotchange wiring spliced into firstUpdated
 *   - default slot omits the `slot:` filter
 *   - NO @queryAssignedNodes — that variant returns whitespace text-nodes and
 *     produces false-positive presence detection.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';
import { emitSlotDecl } from '../emit/emitSlotDecl.js';
import { LitDecoratorImportCollector } from '../rewrite/collectLitImports.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compile(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitLit(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
}

describe('emitSlotDecl — D-LIT-14 correction', () => {
  it('emits @queryAssignedElements (never @queryAssignedNodes) for named slots', () => {
    const code = compile('Modal');
    expect(code).toContain('@queryAssignedElements');
    expect(code).not.toMatch(/@queryAssignedNodes\s*\(/);
  });

  it("emits `{ slot: 'name', flatten: true }` decorator opts for named slots", () => {
    const code = compile('Modal');
    expect(code).toContain("@queryAssignedElements({ slot: 'header', flatten: true })");
    expect(code).toContain("@queryAssignedElements({ slot: 'footer', flatten: true })");
  });

  it('default slot omits the `slot:` filter — only `{ flatten: true }`', () => {
    const code = compile('Modal');
    expect(code).toContain('@queryAssignedElements({ flatten: true })');
  });

  it('emits @state() private _hasSlot<X> = false for each slot', () => {
    const code = compile('Modal');
    expect(code).toContain('@state() private _hasSlotHeader = false');
    expect(code).toContain('@state() private _hasSlotDefault = false');
    expect(code).toContain('@state() private _hasSlotFooter = false');
  });

  it('slotchange wiring updates _hasSlot<X> from _slot<X>Elements.length', () => {
    const code = compile('Modal');
    expect(code).toContain(
      "this._hasSlotHeader = this._slotHeaderElements.length > 0",
    );
    expect(code).toContain("slotEl.addEventListener('slotchange', update)");
  });

  it('scoped slot data-typed params emit ctxInterfaces above the class', () => {
    const code = compile('TodoList');
    expect(code).toMatch(/interface RozieHeaderSlotCtx/);
    expect(code).toMatch(/interface RozieDefaultSlotCtx/);
  });

  it('emitSlotDecl() unit: empty slots array returns empty result', () => {
    const result = emitSlotDecl(
      {
        type: 'IRComponent',
        name: 'X',
        props: [],
        state: [],
        computed: [],
        refs: [],
        slots: [],
        emits: [],
        lifecycle: [],
        watchers: [],
        listeners: [],
        setupBody: { type: 'SetupBody', scriptProgram: null as never, annotations: [] },
        template: null,
        styles: { type: 'StyleSection', scopedRules: [], rootRules: [], sourceLoc: { start: 0, end: 0 } },
        components: [],
        sourceLoc: { start: 0, end: 0 },
      },
      { decorators: new LitDecoratorImportCollector() },
    );
    expect(result.fields).toBe('');
    expect(result.ctxInterfaces).toEqual([]);
    expect(result.slotChangeWiring).toBe('');
  });
});
