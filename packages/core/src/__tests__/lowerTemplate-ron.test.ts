// Phase 15 Plan 15-02 (Wave 1) — `lowerTemplate` r-on branch unit cases (R1).
//
// The r-on branch in `lowerTemplate.ts` populates the new
// `TemplateElementIR.listenerSpreads` field (Phase 15 R2 — ListenerSpreadIR).
// Four shapes:
//   1. dynamic expression: `r-on="someObj"` → one ListenerSpreadIR whose
//      expression is an Identifier; `literalKeys` is undefined.
//   2. plain literal key: `r-on="{ click: fn }"` → one ListenerSpreadIR whose
//      expression is an ObjectExpression; `literalKeys.length === 1`,
//      `literalKeys[0].eventName === 'click'`, `literalKeys[0].modifierPipeline === []`.
//   3. modifier-bearing literal keys (D-15): `r-on="{ 'click.stop': fn,
//      'input.debounce(300)': onInput }"` → two `literalKeys` entries with
//      resolved modifier pipelines via the existing peggy grammar.
//   4. synthesizeListenersFallthrough: when `inheritListeners === true` and the
//      single root is an `html`-kind element, the synthesizer appends a
//      ListenerSpreadIR whose expression is a bare `$listeners` Identifier;
//      when `inheritListeners === false`, no-op.
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import type {
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
} from '../ir/types.js';

function rozie(scriptBody: string, templateBody: string, opts?: { rozieAttrs?: string }): string {
  const attrs = opts?.rozieAttrs ?? '';
  return `<rozie name="ROnLower"${attrs ? ' ' + attrs : ''}>
${scriptBody ? `<script>\n${scriptBody}\n</script>\n` : ''}<template>
${templateBody}
</template>
</rozie>
`;
}

function firstIRElement(node: IRTemplateNode | null): TemplateElementIR {
  if (!node) throw new Error('IR template is null');
  const stack: IRTemplateNode[] = [node];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (cur.type === 'TemplateElement') return cur;
    if (cur.type === 'TemplateFragment') stack.push(...cur.children);
  }
  throw new Error('no IR TemplateElement found');
}

function lowerOk(source: string): TemplateElementIR {
  const { ast, diagnostics: parseDiags } = parse(source);
  expect(ast, JSON.stringify(parseDiags)).not.toBeNull();
  const { ir, diagnostics: lowerDiags } = lowerToIR(ast!, {
    modifierRegistry: createDefaultRegistry(),
  });
  expect(ir, JSON.stringify(lowerDiags)).not.toBeNull();
  expect(
    lowerDiags.filter((d) => d.severity === 'error'),
    `unexpected lowering errors: ${JSON.stringify(lowerDiags)}`,
  ).toEqual([]);
  return firstIRElement(ir!.template);
}

describe('lowerTemplate r-on branch (Phase 15 Wave 1)', () => {
  it('dynamic expression — Identifier expression, no literalKeys', () => {
    const el = lowerOk(
      rozie(
        'const someObj = { click: () => {} }',
        '<div r-on="someObj"></div>',
      ),
    );
    expect(el.listenerSpreads.length).toBe(1);
    const sp = el.listenerSpreads[0]!;
    expect(sp.type).toBe('ListenerSpread');
    expect(t.isIdentifier(sp.expression)).toBe(true);
    expect((sp.expression as t.Identifier).name).toBe('someObj');
    expect(sp.literalKeys).toBeUndefined();
  });

  it('plain literal key — populates one literalKeys entry with empty modifier pipeline', () => {
    const el = lowerOk(
      rozie(
        'const fn = (_e) => {}',
        '<div r-on="{ click: fn }"></div>',
      ),
    );
    expect(el.listenerSpreads.length).toBe(1);
    const sp = el.listenerSpreads[0]!;
    expect(t.isObjectExpression(sp.expression)).toBe(true);
    expect(sp.literalKeys).toBeDefined();
    expect(sp.literalKeys!.length).toBe(1);
    expect(sp.literalKeys![0]!.eventName).toBe('click');
    expect(sp.literalKeys![0]!.modifierPipeline).toEqual([]);
    expect(t.isIdentifier(sp.literalKeys![0]!.valueExpr)).toBe(true);
  });

  it("modifier-bearing literal keys — `'click.stop'` and `'input.debounce(300)'` resolve via peggy", () => {
    const el = lowerOk(
      rozie(
        'const fn = (_e) => {}\nconst onInput = (_e) => {}',
        `<div r-on="{ 'click.stop': fn, 'input.debounce(300)': onInput }"></div>`,
      ),
    );
    expect(el.listenerSpreads.length).toBe(1);
    const sp = el.listenerSpreads[0]!;
    expect(sp.literalKeys).toBeDefined();
    expect(sp.literalKeys!.length).toBe(2);
    expect(sp.literalKeys![0]!.eventName).toBe('click');
    expect(sp.literalKeys![0]!.modifierPipeline.length).toBeGreaterThan(0);
    expect(sp.literalKeys![1]!.eventName).toBe('input');
    expect(sp.literalKeys![1]!.modifierPipeline.length).toBeGreaterThan(0);
  });

  it('synthesize: single html root + default inherit-listeners appends a bare $listeners spread', () => {
    const el = lowerOk(rozie('', '<div></div>'));
    expect(el.listenerSpreads.length).toBe(1);
    const sp = el.listenerSpreads[0]!;
    expect(t.isIdentifier(sp.expression)).toBe(true);
    expect((sp.expression as t.Identifier).name).toBe('$listeners');
  });

  it('synthesize: inherit-listeners="false" suppresses the synthesized spread', () => {
    const el = lowerOk(
      rozie('', '<div></div>', { rozieAttrs: 'inherit-listeners="false"' }),
    );
    expect(el.listenerSpreads).toEqual([]);
  });

  it('synthesize: combines with an author-written r-on (validator handles ROZ974 separately)', () => {
    // Single-root + default inherit-listeners + author-written r-on="someObj"
    // → both the author entry and the synthesized $listeners entry land in
    // source order. (Validator only fires ROZ974 for an author-written bare
    // `$listeners`; `someObj` here is a non-magic identifier so no warning.)
    const el = lowerOk(
      rozie('const someObj = {}', '<div r-on="someObj"></div>'),
    );
    expect(el.listenerSpreads.length).toBe(2);
    // Author entry first (push happens in attribute-iteration order).
    expect(t.isIdentifier(el.listenerSpreads[0]!.expression)).toBe(true);
    expect((el.listenerSpreads[0]!.expression as t.Identifier).name).toBe('someObj');
    // Synthesized $listeners last.
    expect((el.listenerSpreads[1]!.expression as t.Identifier).name).toBe('$listeners');
  });
});
