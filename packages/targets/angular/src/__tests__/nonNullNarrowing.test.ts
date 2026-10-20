/**
 * SN-1 parity (quick 261019-ti9, add-on G) — Angular asserts the value an `@if`
 * branch tested non-null where the body needs it.
 *
 * `@if (picked()) { picked().name }` is TS2531 under `strictTemplates`: Angular
 * signal reads are calls, which TypeScript never narrows (React / Vue / Svelte /
 * Lit narrow the plain property read). A branch whose test is a recognised nullish
 * guard (bare truthiness, `!!x`, `x != null`, `x !== null`, `x !== undefined`,
 * either operand order) over a `$props` / model / `$data` / `$computed` value now
 * renders its body with that path recorded; the template rewriter wraps a read of
 * it in a type-only non-null assertion (`picked()!.name`) at the positions that
 * need it: the object of a member access, a call callee / argument, or — on a
 * composed child — the whole `[prop]` value.
 *
 * Everything else is byte-identical: an interpolation-only re-read, an HTML-host
 * attribute re-read, an `&&` test, an author function-call test, a write target,
 * and a read OUTSIDE the branch.
 */
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitTemplate } from '../emit/emitTemplate.js';

function lowerInline(source: string): IRComponent {
  const result = parse(source, { filename: 'NonNull.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

const PROPS = `<props>
{
  label: { type: String, default: null },
  count: { type: Number },
  value: { type: String, default: null, model: true },
}
</props>
<data>
{
  picked: null as Item | null,
  maybe: undefined as Item | undefined,
  rows: [] as Array<{ id: number; ok: string }>,
}
</data>`;

const SCRIPT = `<script lang="ts">
const sel = $computed((): Item | null => $data.picked)
const fmt = (s: string): string => s.toUpperCase()
const use = (s: string | null): void => { void s }
const pick = (): Item | null => null
</script>`;

function template(body: string, extra = ''): string {
  const source = `<rozie name="NonNull">
<types>
export interface Item { name: string; child: Item | null }
</types>
${extra}
${PROPS}
${SCRIPT}
<template>
${body}
</template>
</rozie>`;
  return emitTemplate(lowerInline(source), createDefaultRegistry()).template;
}

describe('emitConditional (Angular) — non-null assertion inside a tested branch', () => {
  it('truthiness: call argument and member access are asserted', () => {
    const out = template(
      `<div><span r-if="$props.label">{{ fmt($props.label) }}|{{ $props.label.length }}</span></div>`,
    );
    expect(out).toContain('fmt(label()!)');
    expect(out).toContain('label()!.length');
    // the test itself is unchanged
    expect(out).toContain('@if (label())');
  });

  it('`$data`, `$computed` and model roots', () => {
    const d = template(`<div><span r-if="$data.picked">{{ $data.picked.name }}</span></div>`);
    expect(d).toContain('picked()!.name');
    const c = template(`<div><span r-if="sel">{{ sel.name }}</span></div>`);
    expect(c).toContain('sel()!.name');
    const m = template(`<div><span r-if="$props.value">{{ fmt($model.value) }}</span></div>`);
    expect(m).toContain('fmt(value()!)');
  });

  it('`!!x` and every null-comparison shape, either operand order', () => {
    expect(template(`<div><span r-if="!!$props.label">{{ fmt($props.label) }}</span></div>`)).toContain(
      'fmt(label()!)',
    );
    expect(
      template(`<div><span r-if="$props.count != null">{{ fmt($props.count) }}</span></div>`),
    ).toContain('fmt(count()!)');
    expect(
      template(`<div><span r-if="$data.picked !== null">{{ $data.picked.name }}</span></div>`),
    ).toContain('picked()!.name');
    expect(
      template(`<div><span r-if="$data.maybe !== undefined">{{ $data.maybe.name }}</span></div>`),
    ).toContain('maybe()!.name');
    expect(
      template(`<div><span r-if="null != $data.picked">{{ $data.picked.name }}</span></div>`),
    ).toContain('picked()!.name');
  });

  it('nested: the inner test and body assert along the chain', () => {
    const out = template(
      `<div><span r-if="$data.picked"><b r-if="$data.picked.child">{{ $data.picked.child.name }}</b></span></div>`,
    );
    expect(out).toContain('@if (picked()!.child)');
    expect(out).toContain('picked()!.child!.name');
  });

  it('a composed child `[prop]` binding is asserted whole; a handler call argument too', () => {
    const out = template(
      `<div><span r-if="$props.label"><Child :p="$props.label" /><button @click="use($props.label)">x</button></span></div>`,
      `<components>{ Child: './Child.rozie' }</components>`,
    );
    expect(out).toMatch(/\[p\]="label\(\)!"/);
    expect(out).toContain('use(label()!)');
  });

  it('r-else-if: only the branch that tested the value asserts it', () => {
    const out = template(
      `<div><span r-if="$props.label">{{ fmt($props.label) }}</span><b r-else-if="$data.picked">{{ $data.picked.name }}</b><i r-else>{{ $props.label }}</i></div>`,
    );
    expect(out).toContain('fmt(label()!)');
    expect(out).toContain('picked()!.name');
    // the r-else branch reads label() bare (and as an interpolation: no assertion)
    expect(out).toContain('<i>{{ label() }}</i>');
  });

  // ---- byte-identical exclusions ----

  it('NO-REGRESS: an interpolation-only re-read is not asserted', () => {
    const out = template(`<div><span r-if="$props.label">{{ $props.label }}</span></div>`);
    expect(out).not.toContain('!');
  });

  it('NO-REGRESS: an HTML-host attribute re-read is not asserted', () => {
    const out = template(`<div><span r-if="$props.label" :title="$props.label">x</span></div>`);
    expect(out).toContain('[attr.title]="rozieAttr(label())"');
    expect(out).not.toContain('label()!');
  });

  it('NO-REGRESS: a read outside the branch is not asserted', () => {
    const out = template(
      `<div><span r-if="$props.label">{{ fmt($props.label) }}</span><b>{{ fmt($props.label) }}</b></div>`,
    );
    expect(out).toContain('fmt(label()!)');
    expect(out).toMatch(/<b>\{\{ rozieDisplay\(fmt\(label\(\)\)\) \}\}<\/b>/);
  });

  it('NO-REGRESS: an `&&` test and an author function-call test record nothing', () => {
    const a = template(
      `<div><span r-if="$data.picked && $data.picked.child">{{ $data.picked.child.name }}</span></div>`,
    );
    expect(a).not.toContain('!');
    const b = template(`<div><span r-if="pick()">{{ pick().name }}</span></div>`);
    expect(b).not.toContain('!');
  });

  it('a write target is never asserted', () => {
    const out = template(
      `<div><span r-if="$data.picked"><button @click="$data.picked = null">x</button></span></div>`,
    );
    expect(out).toContain('picked.set(null)');
    expect(out).not.toContain('!');
  });

  it('shadowing: a `$computed` root re-bound by an r-for alias is not asserted inside the loop', () => {
    const out = template(
      `<div><span r-if="sel">{{ sel.name }}<template r-for="sel in $data.rows" :key="sel.id"><i>{{ fmt(sel.ok) }}</i></template></span></div>`,
    );
    expect(out).toContain('sel()!.name');
    expect(out).toContain('fmt(sel.ok)');
    expect(out).not.toContain('sel!.ok');
  });
});
