/**
 * slotsPresenceRecord.test.ts — `$slots.X` for a scoped slot is true when the
 * slot is filled through ANY channel the producer renders from:
 *   - light-DOM children (`_hasSlot<X>`),
 *   - the named property a Rozie consumer sets (`this.X`, or
 *     `this.__rozieDefaultSlot__` for the default slot),
 *   - the `rozieSlots` record a non-Rozie Lit consumer sets
 *     (`rozieSlots['X']`, `rozieSlots['default']` for the default slot).
 *
 * Before: the record was ignored, so a record-only fill of an
 * `r-if="$slots.X"`-gated slot rendered nothing (command-palette's `icon` /
 * `actions` / `trailing`, the Modal fixture's header / footer). Both
 * rewriters (template expressions and `<script>`) are covered.
 *
 * The scoped DEFAULT slot: the scoped-name set was keyed by the slot name
 * ('' for the default slot) while `$slots.default` reads 'default', so its
 * check never consulted `__rozieDefaultSlot__`. Rozie source cannot write
 * `$slots.default` today (ROZ103: the default slot is bound as ''), so that
 * case drives the rewriters directly with a lowered IR.
 */
import { describe, expect, it } from 'vitest';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { parse as babelParse, parseExpression } from '@babel/parser';
import { rewriteTemplateExpression } from '../../rewrite/rewriteTemplateExpression.js';
import { rewriteScript } from '../../rewrite/rewriteScript.js';
import _generate from '@babel/generator';

const generate = ((_generate as unknown as { default?: typeof _generate }).default ?? _generate) as typeof _generate;

const SRC = `<rozie name="GatedSlots">
<props>
{
  items: { type: Array, default: () => [] },
}
</props>
<script>
const hasIcon = () => $slots.icon
</script>
<template>
<div>
  <span r-if="$slots.icon" class="icon"><slot name="icon" :size="16"></slot></span>
  <ul>
    <li r-for="item in $props.items" :key="item"><slot :item="item"></slot></li>
  </ul>
  <p>{{ hasIcon() }}</p>
</div>
</template>
</rozie>
`;

const norm = (s: string) => s.replace(/"/g, "'").replace(/\s+/g, ' ');

function ir() {
  const { ast } = parse(SRC, { filename: 'GatedSlots.rozie' });
  return lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
}

describe('$slots presence for scoped slots includes the rozieSlots record', () => {
  it('a named scoped slot (compiled): light DOM, named property, or record — template r-if and script', () => {
    const r = compile(SRC, { target: 'lit', filename: 'GatedSlots.rozie', sourceMap: false });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const c = norm(r.code);
    const check = "this._hasSlotIcon || this.icon !== undefined || this.rozieSlots?.['icon'] !== undefined";
    expect(c.split(check).length - 1).toBe(2);
  });

  it('template rewriter: the scoped default slot checks __rozieDefaultSlot__ and rozieSlots.default', () => {
    const out = norm(rewriteTemplateExpression(parseExpression('$slots.default'), ir()));
    expect(out).toContain(
      "this._hasSlotDefault || this.__rozieDefaultSlot__ !== undefined || this.rozieSlots?.['default'] !== undefined",
    );
  });

  it('script rewriter: the scoped default slot checks __rozieDefaultSlot__ and rozieSlots.default', () => {
    const file = babelParse('const hasRows = () => $slots.default;', { sourceType: 'module' });
    const res = rewriteScript(file, ir());
    const out = norm(generate(res.file).code);
    expect(out).toContain(
      "this._hasSlotDefault || this.__rozieDefaultSlot__ !== undefined || this.rozieSlots?.['default'] !== undefined",
    );
  });
});
