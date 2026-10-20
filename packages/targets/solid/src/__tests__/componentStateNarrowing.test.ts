/**
 * SN-1 (quick 261019-ti9) — Solid narrows component-level state inside r-if
 * branches.
 *
 * `<Show when={local.label}>` does NOT narrow `local.label` inside its children:
 * `when` is not a type guard, Solid's `$data` / `$computed` / model reads are
 * signal CALLS (TypeScript never narrows a call), and property narrowing of
 * `local.x` does not survive the slot-param getter closure. A nullable value
 * tested by an r-if and re-read as a typed slot param, a typed call argument or
 * a member access is therefore a strict-tsc error on Solid alone (React's `&&`,
 * Lit's ternary, Vue's v-if and Svelte's {#if} all narrow).
 *
 * Fix: Show's FUNCTION CHILD. `<Show when={W}>{(_rozieWhen0) => BODY}</Show>`
 * receives an `Accessor<NonNullable<T>>`; BODY's re-reads of the tested value E
 * become `_rozieWhen0()`.
 *   - Bare truthiness `E` and `!!E`: W = E.
 *   - `E != null` / `!== null` / `!== undefined` (either operand order): `when={E}`
 *     would hide `0` / `''` / `false`, so W is a BOXED value,
 *     `((v) => (v OP N ? { value: v } : undefined))(E)`, and reads become
 *     `_rozieWhenN().value`.
 *   - The callback body is an element, or a fragment `<>…</>` for anything else
 *     (a `<slot>` mustache, text): Show runs the callback UNTRACKED, and
 *     babel-preset-solid compiles `<>{slotCall}</>` to a tracked memo while a bare
 *     `(v) => slotCall` is evaluated once.
 *   - Event handlers keep the live read: a handler can outlive the branch, and the
 *     narrowed accessor THROWS "Stale read from <Show>" when read after the
 *     condition turned falsy (debounce / throttle wrappers are also hoisted to
 *     component scope, where the accessor does not exist).
 *
 * The lowering is GATED to branches whose body re-reads E in a position that
 * needs the narrowing (member object, call callee / argument, slot arg, child
 * component prop). Everything else keeps the byte-identical `<Show when={…}>`.
 */
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../emitSolid.js';

function lowerInline(source: string): IRComponent {
  const result = parse(source, { filename: 'StateNarrow.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

function emit(source: string): string {
  const ir = lowerInline(source);
  return emitSolid(ir, { filename: 'StateNarrow.rozie', source }).code;
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
  list: [] as string[],
  rows: [] as Array<{ id: number; ok: string }>,
}
</data>`;

const SCRIPT = `<script lang="ts">
const sel = $computed((): Item | null => $data.picked)
const fmt = (s: string): string => s.toUpperCase()
const dbl = (n: number): number => n * 2
const pick = (): Item | null => null
const use = (s: string | null): void => { void s }
</script>`;

function withBody(body: string, extra = ''): string {
  return `<rozie name="StateNarrow">
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
}

const CHILD = `<components>{ Child: './Child.rozie' }</components>`;

describe('emitConditional (Solid) — component-state narrowing (SN-1)', () => {
  it('$props truthy + slot arg: Show function child, the slot getter reads the accessor', () => {
    const code = emit(
      withBody(
        `<div><span r-if="$props.label"><slot name="labelSlot" :value="$props.label" :param-types="{ value: 'string' }"></slot></span></div>`,
      ),
    );
    expect(code).toContain('<Show when={local.label}>{(_rozieWhen0) => <span');
    expect(code).toMatch(/get value\(\) \{ return _rozieWhen0\(\); \}/);
    expect(code).not.toMatch(/return local\.label/);
  });

  it('positions: call argument, member access, interpolation and component-host binding read the accessor', () => {
    const code = emit(
      withBody(
        `<div><span r-if="$props.label">{{ fmt($props.label) }}|{{ $props.label.length }}|{{ $props.label }}<Child :p="$props.label" /></span></div>`,
        CHILD,
      ),
    );
    expect(code).toContain('<Show when={local.label}>{(_rozieWhen0) => <span');
    expect(code).toContain('fmt(_rozieWhen0())');
    expect(code).toContain('_rozieWhen0().length');
    expect(code).toMatch(/p=\{_rozieWhen0\(\)\}/);
    // the bare interpolation inside the same gated branch reads the accessor too
    expect(code).toMatch(/\{rozieDisplay\(_rozieWhen0\(\)\)\}|\{_rozieWhen0\(\)\}/);
    // the only live read is the Show's own `when`
    expect(code.replace('<Show when={local.label}>', '')).not.toContain('local.label');
  });

  it('$data root: when={picked()} and member reads go through the accessor', () => {
    const code = emit(
      withBody(`<div><span r-if="$data.picked">{{ $data.picked.name }}</span></div>`),
    );
    expect(code).toContain('<Show when={picked()}>{(_rozieWhen0) => <span');
    expect(code).toContain('_rozieWhen0().name');
    expect(code).not.toContain('picked().name');
  });

  it('$computed root: when={sel()} and member reads go through the accessor', () => {
    const code = emit(withBody(`<div><span r-if="sel">{{ sel.name }}</span></div>`));
    expect(code).toContain('<Show when={sel()}>{(_rozieWhen0) => <span');
    expect(code).toContain('_rozieWhen0().name');
  });

  it('model prop root: when={value()}; $model.value in the body resolves like $props.value', () => {
    const code = emit(
      withBody(`<div><span r-if="$props.value">{{ fmt($model.value) }}</span></div>`),
    );
    expect(code).toContain('<Show when={value()}>{(_rozieWhen0) => <span');
    expect(code).toContain('fmt(_rozieWhen0())');
  });

  it('`!!E` drops the double negation: when={E} with the callback form', () => {
    const code = emit(
      withBody(`<div><span r-if="!!$props.label">{{ fmt($props.label) }}</span></div>`),
    );
    expect(code).toContain('<Show when={local.label}>{(_rozieWhen0) => <span');
    expect(code).toContain('fmt(_rozieWhen0())');
  });

  it('`!= null` is a boxed value, reads go through `.value`', () => {
    const code = emit(
      withBody(`<div><span r-if="$props.count != null">{{ dbl($props.count) }}</span></div>`),
    );
    expect(code).toContain(
      '<Show when={((v) => (v != null ? { value: v } : undefined))(local.count)}>{(_rozieWhen0) => <span',
    );
    expect(code).toContain('dbl(_rozieWhen0().value)');
  });

  it('`!== null`, `!== undefined` and the reversed `null != x` keep their own operator / literal', () => {
    const a = emit(
      withBody(`<div><span r-if="$data.picked !== null">{{ $data.picked.name }}</span></div>`),
    );
    expect(a).toContain('((v) => (v !== null ? { value: v } : undefined))(picked())');
    expect(a).toContain('_rozieWhen0().value.name');
    const b = emit(
      withBody(`<div><span r-if="$data.maybe !== undefined">{{ $data.maybe.name }}</span></div>`),
    );
    expect(b).toContain('((v) => (v !== undefined ? { value: v } : undefined))(maybe())');
    expect(b).toContain('_rozieWhen0().value.name');
    const c = emit(
      withBody(`<div><span r-if="null != $data.picked">{{ $data.picked.name }}</span></div>`),
    );
    expect(c).toContain('((v) => (v != null ? { value: v } : undefined))(picked())');
    expect(c).toContain('_rozieWhen0().value.name');
  });

  it('nested: the inner test reads the outer accessor, inner reads use the next one', () => {
    const code = emit(
      withBody(
        `<div><span r-if="$data.picked"><b r-if="$data.picked.child">{{ $data.picked.child.name }}</b></span></div>`,
      ),
    );
    expect(code).toContain('<Show when={picked()}>{(_rozieWhen0) => <span');
    expect(code).toContain('<Show when={_rozieWhen0().child}>{(_rozieWhen1) => <b');
    expect(code).toContain('_rozieWhen1().name');
  });

  it('mustache body: the callback returns a fragment, never a bare expression', () => {
    const code = emit(
      withBody(
        `<div><slot r-if="$props.label" name="bare" :value="$props.label" :param-types="{ value: 'string' }" /></div>`,
      ),
    );
    expect(code).toMatch(/<Show when=\{local\.label\}>\{\(_rozieWhen0\) => <>\{[\s\S]*?\}<\/>\}<\/Show>/);
    expect(code).toMatch(/get value\(\) \{ return _rozieWhen0\(\); \}/);
  });

  it('r-else sibling: fallback is unchanged and the callback is the child', () => {
    const code = emit(
      withBody(
        `<div><span r-if="$props.label">{{ fmt($props.label) }}</span><span r-else>none</span></div>`,
      ),
    );
    expect(code).toMatch(/<Show when=\{local\.label\} fallback=\{<span[^>]*>none<\/span>\}>\{\(_rozieWhen0\) => <span/);
  });

  it('imports: Show is still imported on the callback path', () => {
    const code = emit(
      withBody(`<div><span r-if="$props.label">{{ fmt($props.label) }}</span></div>`),
    );
    expect(code).toMatch(/import \{[^}]*\bShow\b[^}]*\} from 'solid-js'/);
  });

  it('siblings reuse the accessor name', () => {
    const code = emit(
      withBody(
        `<div><span r-if="$props.label">{{ fmt($props.label) }}</span><b r-if="$data.picked">{{ $data.picked.name }}</b></div>`,
      ),
    );
    expect(code.match(/\(_rozieWhen0\) =>/g)?.length).toBe(2);
    expect(code).not.toContain('_rozieWhen1');
  });

  // ---- exclusions: byte-identical `<Show when={…}>` (no callback) ----

  it('NO-REGRESS: an interpolation-only re-read keeps the plain Show', () => {
    const code = emit(withBody(`<div><span r-if="$props.label">{{ $props.label }}</span></div>`));
    expect(code).toContain('<Show when={local.label}><span');
    expect(code).not.toContain('_rozieWhen');
  });

  it('NO-REGRESS: an HTML-attribute-only re-read keeps the plain Show', () => {
    const code = emit(
      withBody(`<div><span r-if="$props.label" :title="$props.label">x</span></div>`),
    );
    expect(code).toContain('<Show when={local.label}><span');
    expect(code).not.toContain('_rozieWhen');
  });

  it('NO-REGRESS: a handler-only re-read keeps the plain Show', () => {
    const code = emit(
      withBody(`<div><button r-if="$props.label" @click="use($props.label)">x</button></div>`),
    );
    expect(code).toContain('<Show when={local.label}><button');
    expect(code).not.toContain('_rozieWhen');
  });

  it('NO-REGRESS: an optional read keeps the plain Show', () => {
    const code = emit(
      withBody(`<div><span r-if="$props.label">{{ $props.label?.length }}</span></div>`),
    );
    expect(code).toContain('<Show when={local.label}><span');
    expect(code).not.toContain('_rozieWhen');
  });

  it('NO-REGRESS: an author function-call test keeps the plain Show', () => {
    const code = emit(withBody(`<div><span r-if="pick()">{{ pick().name }}</span></div>`));
    expect(code).toContain('<Show when={pick()}><span');
    expect(code).not.toContain('_rozieWhen');
  });

  it('NO-REGRESS: an `&&` test keeps the plain Show', () => {
    const code = emit(
      withBody(
        `<div><span r-if="$data.picked && $data.picked.child">{{ $data.picked.child.name }}</span></div>`,
      ),
    );
    expect(code).toContain('<Show when={picked() && picked().child}><span');
    expect(code).not.toContain('_rozieWhen');
  });

  it('NO-REGRESS: an EB-2 alias chain keeps the fragment ternary (EB-2 wins)', () => {
    const code = emit(
      withBody(
        `<div><template r-for="item, index in $data.list" :key="index"><span r-if="item !== 'gap'">{{ fmt(item) }}</span></template></div>`,
      ),
    );
    expect(code).not.toContain('_rozieWhen');
  });

  it('NO-REGRESS: a keyed-loop item member test keeps the plain Show', () => {
    const code = emit(
      withBody(
        `<div><template r-for="row in $data.rows" :key="row.id"><span r-if="row.ok">{{ fmt(row.ok) }}</span></template></div>`,
      ),
    );
    expect(code).not.toContain('_rozieWhen');
  });

  // ---- inside a gated branch ----

  it('inside a gated branch an event handler keeps the live read and a write stays a setter', () => {
    const code = emit(
      withBody(
        `<div><span r-if="$data.picked">{{ $data.picked.name }}<button @click="use($data.picked.name)">x</button><i @click="$data.picked = null">y</i></span></div>`,
      ),
    );
    expect(code).toContain('{(_rozieWhen0) => <span');
    expect(code).toContain('_rozieWhen0().name');
    const handlers = code.match(/onClick=\{.*?\}(?= data-rozie)/g) ?? [];
    expect(handlers.length).toBe(2);
    expect(handlers.join('')).toContain('use(picked().name)');
    expect(handlers.join('')).toContain('setPicked(null)');
    expect(handlers.join('')).not.toContain('_rozieWhen');
  });

  it('a function-expression body keeps the live read (a callback can outlive the branch)', () => {
    const code = emit(
      withBody(
        `<div><span r-if="$props.label"><Child :p="$props.label" :cb="() => use($props.label)" /></span></div>`,
        CHILD,
      ),
    );
    expect(code).toMatch(/p=\{_rozieWhen0\(\)\}/);
    expect(code).toMatch(/cb=\{\(\) => use\(local\.label\)\}/);
  });

  it('shadowing: a `$computed` root re-bound by a nested r-for alias is not substituted inside the loop', () => {
    const code = emit(
      withBody(
        `<div><span r-if="sel">{{ sel.name }}<template r-for="sel in $data.rows" :key="sel.id"><i>{{ fmt(sel.name) }}</i></template></span></div>`,
      ),
    );
    expect(code).toContain('_rozieWhen0().name');
    expect(code).not.toMatch(/fmt\(_rozieWhen0/);
  });
});
