// Quick 260829-cd4 (RED-first) — pins the three `$portals` failure shapes
// from `.planning/notes/class-a-sigil-scoping.md` §1 on the Lit target:
//
//   Probe A — top-level (class-field arrow) helper reads `$portals.body(...)`,
//             called from `$onMount`.
//   Probe B — top-level helper reads `$portals.body(...)`, NO `$onMount` at all.
//   Probe C — a top-level `$watch` CALLBACK reads `$portals.body(...)`, no
//             other lifecycle hook.
//
// Like Angular, Lit's `firstUpdated()` (and `disconnectedCallback()`) are
// emitted UNCONDITIONALLY whenever the component has portals (`mountSegments`
// / `unmountSegments` always carry the portal closure / dispose block), so
// the closure is never "dropped entirely" — it is declared in the WRONG
// scope (inside `firstUpdated()`, invisible to a class-field arrow helper
// reading it as a bare `portals` identifier).
//
// Assertion per probe: a `portals` field declaration exists OUTSIDE
// `firstUpdated()`'s body, and the user reference lowers to a
// `this.`-qualified member read (`this.portals.body(`).
//
// PASSING CONTROL: `examples/PortalList.rozie` (see the React sibling test
// for why `PortalOverlay.rozie` is NOT the right control fixture).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');

function compileSource(src: string, filename: string): { code: string; ir: IRComponent } {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  const ir: IRComponent = lowered.ir;
  const { code, diagnostics } = emitLit(ir, { filename, source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return { code, ir };
}

function compileFixture(filename: string): { code: string; ir: IRComponent } {
  const full = resolve(REPO_ROOT, filename);
  const src = readFileSync(full, 'utf8');
  return compileSource(src, full);
}

/**
 * Extract the balanced-brace body of `methodName() { ... }` from emitted
 * class source. Returns null when the method is not present.
 */
function extractMethodBody(code: string, methodSignature: string): string | null {
  const startIdx = code.indexOf(methodSignature);
  if (startIdx === -1) return null;
  const braceStart = code.indexOf('{', startIdx);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return code.slice(braceStart + 1, i);
    }
  }
  return null;
}

const PROBE_A = `<rozie name="ProbeA">
<props>{ n: { type: Number, default: 0 } }</props>
<script>
const mountBody = (host) => { return $portals.body(host, {}) }
$onMount(() => { mountBody($refs.hostEl) })
</script>
<template>
<div ref="hostEl"></div>
<slot name="body" portal reactive />
</template>
</rozie>`;

const PROBE_B = `<rozie name="ProbeB">
<props>{ n: { type: Number, default: 0 } }</props>
<script>
const mountBody = (host) => { return $portals.body(host, {}) }
</script>
<template>
<div ref="hostEl"></div>
<slot name="body" portal reactive />
</template>
</rozie>`;

const PROBE_C = `<rozie name="ProbeC">
<props>{ n: { type: Number, default: 0 } }</props>
<script>
let h = null
$watch(() => $props.n, (v) => { h = $portals.body($refs.hostEl, {}) })
</script>
<template>
<div ref="hostEl"></div>
<slot name="body" portal reactive />
</template>
</rozie>`;

/**
 * Shared assertion: a `portals` field declaration exists OUTSIDE the
 * `firstUpdated()` body (class-field scope), and it does NOT appear inside
 * `firstUpdated()`'s own body text.
 */
function assertPortalsAtClassScope(code: string, label: string): void {
  const firstUpdatedBody = extractMethodBody(code, 'firstUpdated()');
  expect(firstUpdatedBody, `${label}: expected firstUpdated() to be emitted`).not.toBeNull();
  expect(
    firstUpdatedBody?.includes('const portals = {') ?? false,
    `${label}: portals closure must NOT be declared inside firstUpdated()`,
  ).toBe(false);
  const bodyStripped = firstUpdatedBody ? code.replace(firstUpdatedBody, '') : code;
  expect(
    /(?:private\s+)?portals\s*=\s*\{/.test(bodyStripped),
    `${label}: expected a class-field "portals = {" declaration outside firstUpdated()`,
  ).toBe(true);
}

describe('Lit — $portals closure at class-field scope (quick 260829-cd4)', () => {
  it('Probe A — top-level (class-field arrow) helper called from $onMount', () => {
    const { code } = compileSource(PROBE_A, 'ProbeA.rozie');
    assertPortalsAtClassScope(code, 'Probe A');
    expect(code).toContain('this.portals.body(');
  });

  it('Probe B — class-field arrow helper, NO $onMount at all', () => {
    const { code } = compileSource(PROBE_B, 'ProbeB.rozie');
    assertPortalsAtClassScope(code, 'Probe B');
    expect(code).toContain('this.portals.body(');
  });

  it('Probe C — $watch body reads $portals, no other lifecycle hook', () => {
    const { code } = compileSource(PROBE_C, 'ProbeC.rozie');
    assertPortalsAtClassScope(code, 'Probe C');
    expect(code).toContain('this.portals.body(');
  });

  it('PASSING CONTROL — PortalList.rozie: in-$onMount $portals.item(...) still resolves', () => {
    const { code } = compileFixture('examples/PortalList.rozie');
    expect(code).toMatch(/portals\s*=\s*\{/);
    expect(code).toContain('portals.item(');
    expect(code).toContain('firstUpdated()');
  });
});
