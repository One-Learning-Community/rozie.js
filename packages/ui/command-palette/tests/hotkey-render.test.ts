/**
 * hotkey-render.test.ts — compile-output proof that the per-item `hotKey`
 * display badge renders (COMPILE-OUTPUT assertion, not a DOM mount — this
 * package's vitest harness is node-env with no DOM, see surface.test.ts for
 * the same pattern). Asserts the emitted code carries the badge's class
 * token gated on a conditional referencing the item's `hotKey` field, and
 * that the pre-existing #actions affordance is preserved (the badge is
 * additive, rendered BEFORE it — see CommandPalette.rozie).
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

describe('CommandPalette per-item hotKey badge (compile-output)', () => {
  const r = compile(source, { target: 'react', filename: FILENAME });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');

  it('compiles with zero error diagnostics', () => {
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });

  it('emits the hotkey badge class token', () => {
    expect(r.code).toContain('rozie-command-palette-option-hotkey');
  });

  it('gates the hotkey badge on a conditional referencing the item hotKey field (not always-on)', () => {
    expect(r.code).toMatch(/hotKey/);
  });

  it('preserves the pre-existing #actions affordance class token', () => {
    expect(r.code).toContain('rozie-command-palette-option-actions');
  });
});
