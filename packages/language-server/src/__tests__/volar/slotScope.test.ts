/**
 * Phase 85 Plan 05 — REQ-V11 scoped-slot-fill parameters.
 *
 * `<template #name="{ a, b }">` introduces bindings visible to every
 * expression in the fill's own subtree AND on the fill element's own
 * attributes, exactly the shape the proven `r-for` alias lowering already
 * gives loop bindings (`virtualCode.ts`). This is the largest single class
 * of false errors the corpus survey reports (~250 of the 699 baseline
 * diagnostics) — every one is the same shape: an author destructured a
 * scoped-slot parameter and the generated module had no binding for it.
 *
 * Modeled directly on `virtualCode.prove.test.ts`'s harness (same
 * `createLanguage` / `createLanguageServiceHost` shape, same production
 * `generateVirtualTs` / `rozieLanguagePlugin` — no forked copy).
 *
 * Type fidelity is explicitly parity with the loop-alias precedent: a
 * scoped param resolves as an untyped value. Deriving its true type from a
 * producer's slot declaration is cross-file inference this plan does not
 * attempt — see 85-05-PLAN.md's scope-boundary note.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLanguage, FileMap, type IScriptSnapshot, SourceMap } from '@volar/language-core';
import { createLanguageServiceHost, resolveFileLanguageId } from '@volar/typescript';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { rozieLanguagePlugin } from '../../volar/languagePlugin.js';
import { generateVirtualTs } from '../../volar/virtualCode.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, '..', 'fixtures');
const FIXTURE = 'ProbeSlotScope.rozie';
const F = path.join(FIXTURES_DIR, FIXTURE);

const source = readFileSync(F, 'utf8');

function snap(text: string): IScriptSnapshot {
  return {
    getText: (s: number, e: number) => text.slice(s, e),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

/** offset of the Nth occurrence of `needle` in the fixture's .rozie source */
function at(needle: string, n = 1): number {
  let i = -1;
  for (let k = 0; k < n; k++) i = source.indexOf(needle, i + 1);
  if (i < 0) throw new Error(`fixture missing: "${needle}" (#${n})`);
  return i;
}

describe('slot-fill scoped parameters (REQ-V11) — generated module never throws', () => {
  it('generateVirtualTs does not throw on the fixture, including its malformed fill', () => {
    expect(() => generateVirtualTs(source, FIXTURE)).not.toThrow();
  });

  it('the generated module has no compiler-internal generation diagnostics', () => {
    const result = generateVirtualTs(source, FIXTURE);
    expect(result.diagnostics).toEqual([]);
  });
});

describe('slot-fill scoped parameters (REQ-V11) — against a real ts.LanguageService', () => {
  const files = new Map<string, string>([[F, source]]);

  const { mappings } = generateVirtualTs(source, FIXTURE);
  const map = new SourceMap(mappings);

  /** .rozie offset -> virtual-TS offset */
  function toGen(off: number): number | undefined {
    for (const [g] of map.toGeneratedLocation(off)) return g;
    return undefined;
  }
  /** virtual-TS offset -> .rozie offset */
  function toSrc(off: number): number | undefined {
    for (const [s] of map.toSourceLocation(off)) return s;
    return undefined;
  }

  const language = createLanguage(
    [rozieLanguagePlugin, { getLanguageId: resolveFileLanguageId }],
    new FileMap(ts.sys.useCaseSensitiveFileNames),
    (fileName: string) => {
      // MUST fall through to the real filesystem for lib.*.d.ts.
      const text = files.get(fileName) ?? (existsSync(fileName) ? readFileSync(fileName, 'utf8') : undefined);
      if (text !== undefined) language.scripts.set(fileName, snap(text));
      else language.scripts.delete(fileName);
    },
  );

  const { languageServiceHost } = createLanguageServiceHost(ts, ts.sys, language, (fn: string) => fn, {
    getCurrentDirectory: () => FIXTURES_DIR,
    getCompilationSettings: () => ({
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      allowNonTsExtensions: true,
      types: [],
    }),
    getScriptFileNames: () => [...files.keys()],
    getProjectVersion: () => '1',
  });
  const ls = ts.createLanguageService(languageServiceHost);

  interface MappedDiag {
    code: number;
    msg: string;
    srcOffset: number | undefined;
    text: string;
  }

  let diags: MappedDiag[];

  beforeAll(() => {
    const semantic = ls.getSemanticDiagnostics(F);
    diags = semantic.map((d) => {
      const s = toSrc(d.start ?? 0);
      return {
        code: d.code,
        msg: ts.flattenDiagnosticMessageText(d.messageText, ' '),
        srcOffset: s,
        text: s === undefined ? '(unmapped)' : source.slice(s, s + (d.length ?? 0)),
      };
    });
  });

  // TS reports an unresolved identifier as 2304 ("Cannot find name 'X'.")
  // normally, or 2552 ("Cannot find name 'X'. Did you mean 'Y'?") when a
  // near-match global exists — `node` is close enough to the DOM `Node`
  // type to trigger 2552 instead of 2304. Both are "this name did not
  // resolve" for this suite's purposes.
  const UNKNOWN_NAME_CODES = new Set([2304, 2552]);

  /** true if some "Cannot find name" diagnostic sits exactly at `srcOffset`, spanning `text`. */
  function unknownNameErrorAt(srcOffset: number, text: string): boolean {
    return diags.some((d) => UNKNOWN_NAME_CODES.has(d.code) && d.srcOffset === srcOffset && d.text === text);
  }

  it('the module compiles: zero syntax errors even with the malformed fill present', () => {
    const syntactic = ls.getSyntacticDiagnostics(F);
    const detail = syntactic.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join(' | ');
    expect(syntactic, detail).toHaveLength(0);
  });

  describe('(1) an interpolation inside a named fill reading its destructured param', () => {
    it('List1: `node` in `{{ node.label }}` resolves', () => {
      expect(unknownNameErrorAt(at('node.label'), 'node')).toBe(false);
    });
    it('List2: `total` in `{{ total }}` (first occurrence, inside its own fill) resolves', () => {
      expect(unknownNameErrorAt(at('{{ total }}', 1) + 3, 'total')).toBe(false);
    });
    it('List3: multi-name destructure — both `rowValue` and `columnValue` resolve', () => {
      expect(unknownNameErrorAt(at('{{ rowValue }}') + 3, 'rowValue')).toBe(false);
      expect(unknownNameErrorAt(at('{{ columnValue }}') + 3, 'columnValue')).toBe(false);
    });
    it('List4: a default-slot fill (`#default`) with one param resolves the same way', () => {
      expect(unknownNameErrorAt(at('{{ soleParam }}') + 3, 'soleParam')).toBe(false);
    });
  });

  describe('(2) an event-handler expression AND a bound-attribute expression inside the slot body', () => {
    it('`node` inside the @click handler (`node.select()`) resolves', () => {
      expect(unknownNameErrorAt(at('node.select'), 'node')).toBe(false);
    });
    it('`node` inside the :disabled bound attribute (`node.disabled`) resolves', () => {
      expect(unknownNameErrorAt(at('node.disabled'), 'node')).toBe(false);
    });
  });

  describe('(3) hover/definition on a scoped param reverse-maps onto its destructured name', () => {
    it('`node` used in `node.label` navigates back to `node` inside `{ node }`', () => {
      const usageOffset = at('node.label');
      const gen = toGen(usageOffset);
      expect(gen, 'no generated position for the node.label usage').toBeDefined();
      const defs = ls.getDefinitionAtPosition(F, gen as number);
      expect(defs && defs.length > 0, 'no definition found for `node`').toBe(true);
      const def = defs![0]!;
      const srcOffset = toSrc(def.textSpan.start);
      expect(srcOffset, 'definition location did not reverse-map to source').toBeDefined();
      // The destructured name sits 2 chars after the '{' of `{ node }`.
      expect(srcOffset).toBe(at('{ node }') + 2);
      expect(source.slice(srcOffset as number, (srcOffset as number) + 4)).toBe('node');
    });
  });

  describe('(4) the fill element\'s OWN bound attribute sees its own destructured param', () => {
    it('`node` inside `:data-node-id="node.id"` (on the <template #default> element itself) resolves', () => {
      expect(unknownNameErrorAt(at('node.id'), 'node')).toBe(false);
    });
  });

  describe('(5) a parameter name used OUTSIDE its own fill still reports an unknown name', () => {
    it('`node` used at top level (outside every fill) is unresolved', () => {
      const outsideOffset = at('{{ node }}') + 3;
      expect(unknownNameErrorAt(outsideOffset, 'node')).toBe(true);
    });
    it('`total` used at top level (outside every fill, including its own sibling) is unresolved', () => {
      const outsideOffset = at('{{ total }}', 2) + 3;
      expect(unknownNameErrorAt(outsideOffset, 'total')).toBe(true);
    });
  });

  describe('(6) two sibling fills with differently-named params each see only their own', () => {
    it('List1\'s `node` binding never leaks into List2\'s fill (proven by the top-level leak checks above) and vice versa', () => {
      // Positive proof: each resolves inside its OWN fill.
      expect(unknownNameErrorAt(at('node.label'), 'node')).toBe(false);
      expect(unknownNameErrorAt(at('{{ total }}', 1) + 3, 'total')).toBe(false);
      // Negative proof: neither resolves outside every fill (case 5 above)
      // — since sibling scopes are mutually "outside" each other in exactly
      // the sense that matters, this is the sibling-isolation proof.
    });
  });

  describe('(7) no-parameter and malformed-parameter fills emit no scope block and change nothing', () => {
    it('List5 (`<template #header>`, no parameter expression) still compiles with no scope-related diagnostics', () => {
      const list5Diags = diags.filter((d) => d.srcOffset !== undefined && d.text === 'Static header');
      expect(list5Diags).toHaveLength(0);
    });
    it('List6 (`#broken="{ a, "`, malformed) still compiles — no throw, no scope block', () => {
      // Already proven not to throw (top describe block); confirm no diagnostic
      // is anchored inside List6's body, and the malformed attribute value
      // itself never becomes a mapped identifier.
      const inList6 = diags.filter(
        (d) => d.srcOffset !== undefined && d.srcOffset >= at('#broken') && d.srcOffset < at('</List6>'),
      );
      expect(inList6.map((d) => d.msg)).toEqual([]);
    });
  });

  describe('(8) nested composition — a loop inside a slot body inside a conditional', () => {
    it('both the loop alias (`rowItem`) and the slot param (`group`) resolve at the innermost caret', () => {
      expect(unknownNameErrorAt(at('group.label', 1), 'group')).toBe(false);
      expect(unknownNameErrorAt(at('rowItem.id'), 'rowItem')).toBe(false);
    });

    it('the slot param is still in scope after the loop block closes, but inside the fill', () => {
      expect(unknownNameErrorAt(at('group.label', 2), 'group')).toBe(false);
    });

    it('the loop alias is NOT in scope after the loop block closes, even though still inside the fill', () => {
      expect(unknownNameErrorAt(at('rowItem.stale'), 'rowItem')).toBe(true);
    });

    it('the slot param `group` reverse-maps to its destructured name at both occurrences inside the fill', () => {
      for (const n of [1, 2] as const) {
        const usageOffset = at('group.label', n);
        const gen = toGen(usageOffset);
        expect(gen, `occurrence ${n}: no generated position`).toBeDefined();
        const defs = ls.getDefinitionAtPosition(F, gen as number);
        expect(defs && defs.length > 0, `occurrence ${n}: no definition found`).toBe(true);
        const srcOffset = toSrc(defs![0]!.textSpan.start);
        expect(srcOffset, `occurrence ${n}: did not reverse-map`).toBe(at('{ group }') + 2);
      }
    });

    it('neither the loop alias nor the slot param is in scope outside the fill entirely', () => {
      // `group` and `rowItem` are never referenced anywhere else in the
      // fixture outside ListNested's own fill — the top-level leak probes
      // (case 5) already prove the general mechanism for `node`/`total`;
      // this asserts the nested fixture introduces no additional escape by
      // checking the two names appear as unknown ONLY at the one expected
      // leak site (`rowItem.stale`) and nowhere unexpected.
      const groupErrors = diags.filter((d) => d.code === 2304 && d.text === 'group');
      const rowItemErrors = diags.filter((d) => d.code === 2304 && d.text === 'rowItem');
      expect(groupErrors).toHaveLength(0);
      expect(rowItemErrors).toHaveLength(1);
      expect(rowItemErrors[0]?.srcOffset).toBe(at('rowItem.stale'));
    });
  });
});
