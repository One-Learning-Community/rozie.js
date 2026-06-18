/**
 * angular-stop-handler-in-loop — regression coverage for the Angular guarded-
 * event-handler emit inside an `r-for`/`@for` loop.
 *
 * Root cause (pre-fix): EVERY inlineGuard-bearing handler (`.stop`, `.prevent`,
 * `.self`, key filters) was hoisted into a class-field arrow
 * `private _guardedN = ($event) => { <guard>; <handler>; }`. That arrow body runs
 * in CLASS scope, so (a) a template `@for` loop variable (`header`) is undeclared
 * → `ReferenceError`, and (b) a non-colliding top-level user handler
 * (`const onPick = () => {}`) was referenced BARE (not `this.onPick`) because
 * `applyThisPrefixing`'s member set excluded top-level `<script>` bindings →
 * `ReferenceError: onPick is not defined`. A guard with no resolvable target also
 * emitted `this.undefined($event)`.
 *
 * Fix: Angular event bindings are STATEMENTS supporting `;` chains, so a
 * side-effect-only guard pipeline (`.stop` / `.prevent`) is emitted INLINE in the
 * `(event)=` template binding, where bare members auto-resolve against `this` AND
 * `@for` loop variables are visible. Early-return guards (`.self` / key filters →
 * `if (C) return;`) cannot be a template statement, so they keep the hoist — now
 * with top-level `<script>` bindings included in the `this.`-prefix member set,
 * and an explicit ROZ723 diagnostic when a hoisted early-return guard references
 * the loop variable (the residual a class-field arrow truly cannot express).
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../../emitAngular.js';

function emit(src: string) {
  const { ast } = parse(src, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return emitAngular(ir, { filename: 'Test.rozie', source: src });
}

const PROLOGUE = '<rozie name="Test">';

describe('angular-stop-handler-in-loop — guarded handlers in @for loops', () => {
  it('.stop inside a loop emits INLINE in template scope (loop var + bare member resolve)', () => {
    const r = emit(`${PROLOGUE}
<data>
const items = [{ id: 1 }];
</data>
<template>
  <li r-for="header in items">
    <button @click.stop="onPick(header.id)">pin</button>
  </li>
</template>
<script>
const onPick = (id) => { console.log(id); };
</script>
</rozie>`);
    // Inline statement chain — no class-field wrapper.
    expect(r.code).toContain(
      '(click)="$event.stopPropagation(); onPick(header.id)"',
    );
    // No hoisted wrapper for a side-effect-only guard.
    expect(r.code).not.toMatch(/_guarded\w*\s*=\s*\(\$event/);
    // No undefined-target miss.
    expect(r.code).not.toContain('this.undefined');
    // No diagnostic — side-effect guard is fully expressible inline.
    expect(r.diagnostics.filter((d) => d.code === 'ROZ723')).toHaveLength(0);
  });

  it('.prevent inside a loop emits INLINE', () => {
    const r = emit(`${PROLOGUE}
<data>
const rows = [{ id: 1 }];
</data>
<template>
  <li r-for="row in rows">
    <form @submit.prevent="save(row.id)"><button>go</button></form>
  </li>
</template>
<script>
const save = (id) => {};
</script>
</rozie>`);
    expect(r.code).toContain('(submit)="$event.preventDefault(); save(row.id)"');
    expect(r.diagnostics.filter((d) => d.code === 'ROZ723')).toHaveLength(0);
  });

  it('.stop.prevent (multiple side-effect guards) chain inline in source order', () => {
    const r = emit(`${PROLOGUE}
<template>
  <a @click.stop.prevent="go()">x</a>
</template>
<script>
const go = () => {};
</script>
</rozie>`);
    expect(r.code).toContain(
      '(click)="$event.stopPropagation(); $event.preventDefault(); go()"',
    );
  });

  it('early-return guard (.self) keeps the hoist and this-prefixes a top-level user fn', () => {
    const r = emit(`${PROLOGUE}
<template>
  <div @click.self="onBare()">x</div>
</template>
<script>
const onBare = () => {};
</script>
</rozie>`);
    // Still hoisted (if/return is not a valid Angular template statement).
    expect(r.code).toMatch(/private _guarded\w* = \(\$event: any\) => \{/);
    expect(r.code).toContain('if ($event.target !== $event.currentTarget) return;');
    // Top-level user fn correctly prefixed with `this.` inside the wrapper.
    expect(r.code).toContain('this.onBare()');
    expect(r.code).not.toContain('this.undefined');
  });

  it('ROZ723 fires when a hoisted early-return guard references the loop var', () => {
    const r = emit(`${PROLOGUE}
<data>
const items = [{ id: 1 }];
</data>
<template>
  <li r-for="header in items">
    <button @click.self="onPick(header.id)">x</button>
  </li>
</template>
<script>
const onPick = (id) => {};
</script>
</rozie>`);
    const roz723 = r.diagnostics.filter((d) => d.code === 'ROZ723');
    expect(roz723).toHaveLength(1);
    expect(roz723[0]!.severity).toBe('error');
    expect(roz723[0]!.message).toContain("'header'");
  });

  it('merged same-event with a .stop guard does not mangle the member call', () => {
    // R6 same-event merge folds each handler into a `_merged_<event>_N` class
    // wrapper. The merger `this.`-prefixes bare calls — but must NOT touch the
    // inlined side-effect guard's MEMBER call (`$event.stopPropagation()`),
    // which would otherwise become `$event.this.stopPropagation()`.
    const r = emit(`<rozie name="Test" inherit-listeners="false" inherit-attrs="false">
<template>
  <button @click.stop="f1" @click="f2">x</button>
</template>
<script>
const f1 = () => {};
const f2 = () => {};
</script>
</rozie>`);
    expect(r.code).toContain('$event.stopPropagation(); this.f1();');
    expect(r.code).toContain('this.f2();');
    expect(r.code).not.toContain('$event.this.stopPropagation');
  });

  it('early-return guard NOT referencing the loop var does not fire ROZ723', () => {
    const r = emit(`${PROLOGUE}
<data>
const items = [{ id: 1 }];
</data>
<template>
  <li r-for="header in items">
    <button @click.self="onBare()">x</button>
  </li>
</template>
<script>
const onBare = () => {};
</script>
</rozie>`);
    expect(r.diagnostics.filter((d) => d.code === 'ROZ723')).toHaveLength(0);
    expect(r.code).toContain('this.onBare()');
  });
});
