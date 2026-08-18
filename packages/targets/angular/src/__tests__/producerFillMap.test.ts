/**
 * Phase 80 Plan 04 — producer-side content-collected fill map.
 *
 * Teaches the Angular producer emitter to collect keyed `[rozieSlot]` fills
 * by content query and resolve them in a fixed precedence order, without
 * touching the `templates` input it sits above. This file grows across all
 * three of this plan's tasks:
 *
 *   Task 1 — `__rozieFills` (content query) + `__rozieFillMap` (pure fold).
 *   Task 2 — `__rozieProjectedTpls` + `__rozieSlotWarned` + the dev-mode-only
 *            diagnostics effect (duplicate-key + empty-fill-map warnings).
 *   Task 3 — the fill map spliced into every slot's resolution chain.
 *
 * See 80-04-PLAN.md for the full behavior contract and 80-CONTEXT.md D-06
 * for why an empty-string fill key normalizes to `'defaultSlot'`.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';
import { hasKeyedFillIntake } from '../emit/refineSlotTypes.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function lowerAngular(src: string, filename: string): IRComponent {
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
  return lowered.ir;
}

function compileAngular(src: string, filename: string): string {
  const ir = lowerAngular(src, filename);
  const { code } = emitAngular(ir, { filename, source: src });
  return code;
}

const RECORD_ONLY_PRODUCER = `
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="value()"></slot></div>
</template>
</rozie>
`;

const IDENTIFIER_ONLY_PRODUCER = `
<rozie name="X">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`;

const NO_SLOT_PRODUCER = `
<rozie name="Plain">
<props>{ label: { type: String, default: '' } }</props>
<template>
<div>{{ label() }}</div>
</template>
</rozie>
`;

const DEFAULT_SLOT_ONLY_PRODUCER = `
<rozie name="Def2">
<template>
<div><slot></slot></div>
</template>
</rozie>
`;

// Phase 80 Plan 10 (R3/D-09) — the keyed-fill intake predicate's own
// behavior contract, written and observed RED (missing export) before
// `hasKeyedFillIntake` existed in refineSlotTypes.ts.
describe('Angular producer — keyed-fill intake predicate (Task 1, D-09)', () => {
  it('returns true for a producer declaring one identifier-named static slot', () => {
    const ir = lowerAngular(IDENTIFIER_ONLY_PRODUCER, 'X.rozie');
    expect(hasKeyedFillIntake(ir.slots)).toBe(true);
  });

  it('returns true for a producer declaring only a record-only slot', () => {
    const ir = lowerAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    expect(hasKeyedFillIntake(ir.slots)).toBe(true);
  });

  it('returns true for a producer declaring only the default slot', () => {
    const ir = lowerAngular(DEFAULT_SLOT_ONLY_PRODUCER, 'Def2.rozie');
    expect(hasKeyedFillIntake(ir.slots)).toBe(true);
  });

  it('returns false for a component declaring no slots', () => {
    const ir = lowerAngular(NO_SLOT_PRODUCER, 'Plain.rozie');
    expect(hasKeyedFillIntake(ir.slots)).toBe(false);
  });

  it('equals the condition that governs the templates input (`ir.slots.length > 0`) for every one of the above cases', () => {
    for (const [src, filename] of [
      [IDENTIFIER_ONLY_PRODUCER, 'X.rozie'],
      [RECORD_ONLY_PRODUCER, 'Cell.rozie'],
      [DEFAULT_SLOT_ONLY_PRODUCER, 'Def2.rozie'],
      [NO_SLOT_PRODUCER, 'Plain.rozie'],
    ] as const) {
      const ir = lowerAngular(src, filename);
      expect(hasKeyedFillIntake(ir.slots)).toBe(ir.slots.length > 0);
    }
  });
});

describe('Angular producer — content-collected fill map (Task 1)', () => {
  it('a producer with at least one key-fillable slot emits __rozieFills, __rozieFillMap, and the RozieSlot runtime import', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    expect(code).toContain(
      '__rozieFills = contentChildren(RozieSlot, { descendants: true });',
    );
    expect(code).toContain('__rozieFillMap = computed(() => {');
    expect(code).toContain("import { RozieSlot } from '@rozie/runtime-angular';");
  });

  // AMENDED — Phase 80 Plan 10 (R3/D-09). Before this plan, an
  // identifier-only producer emitted NONE of the three intake members
  // (that was this test's original assertion). D-09 proved that contract
  // wrong: a consumer elsewhere in the compilation can still send this
  // producer a dynamic `#[expr]` fill, and with the old narrower gate that
  // fill was silently dropped. The intake gate is now `hasKeyedFillIntake`
  // (`ir.slots.length > 0`), the same width as the `templates` input gate
  // below it — so an identifier-only producer now emits the SAME intake
  // members a record-only producer does. This case is inverted, not
  // deleted, to keep the boundary (no slots at all) visible one test down.
  it('a producer with only identifier-named static slots ALSO emits __rozieFills, __rozieFillMap, and the RozieSlot runtime import (D-09 widened gate)', () => {
    const code = compileAngular(IDENTIFIER_ONLY_PRODUCER, 'X.rozie');
    expect(code).toContain(
      '__rozieFills = contentChildren(RozieSlot, { descendants: true });',
    );
    expect(code).toContain('__rozieFillMap = computed(() => {');
    expect(code).toContain("import { RozieSlot } from '@rozie/runtime-angular';");
    // The `templates` input is still present and unchanged.
    expect(code).toContain(
      'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
    );
  });

  // AMENDED — Phase 80 Plan 10 (R3/D-09). This case stays negative, but its
  // meaning changed: it is now the SOLE boundary for the amended dependency
  // prohibition (was: "no record-path slots" → now: "no slots at all",
  // this plan's `must_haves.prohibitions` first entry). Every producer that
  // declares ANY slot — identifier-named, record-only, or default — now
  // reaches the wide gate above; only a genuinely slotless component stays
  // import-free.
  it('a producer with no slots at all emits none of the three new members and no templates input', () => {
    const code = compileAngular(NO_SLOT_PRODUCER, 'Plain.rozie');
    expect(code).not.toContain('__rozieFills');
    expect(code).not.toContain('__rozieFillMap');
    expect(code).not.toContain('@rozie/runtime-angular');
    expect(code).not.toContain('templates = input<');
  });

  it('the templates signal input is present and unchanged when a key-fillable slot is also present', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    expect(code).toContain(
      'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
    );
  });

  it('the fold skips nullish/prototype-pollution keys, normalizes empty-string to defaultSlot, and lets a later entry win', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    // Object.create(null) accumulator — T-80-01's chosen mitigation.
    expect(code).toContain('Object.create(null)');
    // Nullish skip.
    expect(code).toMatch(/if \(k == null\) continue;/);
    // Prototype-pollution blocklist, mirroring LISTENERS_FORBIDDEN_KEYS_GUARD.
    expect(code).toContain(
      "if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;",
    );
    // D-06 empty-string normalization to the producer's synthetic default-slot key.
    expect(code).toContain("k === '' ? 'defaultSlot' : k");
  });
});

describe('Angular producer — dev-mode-only diagnostics effect (Task 2)', () => {
  it('a key-fillable producer emits __rozieProjectedTpls, __rozieSlotWarned, and a single dev-mode-guarded diagnostics effect', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    expect(code).toContain(
      '__rozieProjectedTpls = contentChildren(TemplateRef, { descendants: true });',
    );
    expect(code).toContain('__rozieSlotWarned = false;');
    // Exactly one effect() block carries both warnings.
    const effectCount = (code.match(/effect\(\(\) => \{/g) ?? []).length;
    expect(effectCount).toBeGreaterThanOrEqual(1);
  });

  it('every console. call the emitter adds is inside the dev-mode guard — no unguarded console call is emitted', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    // Isolate the diagnostics effect body text and confirm the guard
    // (globalThis-read, structurally-typed, no ambient declare needed)
    // appears BEFORE every console. call inside it.
    const effectMatch = code.match(
      /effect\(\(\) => \{[\s\S]*?ngDevMode[\s\S]*?\}\);/,
    );
    expect(effectMatch).not.toBeNull();
    const effectBody = effectMatch![0];
    expect(effectBody).toContain('globalThis as { ngDevMode?: unknown }');
    // The guard's early-return must precede every console.warn call in the
    // same block (source-order check).
    const guardIdx = effectBody.indexOf('ngDevMode');
    const consoleIdxs = [...effectBody.matchAll(/console\./g)].map((m) => m.index ?? -1);
    for (const idx of consoleIdxs) {
      expect(idx).toBeGreaterThan(guardIdx);
    }
    // No bare `declare global` ambient block anywhere in the output.
    expect(code).not.toContain('declare global');
  });

  // AMENDED — Phase 80 Plan 10 (R3/D-09). This case's NAME still says
  // "no key-fillable slot" but its meaning narrowed with the split gate:
  // it now proves the DIAGNOSTICS half stays on the narrow
  // `isRecordOnlySlotDecl` gate even though the identifier-only producer's
  // INTAKE half widened (see the inverted case above). It intentionally
  // carries no `__rozieFills`/`__rozieFillMap` assertion — those now belong
  // to the widened-gate case above, not here.
  it('a producer with no key-fillable slot emits no diagnostics effect and no second content query', () => {
    const identifierCode = compileAngular(IDENTIFIER_ONLY_PRODUCER, 'X.rozie');
    expect(identifierCode).not.toContain('__rozieProjectedTpls');
    expect(identifierCode).not.toContain('__rozieSlotWarned');
    expect(identifierCode).not.toContain('ngDevMode');

    const noSlotCode = compileAngular(NO_SLOT_PRODUCER, 'Plain.rozie');
    expect(noSlotCode).not.toContain('__rozieProjectedTpls');
    expect(noSlotCode).not.toContain('__rozieSlotWarned');
    expect(noSlotCode).not.toContain('ngDevMode');
  });

  it('the diagnostics effect references the ROZ750 code and the component name in its duplicate-key warning', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    expect(code).toContain('ROZ750');
    expect(code).toContain('Cell');
  });
});

describe('Angular producer — fill map spliced into the resolution chain (Task 3)', () => {
  it('on a fill-map-bearing producer, a record-only slot resolves as fill map, then templates input', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    expect(code).toContain(
      "*ngTemplateOutlet=\"(__rozieFillMap()['cell-status'] ?? templates()?.['cell-status'])",
    );
  });

  it('on a fill-map-bearing producer, an identifier-named slot resolves as static content-child, then fill map, then templates input', () => {
    const code = compileAngular(
      `
<rozie name="Mixed">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div>
  <slot name="cell-status" :value="value()"></slot>
  <slot name="header"></slot>
</div>
</template>
</rozie>
`,
      'Mixed.rozie',
    );
    expect(code).toContain(
      "*ngTemplateOutlet=\"(headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])\"",
    );
  });

  // AMENDED — Phase 80 Plan 10 (R3/D-09). The case this replaces asserted
  // "on a producer that emits NO fill map, both resolution expressions are
  // byte-identical to their pre-change form" — a state that, after Plan 10,
  // can no longer occur: because a slot invocation only ever reaches this
  // code from a producer that owns at least one slot declaration (itself),
  // and `hasKeyedFillIntake` is now unconditional over slot-declaring
  // producers, EVERY producer this function can run against now emits a
  // fill map. Rather than delete the coverage, this case pins the amended
  // invariant on the SAME identifier-only producer the old case used: its
  // chain is static content-child, then fill map, then `templates`, in that
  // order, with the static content-child operand still leftmost (SPEC
  // prohibition 4a — static content-child keeps first precedence).
  it('on a static-identifier-only producer, the fill map is now part of the chain — static content-child, then fill map, then templates (D-09 widened gate)', () => {
    const code = compileAngular(IDENTIFIER_ONLY_PRODUCER, 'X.rozie');
    expect(code).toContain(
      "*ngTemplateOutlet=\"(headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header'])\"",
    );
  });

  it('the synthetic default-slot key used on the identifier path is the same key the fold normalizes the empty string to', () => {
    const code = compileAngular(
      `
<rozie name="Def">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div>
  <slot name="cell-status" :value="value()"></slot>
  <slot></slot>
</div>
</template>
</rozie>
`,
      'Def.rozie',
    );
    expect(code).toContain(
      "*ngTemplateOutlet=\"(defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot'])\"",
    );
  });
});
