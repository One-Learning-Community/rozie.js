/**
 * template-native-modifier-options.test.ts — Angular target.
 *
 * `.capture` / `.passive` / `.once` on a TEMPLATE `@event` used to be rejected
 * with ROZ722 ("Move this modifier to a <listeners> block"). Angular's
 * `(event)` binding cannot carry addEventListener options, so the emitter now
 * routes such a listener through the `RozieListen` directive from
 * `@rozie/runtime-angular`:
 *
 *   [rozieOn<N>]="'<event>'" [rozieOn<N>Options]="{ capture: true, ... }"
 *   (rozieOn<N>Fire)="<the exact statement today's (event) binding carries>"
 *
 * The directive attaches the native listener with the options and re-emits
 * the native event through the `rozieOn<N>Fire` output, so the handler stays a
 * TEMPLATE statement: `$event` is the DOM event, `@for` loop variables are in
 * scope, and guard/handler lowering is unchanged — only the attach mechanism
 * differs.
 */
import type { Diagnostic } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

function compile(src: string): { code: string; diagnostics: Diagnostic[] } {
  const registry = createDefaultRegistry();
  const result = parse(src, { filename: 'X.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: registry });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  return emitAngular(lowered.ir, { filename: 'X.rozie', source: src, modifierRegistry: registry });
}

function errors(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => d.severity === 'error');
}

function wrap(template: string, script = 'const onKey = (e) => {}\nconst other = (e) => {}'): string {
  return `<rozie name="X">
<data>{ items: [] }</data>
<script>
${script}
</script>
<template>
${template}
</template>
</rozie>`;
}

describe('Angular template @event .capture/.passive/.once', () => {
  it('.capture.once on a plain element: no error, RozieListen slot binding, directive imported', () => {
    const { code, diagnostics } = compile(wrap(`<div @keydown.capture.once="onKey"></div>`));
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toContain(
      `[rozieOn0]="'keydown'" [rozieOn0Options]="{ capture: true, once: true }" (rozieOn0Fire)="onKey($event)"`,
    );
    expect(code).not.toContain('(keydown)=');
    expect(code).toMatch(/import \{[^}]*\bRozieListen\b[^}]*\} from '@rozie\/runtime-angular';/);
    expect(code).toMatch(/imports: \[[^\]]*\bRozieListen\b/);
  });

  it('each option alone maps to its flag', () => {
    for (const opt of ['capture', 'passive', 'once'] as const) {
      const { code, diagnostics } = compile(wrap(`<div @wheel.${opt}="onKey"></div>`));
      expect(errors(diagnostics)).toEqual([]);
      expect(code).toContain(
        `[rozieOn0]="'wheel'" [rozieOn0Options]="{ ${opt}: true }" (rozieOn0Fire)="onKey($event)"`,
      );
    }
  });

  it('combines with inline side-effect guards (.stop/.prevent) exactly like (event)', () => {
    const { code, diagnostics } = compile(wrap(`<div @click.stop.prevent.capture="onKey"></div>`));
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toContain(
      `[rozieOn0]="'click'" [rozieOn0Options]="{ capture: true }" (rozieOn0Fire)="$event.stopPropagation(); $event.preventDefault(); onKey($event)"`,
    );
  });

  it('combines with hoisted early-return guards (.self / key filters)', () => {
    const { code, diagnostics } = compile(wrap(`<input @keydown.enter.once="onKey" />`));
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toMatch(/\(rozieOn0Fire\)="_guardedOnKey(_\d+)?\(\$event\)"/);
    expect(code).toContain(`if ($event.key !== 'Enter') return;`);
    expect(code).toContain(`[rozieOn0Options]="{ once: true }"`);
  });

  it('combines with .debounce(ms)', () => {
    const { code, diagnostics } = compile(wrap(`<input @input.debounce(300).passive="onKey" />`));
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toMatch(/\(rozieOn0Fire\)="debouncedOnKey(_\d+)?\(\$event\)"/);
    expect(code).toContain(`[rozieOn0]="'input'" [rozieOn0Options]="{ passive: true }"`);
    expect(code).toMatch(/protected debouncedOnKey(_\d+)? = \(\(\) => \{/);
  });

  it('inside r-for: loop variables and $event stay in template scope', () => {
    const { code, diagnostics } = compile(
      wrap(
        `<ul><li r-for="item in $data.items" :key="item" @click.once="pick(item, $event)">{{ item }}</li></ul>`,
        'const pick = (item, e) => {}',
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toContain(
      `[rozieOn0]="'click'" [rozieOn0Options]="{ once: true }" (rozieOn0Fire)="pick(item, $event)"`,
    );
  });

  it('same event with and without options on one element, plus a second option listener', () => {
    const { code, diagnostics } = compile(
      wrap(`<div @keydown="other" @keydown.capture="onKey" @click.passive="other"></div>`),
    );
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toContain(`(keydown)="other($event)"`);
    expect(code).toContain(
      `[rozieOn0]="'keydown'" [rozieOn0Options]="{ capture: true }" (rozieOn0Fire)="onKey($event)"`,
    );
    expect(code).toContain(
      `[rozieOn1]="'click'" [rozieOn1Options]="{ passive: true }" (rozieOn1Fire)="other($event)"`,
    );
  });

  it('root element keeps its spread/listener-fallthrough refs alongside the slot binding', () => {
    const { code, diagnostics } = compile(wrap(`<div class="root" @keydown.capture="onKey"><span>x</span></div>`));
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toMatch(/<div[^>]*#rozieSpread_\d+[^>]*>/);
    expect(code).toMatch(/<div[^>]*\[rozieOn0\]="'keydown'"[^>]*>/);
    expect(code).toContain('(rozieOn0Fire)="onKey($event)"');
  });

  it('component tag: @event.capture keeps the pre-existing ROZ722 (an Angular output has no listener options)', () => {
    const src = `<rozie name="X">
<components>{ Child: "./Child.rozie" }</components>
<script>
const onKey = (e) => {}
</script>
<template>
<Child @change.capture="onKey" />
</template>
</rozie>`;
    const { code, diagnostics } = compile(src);
    expect(errors(diagnostics).map((d) => d.code)).toEqual(['ROZ722']);
    expect(code).toContain('(change)="onKey($event)"');
    expect(code).not.toContain('rozieOn0');
  });

  it('plain listeners without options do NOT pull in RozieListen (byte-stable)', () => {
    const { code } = compile(wrap(`<div @keydown.stop="onKey"></div>`));
    expect(code).not.toContain('RozieListen');
    expect(code).not.toContain('rozieOn0');
  });

  it('.outside stays rejected on a template @event (listenerOnly helper)', () => {
    const { diagnostics } = compile(wrap(`<div @click.outside="onKey"></div>`));
    expect(errors(diagnostics).map((d) => d.code)).toContain('ROZ722');
  });
});
