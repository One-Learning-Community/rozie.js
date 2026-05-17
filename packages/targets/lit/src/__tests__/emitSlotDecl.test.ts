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

/**
 * Phase 07.3.1 Plan 05 — D-LIT-15: light-DOM pre-seed of `_hasSlot<X>`.
 *
 * The producer must inspect `this.children` inside `connectedCallback()`
 * BEFORE `super.connectedCallback();` runs so the very first render sees
 * accurate slot-fill presence. Without this, conditionally-rendered slot
 * wrappers (`${this._hasSlotHeader ? html\`<header><slot name="header">…</slot></header>\` : nothing}`)
 * deadlock: no wrapper → no `<slot>` element → no `slotchange` event →
 * `_hasSlotHeader` permanently false → wrapper stays hidden forever.
 */
describe('pre-seed lines (Phase 07.3.1 D-LIT-15)', () => {
  function makeIRWithSlots(
    slotDefs: Array<{ name: string; params?: Array<{ name: string }> }>,
  ) {
    return {
      type: 'IRComponent' as const,
      name: 'X',
      props: [],
      state: [],
      computed: [],
      refs: [],
      slots: slotDefs.map((s) => ({
        type: 'SlotDecl' as const,
        name: s.name,
        params: s.params ?? [],
        // SlotPresence baseline; tests don't depend on this field.
        presence: 'always' as const,
        defaultContent: null,
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
      })),
      emits: [],
      lifecycle: [],
      watchers: [],
      listeners: [],
      setupBody: {
        type: 'SetupBody' as const,
        scriptProgram: null as never,
        annotations: [],
      },
      template: null,
      styles: {
        type: 'StyleSection' as const,
        scopedRules: [],
        rootRules: [],
        sourceLoc: { start: 0, end: 0 },
      },
      components: [],
      sourceLoc: { start: 0, end: 0 },
    };
  }

  it('emits pre-seed line for each named slot with getAttribute check', () => {
    const result = emitSlotDecl(
      makeIRWithSlots([{ name: 'header' }, { name: 'footer' }]),
      { decorators: new LitDecoratorImportCollector() },
    );
    expect(result.preSeedLines).toContain(
      'this._hasSlotHeader = Array.from(this.children).some',
    );
    expect(result.preSeedLines).toContain("el.getAttribute('slot') === 'header'");
    expect(result.preSeedLines).toContain(
      'this._hasSlotFooter = Array.from(this.children).some',
    );
    expect(result.preSeedLines).toContain("el.getAttribute('slot') === 'footer'");
    // Pre-seed lines for two slots — joined by newline + 4-space indent so
    // they align with the connectedCallback() body in the emitter shell.
    expect(result.preSeedLines.split('\n').length).toBe(2);
  });

  it('emits pre-seed line for default slot with text-node tolerance', () => {
    const result = emitSlotDecl(makeIRWithSlots([{ name: '' }]), {
      decorators: new LitDecoratorImportCollector(),
    });
    expect(result.preSeedLines).toContain(
      'this._hasSlotDefault = Array.from(this.children).some',
    );
    // Default-slot fill check: child must NOT have a `slot` attribute…
    expect(result.preSeedLines).toContain("!el.hasAttribute('slot')");
    // …and must be either non-text OR a text node with non-whitespace content
    // (Web Components spec: whitespace-only text doesn't count as a fill).
    expect(result.preSeedLines).toContain('el.nodeType !== 3');
    expect(result.preSeedLines).toContain('el.textContent?.trim().length');
  });

  it('returns empty preSeedLines when ir.slots is empty', () => {
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
    expect(result.preSeedLines).toBe('');
  });

  it('mixed named + default slots produce ordered pre-seed lines per slot', () => {
    const result = emitSlotDecl(
      makeIRWithSlots([{ name: 'header' }, { name: '' }, { name: 'footer' }]),
      { decorators: new LitDecoratorImportCollector() },
    );
    // Three pre-seed lines, in IR slot order: header, default, footer.
    const lines = result.preSeedLines.split('\n').map((l) => l.trim());
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('_hasSlotHeader');
    expect(lines[0]).toContain("'header'");
    expect(lines[1]).toContain('_hasSlotDefault');
    expect(lines[1]).toContain("!el.hasAttribute('slot')");
    expect(lines[2]).toContain('_hasSlotFooter');
    expect(lines[2]).toContain("'footer'");
  });

  it('Modal fixture: pre-seed lines emitted inside connectedCallback BEFORE super.connectedCallback()', () => {
    const code = compile('Modal');
    // Pre-seed lines present for all three Modal slots.
    expect(code).toContain(
      'this._hasSlotHeader = Array.from(this.children).some',
    );
    expect(code).toContain(
      'this._hasSlotDefault = Array.from(this.children).some',
    );
    expect(code).toContain(
      'this._hasSlotFooter = Array.from(this.children).some',
    );

    // Ordering invariant: every pre-seed line must appear BEFORE
    // `super.connectedCallback();` inside the same `connectedCallback()`
    // method body. We slice the emitted module from `connectedCallback(): void {`
    // to the next `}` line and assert pre-seed before super in that slice.
    const ccMatch = code.match(/connectedCallback\(\): void \{[\s\S]*?\n  \}/);
    expect(ccMatch).not.toBeNull();
    const ccBody = ccMatch![0];
    const preSeedIdx = ccBody.indexOf('Array.from(this.children).some');
    const superIdx = ccBody.indexOf('super.connectedCallback();');
    expect(preSeedIdx).toBeGreaterThanOrEqual(0);
    expect(superIdx).toBeGreaterThan(preSeedIdx);

    // Provenance comment is emitted alongside the pre-seed lines.
    expect(ccBody).toContain('Phase 07.3.1 D-LIT-15');
  });
});
