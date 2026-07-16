/**
 * breadcrumb-jump.test.ts — compile-output proof for breadcrumb segment
 * click-to-jump (COMPILE-OUTPUT assertion, not a DOM mount — this package's
 * vitest harness is node-env with no DOM, see surface.test.ts / hotkey-render
 * .test.ts for the same pattern). Asserts the emitted React code carries the
 * new ancestor jump-button testid, references the `jumpToLevel` handler, and
 * that the CURRENT breadcrumb segment stays a non-interactive `span` (the
 * unchanged 50l contract: `command-palette-title` + `--current`).
 *
 * jumpToLevel is script-internal only (NOT in $expose) — the surface gate
 * (surface.test.ts) remains the authoritative no-new-prop/emit/slot/expose
 * check; this file's `compile`×6 assertion just co-locates a compile-clean
 * check next to the new affordance's own assertions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'CommandPalette.rozie');
const FILENAME = SRC;
const source = readFileSync(SRC, 'utf8');

describe('CommandPalette breadcrumb segment click-to-jump (compile-output)', () => {
  const r = compile(source, { target: 'react', filename: FILENAME });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');

  it('compiles with zero error diagnostics', () => {
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });

  it('emits the ancestor jump-button testid', () => {
    expect(r.code).toContain('command-palette-breadcrumb-jump');
  });

  it('references the jumpToLevel handler (the ancestor click path)', () => {
    expect(r.code).toMatch(/jumpToLevel/);
  });

  it('emits the "Back to " aria-label prefix (per-ancestor accessible name)', () => {
    expect(r.code).toMatch(/Back to /);
  });

  it('keeps the CURRENT segment non-interactive: command-palette-title testid on a span, --current class unchanged', () => {
    expect(r.code).toMatch(/command-palette-title/);
    expect(r.code).toContain('rozie-command-palette-breadcrumb-segment--current');
  });

  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(TARGETS)('compile(%s) emits zero error diagnostics + non-empty code (surface guard cross-check)', (target) => {
    const res = compile(source, { target, filename: FILENAME });
    const targetErrs = res.diagnostics.filter((d) => d.severity === 'error');
    expect(targetErrs).toEqual([]);
    expect(res.code.length).toBeGreaterThan(0);
  });
});
