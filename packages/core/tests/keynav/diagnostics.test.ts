// Phase 71 Plan 02 Task 2 — resolveKeynavGroups diagnostic cluster coverage.
//
// Red-first fixture per new code (per feedback_emitter_seam_surgical_per_seam
// / 71-02-PLAN.md Task 2 acceptance criteria): each of ROZ982 (Task 1's
// KEYNAV_UNKNOWN_MODIFIER) and ROZ983-987 (Task 2's resolveKeynavGroups
// cluster — KEYNAV_NO_ITEMS / KEYNAV_ORPHAN_ITEM / KEYNAV_BAD_FOCUS_MODEL /
// KEYNAV_MULTIPLE_ROOTS / KEYNAV_SOURCE_UNRESOLVED) fires on its bad-input
// fixture, and a valid menu + valid combobox fixture emit ZERO keynav
// diagnostics.
//
// Harness mirrors landmine1-probe.test.ts / parse-lower.test.ts.
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../src/diagnostics/Diagnostic.js';
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
} from '../../src/ir/types.js';

function lower(src: string): { ir: IRComponent | null; diagnostics: Diagnostic[] } {
  const result = parse(src, { filename: 'consumer.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const { ir, diagnostics } = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  return { ir, diagnostics };
}

/** Wrap a `<template>` body fragment into a complete .rozie source. */
function rozie(templateBody: string, dataBlock = '{ active: 0, items: [] }'): string {
  return `<rozie name="KeynavDiagProbe">
<data>
${dataBlock}
</data>
<template>
${templateBody}
</template>
</rozie>
`;
}

/** Recursively collect every TemplateElementIR from the IR template tree. */
function collectElements(root: TemplateNode): TemplateElementIR[] {
  const out: TemplateElementIR[] = [];
  const walk = (n: TemplateNode): void => {
    if (n.type === 'TemplateElement') {
      out.push(n);
      n.children.forEach(walk);
    } else if (n.type === 'TemplateConditional') {
      n.branches.forEach((b) => b.body.forEach(walk));
    } else if (n.type === 'TemplateLoop') {
      n.body.forEach(walk);
    } else if (n.type === 'TemplateMatch') {
      n.branches.forEach((b) => b.body.forEach(walk));
    } else if (n.type === 'TemplateSlotInvocation') {
      n.fallback.forEach(walk);
    } else if (n.type === 'TemplateFragment') {
      n.children.forEach(walk);
    }
  };
  walk(root);
  return out;
}

function byCode(diags: Diagnostic[], code: string): Diagnostic[] {
  return diags.filter((d) => d.code === code);
}

/** The full r-keynav diagnostic cluster (Task 1's ROZ982 + Task 2's ROZ983-987). */
const KEYNAV_CODES = ['ROZ982', 'ROZ983', 'ROZ984', 'ROZ985', 'ROZ986', 'ROZ987'];

function keynavDiagnostics(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => KEYNAV_CODES.includes(d.code));
}

describe('r-keynav diagnostic cluster (71-02 Task 2 — resolveKeynavGroups)', () => {
  it('ROZ982 KEYNAV_UNKNOWN_MODIFIER — bad modifier name, did-you-mean', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.bogus="$data.active">
          <button r-for="it in items" :key="it.id" r-keynav-item="{ label: it.label }">{{ it.label }}</button>
        </div>`,
      ),
    );
    const hits = byCode(diagnostics, 'ROZ982');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('.bogus');
  });

  it('ROZ983 KEYNAV_NO_ITEMS — r-keynav root with no r-keynav-item in the component', () => {
    const { diagnostics } = lower(
      rozie(`<div role="menu" r-keynav:tabindex.vertical="$data.active"></div>`),
    );
    const hits = byCode(diagnostics, 'ROZ983');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ984 KEYNAV_ORPHAN_ITEM — r-keynav-item with no r-keynav root in the component', () => {
    const { diagnostics } = lower(
      rozie(
        '<ul><li r-for="it in items" :key="it.id" r-keynav-item="{ label: it.label }">{{ it.label }}</li></ul>',
      ),
    );
    const hits = byCode(diagnostics, 'ROZ984');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ985 KEYNAV_BAD_FOCUS_MODEL — unrecognized focus-model argument', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:foo.vertical="$data.active">
          <button r-for="it in items" :key="it.id" r-keynav-item="{ label: it.label }">{{ it.label }}</button>
        </div>`,
      ),
    );
    const hits = byCode(diagnostics, 'ROZ985');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('foo');
  });

  it('ROZ985 KEYNAV_BAD_FOCUS_MODEL — missing focus-model argument (bare r-keynav)', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav="$data.active">
          <button r-for="it in items" :key="it.id" r-keynav-item="{ label: it.label }">{{ it.label }}</button>
        </div>`,
      ),
    );
    const hits = byCode(diagnostics, 'ROZ985');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ986 KEYNAV_MULTIPLE_ROOTS — more than one r-keynav root in one component', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.vertical="$data.active">
          <button r-for="it in items" :key="it.id" r-keynav-item="{ label: it.label }">{{ it.label }}</button>
        </div>
        <div role="menu" r-keynav:tabindex.vertical="$data.active2">
          <button r-for="it2 in items2" :key="it2.id" r-keynav-item="{ label: it2.label }">{{ it2.label }}</button>
        </div>`,
        '{ active: 0, active2: 0, items: [], items2: [] }',
      ),
    );
    const hits = byCode(diagnostics, 'ROZ986');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ987 KEYNAV_SOURCE_UNRESOLVED — no :source and no co-located r-for to synthesize from', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.vertical="$data.active">
          <button r-keynav-item="{ label: 'x' }">x</button>
        </div>`,
      ),
    );
    const hits = byCode(diagnostics, 'ROZ987');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('valid menu fixture (tabindex, :source omitted) — zero keynav diagnostics + synthesized source from the co-located r-for', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.vertical.loop="$data.active" @keynav-commit="run(items[$data.active])">
          <button role="menuitem" r-for="it in items" :key="it.id" r-keynav-item="{ label: it.label, disabled: it.disabled }">
            {{ it.label }}
          </button>
        </div>`,
      ),
    );
    expect(keynavDiagnostics(diagnostics)).toEqual([]);
    const root = collectElements(ir!.template!).find((el) => el.keynavRoot !== undefined);
    expect(root?.keynavRoot?.sourceExpression).toBeDefined();
    expect(root?.keynavRoot?.sourceExpression?.type).toBe('Identifier');
    expect((root?.keynavRoot?.sourceExpression as { name?: string } | undefined)?.name).toBe(
      'items',
    );
  });

  it('valid combobox fixture (activedescendant, input + <ul> in different subtrees) — all items associate to the single root despite no DOM nesting', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div>
          <input role="combobox" r-keynav:activedescendant.vertical="$data.active"
                 :source="results" @keynav-commit="choose(results[$data.active])"
                 @input="onSearch($event)" />
          <ul role="listbox">
            <li role="option" r-for="r in results" :key="r.id"
                r-keynav-item="{ label: r.label }">{{ r.label }}</li>
          </ul>
        </div>`,
        '{ active: 0, results: [] }',
      ),
    );
    expect(keynavDiagnostics(diagnostics)).toEqual([]);
    const els = collectElements(ir!.template!);
    const root = els.find((el) => el.keynavRoot !== undefined);
    const items = els.filter((el) => el.keynavItem !== undefined);
    expect(root).toBeDefined();
    expect(items.length).toBeGreaterThan(0);
    // Explicit `:source="results"` wins — no synthesis needed.
    expect(root?.keynavRoot?.sourceExpression?.type).toBe('Identifier');
    expect((root?.keynavRoot?.sourceExpression as { name?: string } | undefined)?.name).toBe(
      'results',
    );
  });
});
