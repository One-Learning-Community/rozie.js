/**
 * EB-2 (quick 261019-9g1) — Solid narrows a raw r-for item inside r-if branches.
 *
 * `<Show when={item !== 'gap'}>` does NOT narrow `item` inside its children: `when`
 * is not a type guard, so a union alias (`number | 'gap'`) fed to a slot param
 * typed `number` is a strict-tsc TS2322 on Solid alone (React's `&&`, Lit's
 * ternary, Vue's v-if and Svelte's {#if} all narrow).
 *
 * Fix: when the chain sits inside a keyless `<For>` and a branch test reads the
 * raw item alias, lower the chain to a JSX conditional wrapped in a FRAGMENT,
 * `<>{(test) ? A : B}</>`, instead of `<Show>`. A bare ternary returned from the
 * `<For>` callback is evaluated once, untracked (a signal read in the test would
 * stop updating); inside a fragment babel-preset-solid compiles the dynamic
 * child to `_$memo(() => _$memo(() => !!(test))() ? a : null)` — the same
 * truthiness-gated memo `<Show>` uses. A row-constant test (alias and literals
 * only) compiles to a static ternary, equivalent because a keyless `<For>` row's
 * item never changes.
 *
 * Everything else keeps the byte-identical `<Show>` output: keyed `<Key>` loops
 * (accessor item), conditionals outside a loop, keyless loops whose tests do not
 * read the alias, and a member PROPERTY that merely shares the alias name.
 */
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../emitSolid.js';

function lowerInline(source: string): IRComponent {
  const result = parse(source, { filename: 'Narrow.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

function emit(source: string): string {
  const ir = lowerInline(source);
  return emitSolid(ir, { filename: 'Narrow.rozie', source }).code;
}

const PROPS = `<props>{ items: { type: Array, default: () => [] }, show: { type: Boolean, default: true } }</props>`;

function withBody(body: string, extraData = ''): string {
  return `<rozie name="Narrow">
${PROPS}
${extraData}
<template>
${body}
</template>
</rozie>`;
}

describe('emitConditional (Solid) — raw r-for alias narrowing (EB-2)', () => {
  it('keyless loop: r-if on the alias lowers to a fragment-wrapped conditional, no Show', () => {
    const code = emit(
      withBody(
        `<div><template r-for="item, index in $props.items" :key="index"><span r-if="item !== 'gap'">{{ item }}</span></template></div>`,
      ),
    );
    expect(code).toContain(`<>{(item !== 'gap') ? <span`);
    expect(code).toContain(`: null}</>`);
    expect(code).not.toContain('<Show');
    expect(code).not.toMatch(/import \{[^}]*\bShow\b[^}]*\} from 'solid-js'/);
  });

  it('chain: r-if / r-else-if / r-else is ONE nested conditional in one fragment', () => {
    const code = emit(
      withBody(
        `<div><template r-for="item, index in $props.items" :key="index"><b r-if="item === 'a'">A</b><i r-else-if="item === 'b'">B</i><u r-else>C</u></template></div>`,
      ),
    );
    expect(code).toMatch(
      /<>\{\(item === 'a'\) \? <b[^>]*>A<\/b> : \(item === 'b'\) \? <i[^>]*>B<\/i> : <u[^>]*>C<\/u>\}<\/>/,
    );
    expect(code).not.toContain('<Show');
  });

  it('chain without r-else terminates in null', () => {
    const code = emit(
      withBody(
        `<div><template r-for="item, index in $props.items" :key="index"><b r-if="item === 'a'">A</b><i r-else-if="item === 'b'">B</i></template></div>`,
      ),
    );
    expect(code).toMatch(/\(item === 'a'\) \? <b[^>]*>A<\/b> : \(item === 'b'\) \? <i[^>]*>B<\/i> : null\}<\/>/);
  });

  it('mixed alias + signal test takes the narrowing path (the fragment keeps it reactive)', () => {
    const code = emit(
      withBody(
        `<div><template r-for="item, index in $props.items" :key="index"><span r-if="item !== 'gap' && $props.show">x</span></template></div>`,
      ),
    );
    expect(code).toContain(`<>{(item !== 'gap' && local.show) ? <span`);
    expect(code).not.toContain('<Show');
  });

  it('operand rule: a balanced-mustache branch body (slot invocation) becomes a parenthesized operand', () => {
    const code = emit(
      withBody(
        `<div><template r-for="x in $props.items"><slot r-if="x" :name="x" /></template></div>`,
      ),
    );
    expect(code).toContain('{(x) => <>{(x) ? (_props.slots?.[x]?.()) : null}</>}');
  });

  it('operand rule: a static-text branch body (an unwrapped <template r-case> host) is wrapped in a fragment', () => {
    // quick 261019-ti9 (DC-1) — REACHABLE from authored markup: core unwraps a
    // `<template r-case>` / `<template r-default>` host into its children, so a
    // text-only branch body reaches `toTernaryOperand` as bare static text. Without
    // the `<>…</>` wrap the operand would be the bare identifier `alpha` (invalid).
    const code = emit(
      withBody(
        `<div><template r-for="x, i in $props.items" :key="i"><template r-match="x"><template r-case="'a'">alpha</template><template r-default>other</template></template></template></div>`,
      ),
    );
    expect(code).toContain(`<>{(x === 'a') ? <>alpha</> : <>other</>}</>`);
  });

  it('operand rule: an element body (including a <template> wrapper) is used as-is', () => {
    const code = emit(
      withBody(
        `<div><template r-for="item, index in $props.items" :key="index"><template r-if="item === 'a'">hello</template></template></div>`,
      ),
    );
    expect(code).toMatch(/\(item === 'a'\) \? <template[^>]*>hello<\/template> : null/);
  });

  it('NO-REGRESS: r-if inside a keyed loop (Key, accessor item) keeps Show', () => {
    const code = emit(
      withBody(
        `<div><template r-for="row in $props.items" :key="row.id"><span r-if="row.ok">x</span></template></div>`,
      ),
    );
    expect(code).toContain('<Show when={row().ok}>');
  });

  it('NO-REGRESS: r-if outside any loop keeps Show', () => {
    const code = emit(withBody(`<div><span r-if="$props.show">x</span></div>`));
    expect(code).toContain('<Show when={local.show}>');
    expect(code).toMatch(/import \{[^}]*\bShow\b[^}]*\} from 'solid-js'/);
  });

  it('NO-REGRESS: keyless loop whose test reads only props keeps Show', () => {
    const code = emit(
      withBody(
        `<div><template r-for="item, index in $props.items" :key="index"><span r-if="$props.show">{{ item }}</span></template></div>`,
      ),
    );
    expect(code).toContain('<Show when={local.show}>');
  });

  it('NO-REGRESS: a member PROPERTY that shares the alias name does not trigger narrowing', () => {
    const code = emit(
      withBody(
        `<div><template r-for="item, index in $props.items" :key="index"><span r-if="$props.show.item">x</span></template></div>`,
      ),
    );
    expect(code).toContain('<Show when={');
    expect(code).not.toContain('<>{(');
  });
});
