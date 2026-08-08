/**
 * slotDistributor.test.ts — Quick 260808-iyh (D5) Task 3.
 *
 * Emitted-shape assertions for the `shouldDistributeSlots` gate:
 *   - `ScopedSlotInLoop.rozie` (a `<slot>` nested under `r-for`) trips the
 *     gate: `static shadowRootOptions` with `slotAssignment: 'manual'`, a
 *     `RozieSlotDistributor` class field, and the runtime import.
 *   - The render-prop short-circuit branch (`this.row !== undefined ?
 *     this.row(`) stays byte-identical — the distributor only changes WHICH
 *     light-DOM nodes a `<slot>` receives, never the template shape around it.
 *   - `examples/Card.rozie` (a single non-duplicated, non-looped slot) is the
 *     negative control: the gate stays closed.
 *   - An inline duplicate-name fixture (two literal `<slot name="x">`, no
 *     `r-for` anywhere) trips the gate via the OTHER clause.
 *   - An inline portal-slot fixture (repeated PORTAL slot only) does NOT
 *     trip the gate — portal slots render no `<slot>` element at all.
 *
 * RED-FIRST: `shouldDistributeSlots` does not yet exist and `emitLit.ts`
 * does not yet wire it in, so every gated-positive assertion below fails
 * until Task 3's implementation lands.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../../__tests__/fixtures');
const EXAMPLES = resolve(HERE, '../../../../../../examples');

function compileToLit(source: string, filename: string): string {
  const { ast } = parse(source, { filename });
  if (!ast) throw new Error(`parse() returned null for ${filename}`);
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error(`lowerToIR() returned null for ${filename}`);
  const { code } = emitLit(ir, { filename, source, modifierRegistry: registry });
  return code;
}

function compileFixture(name: string): string {
  const path = resolve(FIXTURES, `${name}.rozie`);
  return compileToLit(readFileSync(path, 'utf8'), `${name}.rozie`);
}

function compileExample(name: string): string {
  const path = resolve(EXAMPLES, `${name}.rozie`);
  return compileToLit(readFileSync(path, 'utf8'), `${name}.rozie`);
}

function compileInline(src: string, filename = 'Inline.rozie'): string {
  return compileToLit(src, filename);
}

describe('shouldDistributeSlots gate — emitted shape (D5)', () => {
  it('ScopedSlotInLoop.rozie (slot nested under r-for) trips the gate', () => {
    const code = compileFixture('ScopedSlotInLoop');
    expect(code).toContain('static shadowRootOptions');
    expect(code).toContain("slotAssignment: 'manual'");
    expect(code).toContain('new RozieSlotDistributor(this)');
    expect(code).toMatch(/import\s*\{[^}]*RozieSlotDistributor[^}]*\}\s*from\s*'@rozie\/runtime-lit'/);
  });

  it('ScopedSlotInLoop.rozie keeps the render-prop short-circuit branch byte-identical', () => {
    const code = compileFixture('ScopedSlotInLoop');
    expect(code).toContain('this.row !== undefined ? this.row(');
  });

  it('examples/Card.rozie (single non-duplicated, non-looped slot) — gate stays CLOSED', () => {
    const code = compileExample('Card');
    expect(code).not.toContain('slotAssignment');
    expect(code).not.toContain('RozieSlotDistributor');
    expect(code).not.toContain('static shadowRootOptions');
  });

  it('duplicate-name control: two literal <slot name="x"> with no r-for trips the gate', () => {
    const src = `<rozie name="DuplicateNamedSlots">
<template>
<div>
  <header><slot name="x"></slot></header>
  <footer><slot name="x"></slot></footer>
</div>
</template>
</rozie>`;
    const code = compileInline(src);
    expect(code).toContain('static shadowRootOptions');
    expect(code).toContain("slotAssignment: 'manual'");
    expect(code).toContain('new RozieSlotDistributor(this)');
  });

  it('portal-slot control: a portal slot nested under r-for does NOT trip the gate', () => {
    // Structurally identical to ScopedSlotInLoop.rozie's inLoop shape, but
    // `portal` — portal slots render no <slot> element at all (Phase 37 /
    // Spike 003: they lower to a script-callable $portals.<key> closure),
    // so shouldDistributeSlots must filter them out before either clause
    // runs.
    const src = `<rozie name="PortalOnlyLoop">
<props>{ items: { type: Array, default: () => [] } }</props>
<template>
<ul>
  <li r-for="item, i in $props.items" :key="i">
    <slot name="row" portal :params="['item']" />
  </li>
</ul>
</template>
</rozie>`;
    const code = compileInline(src);
    expect(code).not.toContain('slotAssignment');
    expect(code).not.toContain('RozieSlotDistributor');
  });
});
