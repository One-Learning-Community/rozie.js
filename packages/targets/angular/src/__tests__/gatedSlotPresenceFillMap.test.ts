/**
 * Phase 80 Plan 14 (D-10) — the source-level half of the SECOND incomplete-
 * widening proof.
 *
 * Plan 10 (D-09) widened the OUTLET resolution chain in
 * `emitSlotInvocation.ts` — the chain that supplies the `TemplateRef` once a
 * wrapper element has already decided to render. It did NOT widen the
 * STRUCTURAL PRESENCE check that decides whether the wrapper renders AT ALL.
 * That check is built by `buildSlotsMerge` (rewriteTemplateExpression.ts),
 * `buildScriptSlotsMerge` (rewriteScript.ts), and `buildListenerSlotsMerge`
 * (rewriteListenerExpression.ts) — three near-verbatim two-tier copies, none
 * of which reference `__rozieFillMap` (D-10). A producer that gates its
 * wrapper element on `$slots.foo` (Modal's `<header r-if="$props.title ||
 * $slots.header">`, Table's `<tfoot r-if="$slots.footerSummary ||
 * $slots.footerPagination">`) therefore never renders the wrapper for a
 * consumer's dynamic `#[expr]` fill — the fill has nowhere to land, even
 * though the outlet CHAIN inside the wrapper is already three tiers wide.
 *
 * `tests/angular-runtime/fixtures/ProducerGatedStaticSlots.rozie` is the
 * missing producer shape: identifier-named static slots (so the record-only
 * predicate is false for every one of them, exactly like
 * ProducerIdentifierOnly.rozie) wrapped in structural presence gates — one
 * prop-OR-slot shape (Modal), one slot-OR-slot shape (Table, no prop
 * operand). This is precisely why Plans 09-13 went fully green (their fixture
 * has NO structural gate) while the two real-world Docker VR cells stayed
 * red.
 *
 * These assertions describe the DESIRED post-fix state and are expected to
 * FAIL against the unmodified (pre-Plan-14) emitter — this is the whole
 * point of the plan (SPEC R7's fail-first contract, extended to D-10 by this
 * plan). Do NOT "fix" this file by loosening or removing an assertion; the
 * fix lands in `buildSlotsMerge.ts` (new, Task 2).
 *
 * Ambient ROOT-relative fixture read pattern per staticSlotProducerFillMap.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';
import { parseExpression, parse as babelParse } from '@babel/parser';
import _generate from '@babel/generator';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';
import { rewriteListenerExpression } from '../rewrite/rewriteListenerExpression.js';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';

const generate = (typeof _generate === 'function'
  ? _generate
  : (_generate as unknown as { default: typeof _generate }).default) as typeof _generate;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compileAngular(src: string, filename: string): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitAngular(ir, { filename, source: src });
  return code;
}

/** The real fixture Task 1's two gated-consumer fixtures target. */
function compileGatedProducer(): string {
  const filename = 'ProducerGatedStaticSlots.rozie';
  const src = readFileSync(
    resolve(ROOT, `tests/angular-runtime/fixtures/${filename}`),
    'utf8',
  );
  return compileAngular(src, filename);
}

const sloc = { start: 0, end: 0 } as unknown as SlotDecl['sourceLoc'];

function makeSlot(name: string): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params: [],
    presence: 'conditional',
    nestedSlots: [],
    sourceLoc: sloc,
  };
}

function makeIR(slots: SlotDecl[]): IRComponent {
  return {
    name: 'TestComp',
    props: [],
    state: [],
    refs: [],
    computed: [],
    methods: [],
    lifecycle: {},
    slots,
    events: [],
    template: { type: 'TemplateFragment', children: [] },
    styles: [],
    components: [],
    listenersBlock: { listeners: [] },
    emits: [],
  } as unknown as IRComponent;
}

describe('Angular producer — structural slot-presence gate must resolve through the same three tiers as the outlet chain (Plan 14 RED, D-10)', () => {
  it("DESIRED POST-FIX: the prop-OR-slot gate (Modal shape) carries the fill-map tier for 'header'", () => {
    const code = compileGatedProducer();
    expect(code).toContain(
      "@if (title() || (headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])) {",
    );
  });

  it("DESIRED POST-FIX: the slot-OR-slot gate (Table shape, no prop operand) carries the fill-map tier for BOTH 'footerSummary' and 'footerPagination'", () => {
    const code = compileGatedProducer();
    expect(code).toContain(
      "@if ((footerSummaryTpl ?? __rozieFillMap()['footerSummary'] ?? templates()?.['footerSummary']) || (footerPaginationTpl ?? __rozieFillMap()['footerPagination'] ?? templates()?.['footerPagination'])) {",
    );
  });

  it("cross-chain agreement: the structural gate's fill-map term for 'header' is IDENTICAL text to the outlet chain's fill-map term for 'header' — pinned by comparison, not by a duplicated literal", () => {
    const code = compileGatedProducer();
    const gateMatch = code.match(
      /@if \(title\(\) \|\| \((headerTpl \?\? __rozieFillMap\(\)\['header'\] \?\? templates\(\)\?\.\['header'\])\)\) \{/,
    );
    const outletMatch = code.match(
      /\*ngTemplateOutlet="(\(headerTpl \?\? __rozieFillMap\(\)\['header'\] \?\? templates\(\)\?\.\['header'\]\))/,
    );
    expect(gateMatch).not.toBeNull();
    expect(outletMatch).not.toBeNull();
    // The gate's parenthesized chain and the outlet's parenthesized chain
    // must be the SAME text — this is what makes the two paths impossible
    // to widen independently again.
    expect(gateMatch![1]).toBe(outletMatch![1]);
  });

  it('template-context unit: rewriteTemplateExpression lowers $slots.header (single slot) to the three-tier chain', () => {
    const ir = makeIR([makeSlot('header')]);
    const expr = parseExpression('$slots.header');
    const out = rewriteTemplateExpression(expr, ir);
    expect(out).toBe("(headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])");
  });

  it('template-context unit: the optional-member branch ($slots?.header) produces the SAME three-tier chain as the plain member branch', () => {
    const ir = makeIR([makeSlot('header')]);
    const exprPlain = parseExpression('$slots.header');
    const exprOptional = parseExpression('$slots?.header');
    const outPlain = rewriteTemplateExpression(exprPlain, ir);
    const outOptional = rewriteTemplateExpression(exprOptional, ir);
    expect(outOptional).toBe(outPlain);
  });

  it('template-context unit: prefixThis: true (class-body getter context) produces the class-scoped three-tier chain', () => {
    const ir = makeIR([makeSlot('header')]);
    const expr = parseExpression('$slots.header');
    const out = rewriteTemplateExpression(expr, ir, { prefixThis: true });
    expect(out).toBe(
      "(this.headerTpl ?? this.__rozieFillMap()['header'] ?? this.templates()?.['header'])",
    );
  });

  it('script-context unit: rewriteRozieIdentifiers lowers $slots.header (in an `if` guard) to the class-scoped three-tier chain', () => {
    const ir = makeIR([makeSlot('header')]);
    const program = babelParse('if ($slots.header) { foo(); }', {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    const { rewrittenProgram } = rewriteRozieIdentifiers(program, ir);
    const out = generate(rewrittenProgram, { retainLines: false, compact: false }).code;
    expect(out).toContain(
      "(this.headerTpl ?? this.__rozieFillMap()['header'] ?? this.templates()?.['header'])",
    );
  });

  it('listener-context unit: rewriteListenerExpression lowers $slots.header to the class-scoped three-tier chain', () => {
    const ir = makeIR([makeSlot('header')]);
    const expr = parseExpression('$slots.header');
    const out = rewriteListenerExpression(expr, ir);
    expect(out).toBe(
      "(this.headerTpl ?? this.__rozieFillMap()['header'] ?? this.templates()?.['header'])",
    );
  });
});
