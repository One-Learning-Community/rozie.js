// Phase 77 Plan 02 Task 1 — RED: core suite for the grid modifier,
// containment-scoped multi-group and the ROZ993-996 cluster.
//
// Specifies the complete Phase-77 compiler front-end contract (SPEC.md §3,
// §3.1, §6, §8) BEFORE any implementation lands. Task 2 makes the grid-
// modifier-lowering and grid-legality blocks below pass; Task 3 makes the
// multi-group-scoping and ROZ996/ROZ986-retirement blocks pass.
//
// Harness copied locally from diagnostics.test.ts / parse-lower.test.ts per
// the existing keynav test files' standalone convention (see those files'
// header comments).
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
  return `<rozie name="KeynavGridMultiGroupProbe">
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

function errors(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => d.severity === 'error');
}

const MENU_ITEMS = `<button r-for="it in items" :key="it.id" r-keynav-item="{ label: it.label }">{{ it.label }}</button>`;

describe('r-keynav grid modifier lowering (77-02 Task 2)', () => {
  it('.grid(7) on a root lowers a numeric-literal columns expression with empty deps', () => {
    const { ir, diagnostics } = lower(
      rozie(`<div role="grid" r-keynav:tabindex.grid(7)="$data.active">${MENU_ITEMS}</div>`),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot?.grid).toBeDefined();
    expect(div?.keynavRoot?.grid?.columnsExpression.type).toBe('NumericLiteral');
    expect(
      (div?.keynavRoot?.grid?.columnsExpression as { value?: number } | undefined)?.value,
    ).toBe(7);
    expect(div?.keynavRoot?.grid?.columnsDeps).toEqual([]);
  });

  it('.grid($data.cols) lowers a reactive member-expression columns expression with non-empty deps naming cols', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div role="grid" r-keynav:tabindex.grid($data.cols)="$data.active">${MENU_ITEMS}</div>`,
        '{ active: 0, cols: 7, items: [] }',
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot?.grid).toBeDefined();
    expect(div?.keynavRoot?.grid?.columnsExpression.type).toBe('MemberExpression');
    expect(div?.keynavRoot?.grid?.columnsDeps.length).toBeGreaterThan(0);
    expect(
      div?.keynavRoot?.grid?.columnsDeps.some(
        (d) => 'path' in d && d.path.includes('cols'),
      ),
    ).toBe(true);
  });

  it('.grid(7).typeahead is legal — both the grid object and typeahead flag are present, no diagnostics', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div role="grid" r-keynav:tabindex.grid(7).typeahead="$data.active">${MENU_ITEMS}</div>`,
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot?.grid).toBeDefined();
    expect(div?.keynavRoot?.typeahead).toBe(true);
  });

  it('.grid(7).skipdisabled is legal — grid object present and the skip flag stays on', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div role="grid" r-keynav:tabindex.grid(7).skipdisabled="$data.active">${MENU_ITEMS}</div>`,
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot?.grid).toBeDefined();
    expect(div?.keynavRoot?.skipDisabled).toBe(true);
  });

  it('a root WITHOUT .grid has no grid field on its IR (undefined, not an empty object) — additive-invariant probe', () => {
    const { ir, diagnostics } = lower(
      rozie(`<div role="menu" r-keynav:tabindex.vertical="$data.active">${MENU_ITEMS}</div>`),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot?.grid).toBeUndefined();
  });

  it('bare .grid(7) with no .skipdisabled defaults skipDisabled to false (inert-by-default, SPEC §5); a non-grid root keeps the 1D default true', () => {
    const { ir: gridIr, diagnostics: gridDiags } = lower(
      rozie(`<div role="grid" r-keynav:tabindex.grid(7)="$data.active">${MENU_ITEMS}</div>`),
    );
    expect(errors(gridDiags)).toEqual([]);
    const gridDiv = collectElements(gridIr!.template!).find((el) => el.tagName === 'div');
    expect(gridDiv?.keynavRoot?.skipDisabled).toBe(false);

    const { ir: listIr, diagnostics: listDiags } = lower(
      rozie(`<div role="menu" r-keynav:tabindex.vertical="$data.active">${MENU_ITEMS}</div>`),
    );
    expect(errors(listDiags)).toEqual([]);
    const listDiv = collectElements(listIr!.template!).find((el) => el.tagName === 'div');
    expect(listDiv?.keynavRoot?.skipDisabled).toBe(true);
  });
});

describe('r-keynav grid legality — ROZ993/ROZ994/ROZ995 (77-02 Task 2)', () => {
  it('.grid(7).vertical reports exactly one ROZ993 at error severity', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="grid" r-keynav:tabindex.grid(7).vertical="$data.active">${MENU_ITEMS}</div>`,
      ),
    );
    const hits = byCode(diagnostics, 'ROZ993');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('.grid(7).horizontal reports exactly one ROZ993', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="grid" r-keynav:tabindex.grid(7).horizontal="$data.active">${MENU_ITEMS}</div>`,
      ),
    );
    const hits = byCode(diagnostics, 'ROZ993');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('.grid(7).both reports exactly one ROZ993', () => {
    const { diagnostics } = lower(
      rozie(`<div role="grid" r-keynav:tabindex.grid(7).both="$data.active">${MENU_ITEMS}</div>`),
    );
    const hits = byCode(diagnostics, 'ROZ993');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('.grid(7).loop reports exactly one ROZ994', () => {
    const { diagnostics } = lower(
      rozie(`<div role="grid" r-keynav:tabindex.grid(7).loop="$data.active">${MENU_ITEMS}</div>`),
    );
    const hits = byCode(diagnostics, 'ROZ994');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('bare .grid with no argument reports exactly one ROZ995', () => {
    const { diagnostics } = lower(
      rozie(`<div role="grid" r-keynav:tabindex.grid="$data.active">${MENU_ITEMS}</div>`),
    );
    const hits = byCode(diagnostics, 'ROZ995');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it(".grid('seven') (string literal argument) reports exactly one ROZ995", () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="grid" r-keynav:tabindex.grid('seven')="$data.active">${MENU_ITEMS}</div>`,
      ),
    );
    const hits = byCode(diagnostics, 'ROZ995');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('.grid($refs.x) (ref handle argument) reports exactly one ROZ995', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="grid" r-keynav:tabindex.grid($refs.x)="$data.active">${MENU_ITEMS}</div>`,
      ),
    );
    const hits = byCode(diagnostics, 'ROZ995');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it("an unknown modifier's did-you-mean list now includes the grid modifier", () => {
    const { diagnostics } = lower(
      rozie(`<div role="grid" r-keynav:tabindex.grod(7)="$data.active">${MENU_ITEMS}</div>`),
    );
    const hits = byCode(diagnostics, 'ROZ982');
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain('grid');
  });
});

describe('r-keynav multi-group scoping — containment (77-02 Task 3)', () => {
  it('two SIBLING roots each with their own r-for items produce ZERO diagnostics, each synthesizing its own subtree source', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.vertical="$data.activeA">
          <button r-for="a in listA" :key="a.id" r-keynav-item="{ label: a.label }">{{ a.label }}</button>
        </div>
        <div role="grid" r-keynav:tabindex.grid(3)="$data.activeB">
          <button r-for="b in listB" :key="b.id" r-keynav-item="{ label: b.label }">{{ b.label }}</button>
        </div>`,
        '{ activeA: 0, activeB: 0, listA: [], listB: [] }',
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const roots = collectElements(ir!.template!).filter((el) => el.keynavRoot !== undefined);
    expect(roots.length).toBe(2);
    const names = roots.map(
      (r) => (r.keynavRoot?.sourceExpression as { name?: string } | undefined)?.name,
    );
    expect(names[0]).toBeDefined();
    expect(names[1]).toBeDefined();
    expect(names[0]).not.toBe(names[1]);
  });

  it('with 2+ roots, each root and each item carries a groupIndex assigned in document order, matching containment', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.vertical="$data.activeA">
          <button r-for="a in listA" :key="a.id" r-keynav-item="{ label: a.label }">{{ a.label }}</button>
        </div>
        <div role="grid" r-keynav:tabindex.grid(3)="$data.activeB">
          <button r-for="b in listB" :key="b.id" r-keynav-item="{ label: b.label }">{{ b.label }}</button>
        </div>`,
        '{ activeA: 0, activeB: 0, listA: [], listB: [] }',
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const els = collectElements(ir!.template!);
    const roots = els.filter((el) => el.keynavRoot !== undefined);
    expect(roots[0]?.keynavRoot?.groupIndex).toBe(0);
    expect(roots[1]?.keynavRoot?.groupIndex).toBe(1);
    const itemA = els.find((el) => el.tagName === 'button' && el.keynavItem !== undefined);
    expect(itemA?.keynavItem?.groupIndex).toBe(0);
  });

  it('with exactly ONE root, neither the root nor its items carry a groupIndex (byte-identical-IR probe)', () => {
    const { ir, diagnostics } = lower(
      rozie(`<div role="menu" r-keynav:tabindex.vertical="$data.active">${MENU_ITEMS}</div>`),
    );
    expect(errors(diagnostics)).toEqual([]);
    const els = collectElements(ir!.template!);
    const root = els.find((el) => el.keynavRoot !== undefined);
    const item = els.find((el) => el.keynavItem !== undefined);
    expect(root?.keynavRoot?.groupIndex).toBeUndefined();
    expect(item?.keynavItem?.groupIndex).toBeUndefined();
  });

  it('a nested root (an r-keynav root inside another root subtree) reports exactly one ROZ996', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.vertical="$data.activeA">
          <button r-for="a in listA" :key="a.id" r-keynav-item="{ label: a.label }">{{ a.label }}</button>
          <div role="grid" r-keynav:tabindex.grid(3)="$data.activeB">
            <button r-for="b in listB" :key="b.id" r-keynav-item="{ label: b.label }">{{ b.label }}</button>
          </div>
        </div>`,
        '{ activeA: 0, activeB: 0, listA: [], listB: [] }',
      ),
    );
    const hits = byCode(diagnostics, 'ROZ996');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('MULTI-root, orphan item: an item outside BOTH subtrees reports exactly one ROZ984', () => {
    const { diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.vertical="$data.activeA">
          <button r-for="a in listA" :key="a.id" r-keynav-item="{ label: a.label }">{{ a.label }}</button>
        </div>
        <div role="grid" r-keynav:tabindex.grid(3)="$data.activeB">
          <button r-for="b in listB" :key="b.id" r-keynav-item="{ label: b.label }">{{ b.label }}</button>
        </div>
        <button r-keynav-item="{ label: 'orphan' }">orphan</button>`,
        '{ activeA: 0, activeB: 0, listA: [], listB: [] }',
      ),
    );
    const hits = byCode(diagnostics, 'ROZ984');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('SINGLE-root cross-subtree (Gap C, additive-invariant guard) — the P71 combobox shape produces ZERO diagnostics and preserves explicit :source', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div>
          <input role="combobox" r-keynav:activedescendant.vertical="$data.active"
                 :source="results" @keynav-commit="choose(results[$data.active])" />
          <ul role="listbox">
            <li role="option" r-for="r in results" :key="r.id"
                r-keynav-item="{ label: r.label }">{{ r.label }}</li>
          </ul>
        </div>`,
        '{ active: 0, results: [] }',
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const els = collectElements(ir!.template!);
    const root = els.find((el) => el.keynavRoot !== undefined);
    const items = els.filter((el) => el.keynavItem !== undefined);
    expect(root).toBeDefined();
    expect(items.length).toBeGreaterThan(0);
    expect(root?.keynavRoot?.sourceExpression?.type).toBe('Identifier');
    expect((root?.keynavRoot?.sourceExpression as { name?: string } | undefined)?.name).toBe(
      'results',
    );
  });

  it('zero roots, items present — still ROZ984 (unchanged from today)', () => {
    const { diagnostics } = lower(
      rozie(
        '<ul><li r-for="it in items" :key="it.id" r-keynav-item="{ label: it.label }">{{ it.label }}</li></ul>',
      ),
    );
    const hits = byCode(diagnostics, 'ROZ984');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });
});

describe('r-keynav explicit item index (77-02 Task 2)', () => {
  it('r-keynav-item="{ index: idx }" lowers an index expression with deps onto the item IR', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.vertical="$data.active">
          <button r-for="it in items" :key="it.id" r-keynav-item="{ label: it.label, index: it.idx }">{{ it.label }}</button>
        </div>`,
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const button = collectElements(ir!.template!).find((el) => el.tagName === 'button');
    expect(button?.keynavItem?.indexExpression).toBeDefined();
    expect(button?.keynavItem?.indexExpression?.type).toBe('MemberExpression');
    expect(button?.keynavItem?.indexDeps).toBeDefined();
  });

  it('an item without index has no index expression (undefined)', () => {
    const { ir, diagnostics } = lower(
      rozie(`<div role="menu" r-keynav:tabindex.vertical="$data.active">${MENU_ITEMS}</div>`),
    );
    expect(errors(diagnostics)).toEqual([]);
    const button = collectElements(ir!.template!).find((el) => el.tagName === 'button');
    expect(button?.keynavItem?.indexExpression).toBeUndefined();
  });
});
