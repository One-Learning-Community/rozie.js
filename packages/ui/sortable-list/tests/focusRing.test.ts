/**
 * The default keyboard focus ring (and the lifted-row ring) must have at least
 * 3:1 contrast (WCAG 1.4.11) against a white AND a near-black row background,
 * whatever the OS color scheme: the component doesn't own the row background,
 * so a light-only site seen with the OS in dark mode must still pass. The
 * colour is read from the `<style>` block's `var(--rozie-sortable-list-ring, …)`
 * fallbacks.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/SortableList.rozie'), 'utf8');
const STYLE = SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>'));

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('focus ring contrast', () => {
  const rings = [...STYLE.matchAll(/var\(--rozie-sortable-list-ring,\s*(#[0-9a-fA-F]{6})\)/g)].map((m) => m[1]!.toLowerCase());

  it('every ring uses the overridable token with one default colour', () => {
    expect(rings.length).toBeGreaterThanOrEqual(2);
    expect(new Set(rings).size).toBe(1);
  });

  it('the ring does not depend on the OS color scheme', () => {
    expect(STYLE).not.toMatch(/prefers-color-scheme/);
  });

  for (const bg of ['#ffffff', '#f5f5f7', '#121212', '#1e1e1e']) {
    it(`the default ring has >= 3:1 contrast on ${bg}`, () => {
      for (const ring of new Set(rings)) expect(contrast(ring, bg)).toBeGreaterThanOrEqual(3);
    });
  }

  it('contrast helper sanity: black on white is 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });
});
