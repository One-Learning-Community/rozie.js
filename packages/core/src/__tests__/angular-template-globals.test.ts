// Item 2 (Angular template global-identifier exposure) — Angular template
// expressions implicitly bind every bare identifier to the component instance
// (`ctx.Number`), so a JS global is unreachable unless the component exposes it
// as a member. The emitter scans the emitted template for known globals and
// emits `protected readonly <g> = <g>;` per used global.
//
// The bug: detection matched ONLY the namespace/member form `Global.` (e.g.
// `Math.round`), missing the CALL form `Global(...)` (`Number($data.x)`,
// `parseInt(...)`), so a callable global in a binding/listener slipped through
// → `ctx.Number(...)` undefined → render abort (the SortableListShowcase·angular
// blank-subtree). Fixed: detection now matches `.` AND `(`, and the allowlist
// gained the bare callable globals (parseInt/isNaN/…).
import { describe, it, expect } from 'vitest';
import { compile } from '../index.js';

function exposed(code: string): string[] {
  return [...code.matchAll(/protected readonly (\w+) = \1;/g)].map((m) => m[1]!);
}

describe('Angular template global exposure (Item 2)', () => {
  it('exposes a callable global used in CALL form in an attribute binding', async () => {
    const src = `<rozie name="G">
<data>{ n: 2 }</data>
<template><input type="range" :max="Number($data.n)" /></template>
</rozie>`;
    const out = await compile(src, { target: 'angular', filename: 'G.rozie' });
    expect(out.diagnostics.some((d) => d.severity === 'error')).toBe(false);
    expect(exposed(out.code)).toContain('Number');
    // The binding references the (now-resolvable) global.
    expect(out.code).toContain('Number(n())');
  });

  it('exposes namespace + callable + listener globals together', async () => {
    const src = `<rozie name="G">
<data>{ n: 2 }</data>
<script>function pick(x){ return x }</script>
<template>
  <input :max="Number($data.n)" :step="Math.round(1.4)" @input="pick(parseInt($event.target.value))" />
</template>
</rozie>`;
    const out = await compile(src, { target: 'angular', filename: 'G.rozie' });
    const names = exposed(out.code);
    expect(names).toEqual(expect.arrayContaining(['Number', 'Math', 'parseInt']));
  });

  it('does not expose a global that is not used', async () => {
    const src = `<rozie name="G">
<data>{ n: 2 }</data>
<template><span>{{ $data.n }}</span></template>
</rozie>`;
    const out = await compile(src, { target: 'angular', filename: 'G.rozie' });
    expect(exposed(out.code)).not.toContain('Number');
    expect(exposed(out.code)).not.toContain('Math');
  });

  it('does not false-match a member-suffixed identifier (customNumber)', async () => {
    const src = `<rozie name="G">
<script>const customNumber = { val: () => 5 }</script>
<template><span>{{ customNumber.val() }}</span></template>
</rozie>`;
    const out = await compile(src, { target: 'angular', filename: 'G.rozie' });
    expect(exposed(out.code)).not.toContain('Number');
  });
});
