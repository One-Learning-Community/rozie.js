// Quick task 260703-vk4 — Part 1 regression test for partial-origin
// diagnostic-filename attribution.
//
// Asserts:
//   1. `locFromBabel` carries `node.loc.filename` through when present, and
//      omits the key entirely (never `undefined`) when absent.
//   2. `stampMissingFilename` prefers a loc-carried partial filename over the
//      host fallback, even when both are available.
//   3. `stampMissingFilename` applies `d.loc.filename` even when the host
//      `filename` argument is `undefined`.
//   4. `stampMissingFilename` NEVER overwrites an already-set `d.filename`.
import { describe, expect, it } from 'vitest';
import { locFromBabel } from '../locFromBabel.js';
import { stampMissingFilename } from '../stampFilename.js';
import type { Diagnostic } from '../Diagnostic.js';

function makeDiagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    code: 'ROZ100',
    severity: 'error',
    message: 'test diagnostic',
    loc: { start: 0, end: 1 },
    ...overrides,
  };
}

describe('locFromBabel', () => {
  it('carries node.loc.filename through when present', () => {
    const node = { start: 5, end: 10, loc: { filename: '/abs/path/Partial.rzts' } };
    expect(locFromBabel(node)).toEqual({ start: 5, end: 10, filename: '/abs/path/Partial.rzts' });
  });

  it('omits the filename key entirely (never undefined) when loc.filename is absent', () => {
    const node = { start: 5, end: 10, loc: {} };
    const loc = locFromBabel(node);
    expect(loc).toEqual({ start: 5, end: 10 });
    expect('filename' in loc).toBe(false);
  });

  it('omits the filename key when node.loc is absent entirely', () => {
    const node = { start: 5, end: 10 };
    const loc = locFromBabel(node);
    expect(loc).toEqual({ start: 5, end: 10 });
    expect('filename' in loc).toBe(false);
  });

  it('falls back to 0 for missing start/end', () => {
    expect(locFromBabel({})).toEqual({ start: 0, end: 0 });
  });

  it('ignores a non-string or empty-string loc.filename', () => {
    expect(locFromBabel({ start: 1, end: 2, loc: { filename: '' } })).toEqual({ start: 1, end: 2 });
  });
});

describe('stampMissingFilename', () => {
  it('prefers a loc-carried partial filename over the host fallback', () => {
    const d = makeDiagnostic({ loc: { start: 0, end: 1, filename: '/abs/Partial.rzts' } });
    stampMissingFilename([d], '/abs/Host.rozie');
    expect(d.filename).toBe('/abs/Partial.rzts');
  });

  it('falls back to the host filename when loc carries none', () => {
    const d = makeDiagnostic({ loc: { start: 0, end: 1 } });
    stampMissingFilename([d], '/abs/Host.rozie');
    expect(d.filename).toBe('/abs/Host.rozie');
  });

  it('applies loc.filename even when the host filename argument is undefined', () => {
    const d = makeDiagnostic({ loc: { start: 0, end: 1, filename: '/abs/Partial.rzts' } });
    stampMissingFilename([d], undefined);
    expect(d.filename).toBe('/abs/Partial.rzts');
  });

  it('leaves filename unset when both host filename and loc.filename are absent', () => {
    const d = makeDiagnostic({ loc: { start: 0, end: 1 } });
    stampMissingFilename([d], undefined);
    expect(d.filename).toBeUndefined();
  });

  it('never overwrites an already-set filename', () => {
    const d = makeDiagnostic({
      filename: '/abs/AlreadySet.rzts',
      loc: { start: 0, end: 1, filename: '/abs/Partial.rzts' },
    });
    stampMissingFilename([d], '/abs/Host.rozie');
    expect(d.filename).toBe('/abs/AlreadySet.rzts');
  });
});
