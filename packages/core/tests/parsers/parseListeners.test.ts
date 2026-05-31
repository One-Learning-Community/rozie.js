// Phase 19 — <listeners> element-walk parser tests.
// Implementation: packages/core/src/parsers/parseListeners.ts
//
// The block is now markup: a sequence of <listener> elements. Each tag's
// :target / r-if / @event attributes fan out to N ListenerEntry records whose
// `value` is a SYNTHESIZED `{ when?, handler }` ObjectExpression (Req 6 bridge)
// so downstream lowering/validation/dep-graph run unchanged.
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseListeners } from '../../src/parsers/parseListeners.js';

/** Parse a standalone <listeners> body string (loc offsets relative to it). */
function parse(body: string) {
  return parseListeners(body, { start: 0, end: body.length }, body, 'test.rozie');
}

/** Pull the synthesized `when`/`handler` object properties off an entry.value. */
function objProps(value: t.Expression) {
  if (!t.isObjectExpression(value)) throw new Error('entry.value is not an ObjectExpression');
  const out: Record<string, t.Expression | null> = {};
  for (const p of value.properties) {
    if (!t.isObjectProperty(p)) continue;
    const k = t.isIdentifier(p.key) ? p.key.name : t.isStringLiteral(p.key) ? p.key.value : null;
    if (k && t.isExpression(p.value)) out[k] = p.value;
    else if (k) out[k] = null;
  }
  return out;
}

describe('parseListeners (Phase 19 — element-walk + synthesis bridge)', () => {
  it('parses a single <listener> with :target=document, @keydown.escape, r-if', () => {
    const body = '<listener :target="document" @keydown.escape="close()" r-if="$props.open" />';
    const { node, diagnostics } = parse(body);
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    expect(node!.entries.length).toBe(1);

    const e = node!.entries[0]!;
    expect(e.target).toBe('document');
    expect(e.event).toBe('keydown');
    expect(e.modifierChainText).toBe('.escape');
    expect(e.value.type).toBe('ObjectExpression');

    const props = objProps(e.value);
    expect(props.when).toBeDefined();
    expect((props.when as t.StringLiteral).value).toBe('$props.open');
    expect(props.handler).toBeDefined();
  });

  it('value=ObjectExpression always present; synthesized when StringLiteral carries r-if text', () => {
    const body = '<listener :target="window" @resize="reposition()" r-if="$props.open" />';
    const { node } = parse(body);
    const props = objProps(node!.entries[0]!.value);
    expect((props.when as t.StringLiteral).value).toBe('$props.open');
  });

  // ---- Req 3: multi-@event fan-out ----
  it('fans one tag with 2 @event attributes out to 2 entries sharing target + when', () => {
    const body =
      '<listener :target="window" r-if="$props.open" @resize.throttle(100).passive="reposition()" @scroll.passive="reposition()" />';
    const { node, diagnostics } = parse(body);
    expect(diagnostics).toEqual([]);
    expect(node!.entries.length).toBe(2);

    const [a, b] = node!.entries;
    expect(a!.target).toBe('window');
    expect(b!.target).toBe('window');
    // distinct events + distinct modifier chains
    expect(a!.event).toBe('resize');
    expect(b!.event).toBe('scroll');
    expect(a!.modifierChainText).toBe('.throttle(100).passive');
    expect(b!.modifierChainText).toBe('.passive');
    // shared r-if condition
    expect((objProps(a!.value).when as t.StringLiteral).value).toBe('$props.open');
    expect((objProps(b!.value).when as t.StringLiteral).value).toBe('$props.open');
  });

  // ---- Req 2: :target resolution ----
  it("defaults target to '$el' when :target is omitted", () => {
    const body = '<listener @click="onClick()" />';
    const { node, diagnostics } = parse(body);
    expect(diagnostics).toEqual([]);
    expect(node!.entries[0]!.target).toBe('$el');
  });

  it('passes :target="window" and :target="document" through verbatim', () => {
    const win = parse('<listener :target="window" @resize="r()" />');
    expect(win.node!.entries[0]!.target).toBe('window');
    const doc = parse('<listener :target="document" @keydown="k()" />');
    expect(doc.node!.entries[0]!.target).toBe('document');
  });

  it('resolves :target case-insensitively (WR-02) and trims its value (WR-03)', () => {
    // HTML attribute names are case-insensitive; a stray-space typo should not
    // mis-fire ROZ114. Both resolve cleanly with no diagnostic.
    const cased = parse('<listener :TARGET="window" @resize="r()" />');
    expect(cased.node!.entries[0]!.target).toBe('window');
    expect(cased.diagnostics.filter((d) => d.code === 'ROZ114')).toHaveLength(0);
    const spaced = parse('<listener :target=" document " @keydown="k()" />');
    expect(spaced.node!.entries[0]!.target).toBe('document');
    expect(spaced.diagnostics.filter((d) => d.code === 'ROZ114')).toHaveLength(0);
  });

  it('emits exactly one ROZ114 for :target="$refs.foo" and produces no entry', () => {
    const body = '<listener :target="$refs.foo" @click="onClick()" />';
    const { node, diagnostics } = parse(body);
    const roz114 = diagnostics.filter((d) => d.code === 'ROZ114');
    expect(roz114.length).toBe(1);
    expect(node!.entries.length).toBe(0);
  });

  it('emits exactly one ROZ114 for an arbitrary :target expression and produces no entry', () => {
    const body = '<listener :target="someExpr" @click="onClick()" />';
    const { node, diagnostics } = parse(body);
    expect(diagnostics.filter((d) => d.code === 'ROZ114').length).toBe(1);
    expect(node!.entries.length).toBe(0);
  });

  // ---- Req 1: ROZ015 zero-@event ----
  it('emits exactly one ROZ015 for a <listener> with zero @event attributes', () => {
    const body = '<listener :target="document" r-if="$props.open" />';
    const { node, diagnostics } = parse(body);
    const roz015 = diagnostics.filter((d) => d.code === 'ROZ015');
    expect(roz015.length).toBe(1);
    expect(node!.entries.length).toBe(0);
  });

  // ---- Req 4: absent r-if → no `when` property (→ when=null downstream) ----
  it('OMITS the when property when r-if is absent (always-attached path)', () => {
    const body = '<listener :target="document" @keydown="onKey()" />';
    const { node, diagnostics } = parse(body);
    expect(diagnostics).toEqual([]);
    const props = objProps(node!.entries[0]!.value);
    expect('when' in props).toBe(false);
    expect(props.handler).toBeDefined();
  });

  // ---- self-close == paired ----
  it('parses self-closing and paired forms identically', () => {
    const selfClose = parse('<listener :target="document" @keydown.escape="close()" r-if="$props.open" />');
    const paired = parse('<listener :target="document" @keydown.escape="close()" r-if="$props.open"></listener>');
    expect(selfClose.diagnostics).toEqual([]);
    expect(paired.diagnostics).toEqual([]);
    expect(selfClose.node!.entries.length).toBe(1);
    expect(paired.node!.entries.length).toBe(1);
    const a = selfClose.node!.entries[0]!;
    const b = paired.node!.entries[0]!;
    expect(b.target).toBe(a.target);
    expect(b.event).toBe(a.event);
    expect(b.modifierChainText).toBe(a.modifierChainText);
  });

  // ---- WARNING-2 / RESEARCH A4: synthesized `when` loc accuracy ----
  it('sets synthesized when StringLiteral .start to the r-if value byte offset MINUS 1', () => {
    // unknownRefValidator re-parses `when` at `(member.value.start ?? 0) + 1`
    // (the +1 skips a real opening quote). Our synthetic literal has no quote,
    // so .start must be (real value offset − 1) so the +1 lands on the real
    // first byte.
    const body = '<listener :target="document" @keydown="close()" r-if="$props.open" />';
    const { node } = parse(body);
    const whenLit = objProps(node!.entries[0]!.value).when as t.StringLiteral;
    // The real r-if value text "$props.open" starts right after the opening "
    const realValueStart = body.indexOf('$props.open');
    expect(whenLit.start).toBe(realValueStart - 1);
    // Sanity: validator's +1 lands on '$'.
    expect(body.charAt((whenLit.start ?? 0) + 1)).toBe('$');
  });

  // ---- D-08 never-throw + stray markup ----
  it('emits a clean diagnostic (never throws) for a non-<listener> element', () => {
    const body = '<div @click="x()" />';
    let threw = false;
    let result;
    try {
      result = parse(body);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result!.node!.entries.length).toBe(0);
    expect(result!.diagnostics.length).toBeGreaterThan(0);
    // WR-01: stray non-<listener> element has its own code, distinct from
    // zero-@event (ROZ015) and unterminated (ROZ017).
    expect(result!.diagnostics.map((d) => d.code)).toContain('ROZ016');
  });

  it('emits a clean diagnostic (never throws) for a bare unterminated <listener>', () => {
    const body = '<listener :target="document" @keydown="close()"';
    let threw = false;
    let result;
    try {
      result = parse(body);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result!.diagnostics.length).toBeGreaterThan(0);
    // WR-01: unterminated tag has its own code (ROZ017), not ROZ015.
    expect(result!.diagnostics.map((d) => d.code)).toContain('ROZ017');
  });

  it('does NOT throw on hostile input — D-08 collected-not-thrown', () => {
    let threw = false;
    try {
      parse('<<<<');
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  // ---- prototype-pollution-shaped attribute names are inert (T-19-02) ----
  it('treats __proto__-shaped attribute names as inert text (no pollution)', () => {
    const body = '<listener :target="document" @click="x()" __proto__="y" />';
    let threw = false;
    try {
      const { node } = parse(body);
      // Still produces the @click entry; the bogus attr is ignored.
      expect(node!.entries.length).toBe(1);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  // ---- migrated Dropdown shape: 3 distinct tags ----
  it('parses three <listener> tags (Dropdown-shaped) to three entries in source order', () => {
    // NB: modifier args carry NO inner space — the @event lives in the
    // attribute NAME, which htmlparser2 terminates at whitespace (same as
    // template @event; matches the D-20 fixture's `$refs.a,$refs.b` form). The
    // Wave 2 migration writes the no-space form.
    const body = [
      '<listener :target="document" @click.outside($refs.triggerEl,$refs.panelEl)="close()" r-if="$props.open && $props.closeOnOutsideClick" />',
      '<listener :target="document" @keydown.escape="close()" r-if="$props.open && $props.closeOnEscape" />',
      '<listener :target="window" @resize.throttle(100).passive="reposition()" r-if="$props.open" />',
    ].join('\n');
    const { node, diagnostics } = parse(body);
    expect(diagnostics).toEqual([]);
    expect(node!.entries.length).toBe(3);
    expect(node!.entries.map((e) => `${e.target}:${e.event}`)).toEqual([
      'document:click',
      'document:keydown',
      'window:resize',
    ]);
    expect(node!.entries[0]!.modifierChainText).toBe('.outside($refs.triggerEl,$refs.panelEl)');
    expect(node!.entries[2]!.modifierChainText).toBe('.throttle(100).passive');
  });
});
