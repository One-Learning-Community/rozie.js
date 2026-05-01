// PARSE-05 — <listeners> block parser tests (D-15 stage 1).
// Implementation: packages/core/src/parsers/parseListeners.ts (Plan 03 Task 1).
// Anchors paths per RESEARCH.md Pitfall 8.
//
// D-15 stage 1 contract: modifier-chain TEXT preserved verbatim. Stage 2 (the
// peggy modifier grammar) lands in Plan 04.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { splitBlocks } from '../../src/splitter/splitBlocks.js';
import { parseListeners } from '../../src/parsers/parseListeners.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

function loadExampleListeners(name: string) {
  const source = readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
  const blocks = splitBlocks(source, `${name}.rozie`);
  if (!blocks.listeners) throw new Error(`${name}.rozie has no <listeners> block`);
  return {
    source,
    content: blocks.listeners.content,
    contentLoc: blocks.listeners.contentLoc,
  };
}

describe('parseListeners (PARSE-05 / D-15 stage 1)', () => {
  it('Dropdown.rozie listeners parses to three entries with verbatim modifier-chain text including .outside($refs.triggerEl, $refs.panelEl)', () => {
    const { source, content, contentLoc } = loadExampleListeners('Dropdown');
    const { node, diagnostics } = parseListeners(content, contentLoc, source, 'Dropdown.rozie');
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    expect(node!.entries.length).toBe(3);

    // Entry 0: document:click.outside($refs.triggerEl, $refs.panelEl)
    const e0 = node!.entries[0]!;
    expect(e0.rawKey).toBe('document:click.outside($refs.triggerEl, $refs.panelEl)');
    expect(e0.target).toBe('document');
    expect(e0.event).toBe('click');
    expect(e0.modifierChainText).toBe('.outside($refs.triggerEl, $refs.panelEl)');
    // Verify byte offset of the leading '.' lands on '.outside' in the source.
    expect(source.slice(e0.modifierChainBaseOffset, e0.modifierChainBaseOffset + 8)).toBe('.outside');
    expect(e0.value.type).toBe('ObjectExpression');

    // Entry 1: document:keydown.escape
    const e1 = node!.entries[1]!;
    expect(e1.rawKey).toBe('document:keydown.escape');
    expect(e1.target).toBe('document');
    expect(e1.event).toBe('keydown');
    expect(e1.modifierChainText).toBe('.escape');
    expect(source.slice(e1.modifierChainBaseOffset, e1.modifierChainBaseOffset + 7)).toBe('.escape');

    // Entry 2: window:resize.throttle(100).passive
    const e2 = node!.entries[2]!;
    expect(e2.rawKey).toBe('window:resize.throttle(100).passive');
    expect(e2.target).toBe('window');
    expect(e2.event).toBe('resize');
    expect(e2.modifierChainText).toBe('.throttle(100).passive');
  });

  it('Modal.rozie listeners parses to single entry with .escape modifier', () => {
    const { source, content, contentLoc } = loadExampleListeners('Modal');
    const { node, diagnostics } = parseListeners(content, contentLoc, source, 'Modal.rozie');
    expect(diagnostics).toEqual([]);
    expect(node!.entries.length).toBe(1);
    const e = node!.entries[0]!;
    expect(e.target).toBe('document');
    expect(e.event).toBe('keydown');
    expect(e.modifierChainText).toBe('.escape');
  });

  it("defaults target to '$el' when no target prefix in key", () => {
    const synthetic = '{ "click.outside": { handler: () => {} } }';
    const { node, diagnostics } = parseListeners(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics).toEqual([]);
    expect(node!.entries.length).toBe(1);
    expect(node!.entries[0]!.target).toBe('$el');
    expect(node!.entries[0]!.event).toBe('click');
    expect(node!.entries[0]!.modifierChainText).toBe('.outside');
  });

  it('emits empty modifierChainText with end-of-key offset when no modifiers present', () => {
    const synthetic = '{ "document:click": { handler: x } }';
    const { node, diagnostics } = parseListeners(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics).toEqual([]);
    const e = node!.entries[0]!;
    expect(e.modifierChainText).toBe('');
    // Offset points to the byte right after the last char of "document:click"
    // (i.e., the closing quote position in the source).
    expect(synthetic.charAt(e.modifierChainBaseOffset)).toBe('"');
  });

  it('emits ROZ012 when listener key is not a string literal (computed key)', () => {
    const synthetic = '{ [someExpr]: { handler: x } }';
    const { node, diagnostics } = parseListeners(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    // Node returns with empty entries (computed key skipped); diag emitted.
    expect(node).not.toBeNull();
    expect(diagnostics.some(d => d.code === 'ROZ012')).toBe(true);
    expect(node!.entries.length).toBe(0);
  });

  it('emits ROZ012 when key is an Identifier (bare key, not a string literal)', () => {
    const synthetic = '{ click: { handler: x } }';
    const { node, diagnostics } = parseListeners(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(node).not.toBeNull();
    expect(diagnostics.some(d => d.code === 'ROZ012')).toBe(true);
  });

  it('emits ROZ011 when <listeners> block is not an object literal', () => {
    const synthetic = '42';
    const { node, diagnostics } = parseListeners(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(node).toBeNull();
    expect(diagnostics.some(d => d.code === 'ROZ011')).toBe(true);
  });

  it('emits ROZ010 on invalid JS expression in <listeners>', () => {
    const synthetic = '{ "click": ??? }';
    const { node, diagnostics } = parseListeners(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    // Either ROZ010 surfaces (Babel collected error) or recovery shapes oddly;
    // the contract is that at least one diagnostic appears and we never throw.
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.some(d => d.code === 'ROZ010')).toBe(true);
    // Should not throw regardless of node shape.
    void node;
  });

  it('preserves entry source order', () => {
    const { source, content, contentLoc } = loadExampleListeners('Dropdown');
    const { node } = parseListeners(content, contentLoc, source, 'Dropdown.rozie');
    const events = node!.entries.map(e => `${e.target}:${e.event}`);
    expect(events).toEqual(['document:click', 'document:keydown', 'window:resize']);
  });

  it('does NOT throw on hostile input — D-08 collected-not-thrown', () => {
    const synthetic = '<<<<';
    let threw = false;
    try {
      parseListeners(synthetic, { start: 0, end: synthetic.length }, synthetic);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
