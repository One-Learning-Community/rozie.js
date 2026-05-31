// Phase 19 Task 1 — shared @event attribute-name parse (D-02 / D-20 structural).
// Implementation: packages/core/src/parsers/parseEventAttr.ts
//
// This helper is the SINGLE code path computing @event {name, modifierChainText,
// modifierChainBaseOffset} for both parseTemplate and parseListeners. The
// behavior here MUST match parseTemplate's pre-extraction @ branch byte-for-byte
// (incl. the no-modifier base-offset = end-of-name default).
import { describe, expect, it } from 'vitest';
import { parseEventAttrName } from '../../src/parsers/parseEventAttr.js';

describe('parseEventAttrName (Phase 19 D-02 shared helper)', () => {
  it('@click (no modifiers) → name=click, empty chain, base offset = end of name', () => {
    const off = 10;
    const parts = parseEventAttrName('@click', off);
    expect(parts.name).toBe('click');
    expect(parts.modifierChainText).toBe('');
    // No-modifier default reproduces parseTemplate's `a.nameEnd`.
    expect(parts.modifierChainBaseOffset).toBe(off + '@click'.length);
    expect(parts.modifierChainBaseOffset).toBe(16);
  });

  it('@keydown.escape → name=keydown, chain=.escape, base offset at the leading dot', () => {
    const off = 4;
    const parts = parseEventAttrName('@keydown.escape', off);
    expect(parts.name).toBe('keydown');
    expect(parts.modifierChainText).toBe('.escape');
    // The leading '.' is at index 8 within '@keydown.escape' (@keydown = 8 chars).
    expect(parts.modifierChainBaseOffset).toBe(off + 8);
  });

  it('@resize.throttle(100).passive → name=resize, full chain text, base offset at first dot', () => {
    const off = 0;
    const parts = parseEventAttrName('@resize.throttle(100).passive', off);
    expect(parts.name).toBe('resize');
    expect(parts.modifierChainText).toBe('.throttle(100).passive');
    // First '.' is at index 7 ('@resize' is 7 chars: @ r e s i z e → '.' at 7).
    expect(parts.modifierChainBaseOffset).toBe(off + 7);
  });

  it('offset equivalence: no-modifier base offset equals the byte right after the name', () => {
    const off = 42;
    const raw = '@input';
    const parts = parseEventAttrName(raw, off);
    // modifierChainBaseOffset points at the byte immediately past the last char
    // of rawName — i.e. nameStartOffset + length.
    expect(parts.modifierChainBaseOffset).toBe(off + raw.length);
  });

  it('the base offset for a modifier chain lands exactly on the leading dot in source', () => {
    const source = 'foo @click.stop bar';
    const atOffset = source.indexOf('@');
    const parts = parseEventAttrName('@click.stop', atOffset);
    expect(source.charAt(parts.modifierChainBaseOffset)).toBe('.');
    expect(source.slice(parts.modifierChainBaseOffset)).toBe('.stop bar');
  });
});
