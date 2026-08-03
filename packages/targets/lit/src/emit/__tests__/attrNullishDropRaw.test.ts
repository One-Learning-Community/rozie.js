/**
 * Quick 260802-v1v Task 5 — SEAMS 3+4 RED: Lit's nullable-prop nullish-drop
 * hole and the r-for loop-key DOM leak.
 *
 * Shared probe (docket task A findings §1) — a `lbl: { type: String, default:
 * null }` prop bound `:aria-label` on the root `<div>`, a nested `<span>`, and
 * an `r-for` `<i>` carrying `:key="c"`.
 *
 * SEAM 3 — `emitTemplate.ts:710-726` gates the `rozieAttr` wrap SOLELY on
 * `attr.wrapForDisplay`. A bare `$props.<nullable String>` read is provably
 * primitive → `wrapForDisplay=false` → the raw `` `${attr.name}=\${expr}` ``
 * return at :726, so `aria-label=""` renders on null instead of dropping.
 * React (`emitTemplateAttribute.ts:1195-1217`, "Phase 65 Class 1/SC-1") and
 * Solid (`:263,824`) already carry a SECOND gate — `isNullablePropRead` — that
 * routes this exact shape through `rozieAttr` even when `wrapForDisplay` is
 * false. Lit has neither.
 *
 * SEAM 4 — `emitTemplate.ts:1416-1424` strips `key` ONLY when
 * `node.remountKeyExpression` is set; the inline comment explicitly says an
 * `r-for` LOOP key is "untouched here". React's `isConsumedAttribute`
 * (`emitTemplateAttribute.ts:88`) and Solid's (`:128`) treat `key`/`:key` as
 * unconditionally consumed. Lit leaks `key=${rozieAttr(c)}` into the DOM.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../../emitLit.js';
import { emitReact } from '../../../../react/src/emitReact.js';

const PROBE_SRC = `<rozie name="Probe">
<props>
{
  lbl: { type: String, default: null },
  nonNullable: { type: String, default: 'x' },
}
</props>
<data>
{
  items: ['a', 'b'],
}
</data>
<template>
<div :aria-label="$props.lbl">
  <span :title="$props.lbl">nested</span>
  <span :data-fixed="$props.nonNullable"></span>
  <i r-for="c in $data.items" :key="c" :title="$props.lbl">{{ c }}</i>
</div>
</template>
</rozie>`;

function compileLit(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitLit(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

function compileReact(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitReact(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

/**
 * Extract the `render()` body from the emitted Lit .ts file (copied from
 * listenerSpread.test.ts — depth-aware `${...}` walk).
 */
function extractRenderBody(emitted: string): string {
  const renderStart = emitted.search(/return\s+html`/);
  if (renderStart < 0) return emitted;
  const bodyStart = emitted.indexOf('`', renderStart) + 1;
  let i = bodyStart;
  let depth = 0;
  while (i < emitted.length) {
    const ch = emitted[i]!;
    const next = emitted[i + 1];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '$' && next === '{') {
      depth++;
      i += 2;
      continue;
    }
    if (ch === '}' && depth > 0) {
      depth--;
      i++;
      continue;
    }
    if (ch === '`' && depth === 0) {
      break;
    }
    i++;
  }
  return emitted.slice(bodyStart, i);
}

describe('emitTemplate (Lit) — nullable-attr nullish-drop + r-for key leak (Quick 260802-v1v seams 3+4)', () => {
  it('SEAM 3 RED — all three $props.lbl attribute reads must route through rozieAttr', () => {
    const body = extractRenderBody(compileLit(PROBE_SRC));

    // RED ×3 — currently raw `${this.lbl}`, must become `${rozieAttr(this.lbl)}`.
    expect(body).toContain('aria-label=${rozieAttr(this.lbl)}');
    expect(body).not.toContain('aria-label=${this.lbl}');

    const titleMatches = body.match(/title=\$\{rozieAttr\(this\.lbl\)\}/g) ?? [];
    expect(titleMatches.length).toBe(2); // nested <span> + the r-for <i>
    expect(body).not.toContain('title=${this.lbl}');
  });

  it('SEAM 3 byte-identity guard — a NON-nullable prop read stays RAW', () => {
    const body = extractRenderBody(compileLit(PROBE_SRC));
    // `nonNullable` has no `default: null` — must NOT be wrapped.
    expect(body).toContain('data-fixed=${this.nonNullable}');
    expect(body).not.toContain('data-fixed=${rozieAttr(this.nonNullable)}');
  });

  it('SEAM 3 byte-identity guard — an existing wrapForDisplay call-expression binding still wraps, and false still stringifies', () => {
    const src = `<rozie name="ProbeB">
<data>
{
  cond: false,
}
</data>
<template>
<div :aria-expanded="$data.cond ? 'true' : 'false'" :title="displayValue()"></div>
</template>
<script>
function displayValue() { return 'x'; }
</script>
</rozie>`;
    const body = extractRenderBody(compileLit(src));
    // false must still stringify (never nullish-dropped) — the a11y contract.
    // ($data.cond lowers to a Lit signal read: this._cond.value.)
    expect(body).toContain("aria-expanded=${rozieAttr(this._cond.value ? 'true' : 'false')}");
    // an existing wrapForDisplay=true call-expression binding still wraps.
    expect(body).toContain('title=${rozieAttr(this.displayValue())}');
  });

  it('SEAM 4 RED — the r-for loop <i> must carry no literal key= attribute', () => {
    const body = extractRenderBody(compileLit(PROBE_SRC));
    // RED — currently leaks `key=${rozieAttr(c)}` verbatim into the DOM.
    expect(body).not.toMatch(/<i[^>]*\bkey=\$\{/);
  });

  it('react control — all three attribute reads wrap via rozieAttr (parity control)', () => {
    const jsx = compileReact(PROBE_SRC);
    const ariaMatches = jsx.match(/aria-label=\{rozieAttr\(props\.lbl\)\}/g) ?? [];
    const titleMatches = jsx.match(/title=\{rozieAttr\(props\.lbl\)\}/g) ?? [];
    expect(ariaMatches.length).toBe(1);
    expect(titleMatches.length).toBe(2);
  });
});
