/**
 * renderPropsInterface.test.ts — 86-REVIEW CR-01 RED-first fixture.
 *
 * `ir.slots` holds one `SlotDecl` per `<slot>` OCCURRENCE, not one per
 * distinct name (see `lowerSlots.ts`'s `visit()` — there is no same-name
 * top-level dedup there, only a top-level-vs-nested one). A component that
 * repeats the same named slot across several mutually-exclusive `r-if`
 * render branches — Combobox's plain/grouped/grouped+capped/windowed shape
 * is the real-world case this reproduces — used to make
 * `renderPropsInterface` emit ONE `render<Slot>?: ...` line per occurrence,
 * minting a duplicate-identifier (TS2300) PUBLIC `.d.ts`/`.d.rozie.ts`.
 *
 * Confirmed via a direct `tsc --strict` run against the committed
 * `@rozie-ui/combobox-react` `.d.ts` before this fix: `renderOption`×4,
 * `renderEmpty`×4, `renderCreate`×4, `renderGroupHeading`×2 — 14 duplicates.
 *
 * This fixture reproduces the minimal shape: a slot named `option` declared
 * inside two mutually-exclusive `r-if` branches, plus a `children` default
 * slot repeated the same way, proving the fix dedupes both the named-slot
 * and the default-slot render-field cases.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../../ir/lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { renderPropsInterface } from '../renderPropsInterface.js';

function irFor(src: string) {
  const { ast } = parse(src, { filename: 'Probe.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return ir;
}

const SRC = `<rozie name="Probe">
<props>
{
  mode: { type: String, default: 'a' },
}
</props>
<template>
<div>
  <ul r-if="$props.mode === 'a'">
    <li><slot name="option" :label="'x'">{{ 'x' }}</slot></li>
  </ul>
  <ul r-if="$props.mode === 'b'">
    <li><slot name="option" :label="'y'">{{ 'y' }}</slot></li>
  </ul>
  <ul r-if="$props.mode === 'c'">
    <li><slot>default a</slot></li>
  </ul>
  <ul r-if="$props.mode === 'd'">
    <li><slot>default b</slot></li>
  </ul>
</div>
</template>
</rozie>`;

describe('renderPropsInterface — 86-REVIEW CR-01 slot dedup across mutually-exclusive branches', () => {
  it('emits exactly ONE renderOption field when the same named slot repeats across r-if branches', () => {
    const ir = irFor(SRC);
    // Sanity: the IR itself really does carry one SlotDecl per occurrence —
    // this is the actual defect surface, not an artifact of the fixture.
    expect(ir.slots.filter((s) => s.name === 'option').length).toBe(2);

    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode', target: 'react' });
    const renderOptionMatches = out.match(/^\s*renderOption\?:/gm) ?? [];
    expect(renderOptionMatches.length).toBe(1);
  });

  it('emits exactly ONE children field when the default slot repeats across r-if branches', () => {
    const ir = irFor(SRC);
    expect(ir.slots.filter((s) => s.name === '').length).toBe(2);

    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode', target: 'react' });
    const childrenMatches = out.match(/^\s*children\?:/gm) ?? [];
    expect(childrenMatches.length).toBe(1);
  });

  it('the emitted interface has no duplicate property identifiers at all (grep-level TS2300 guard)', () => {
    const ir = irFor(SRC);
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode', target: 'react' });
    const fieldNames = [...out.matchAll(/^\s*([A-Za-z_$][\w$]*)\??:/gm)].map((m) => m[1]);
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const name of fieldNames) {
      if (seen.has(name)) dupes.push(name);
      seen.add(name);
    }
    expect(dupes).toEqual([]);
  });
});
