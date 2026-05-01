// MOD-01 — modifier PEG grammar (D-13 / D-14).
// Implementation: packages/core/src/modifier-grammar/parseModifierChain.ts (Plan 04 Task 1).
//
// Grammar covers identifier modifiers (.stop, .escape), parameterized modifiers
// (.debounce(300)), modifiers with $refs args (.outside($refs.x, $refs.y)),
// arbitrary chaining (.outside($refs.x).stop.passive), and key/button filters.
import { describe, expect, it } from 'vitest';
import { parseModifierChain } from '../src/modifier-grammar/parseModifierChain.js';

describe('parseModifierChain (MOD-01)', () => {
  describe('identifier-only modifiers', () => {
    it('parses .stop as one entry with empty args', () => {
      const { chain, diagnostics } = parseModifierChain('.stop', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).not.toBeNull();
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('stop');
      expect(chain![0]!.args).toEqual([]);
      expect(chain![0]!.loc).toEqual({ start: 0, end: 5 });
    });

    it('parses .escape as one entry', () => {
      const { chain, diagnostics } = parseModifierChain('.escape', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('escape');
    });

    it('parses .passive as one entry', () => {
      const { chain, diagnostics } = parseModifierChain('.passive', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('passive');
    });

    it('parses .self as one entry', () => {
      const { chain, diagnostics } = parseModifierChain('.self', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('self');
    });

    it('returns empty chain on empty input (no modifiers is valid)', () => {
      const { chain, diagnostics } = parseModifierChain('', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toEqual([]);
    });
  });

  describe('parameterized modifiers', () => {
    it('parses .debounce(300) with one numeric literal arg', () => {
      const { chain, diagnostics } = parseModifierChain('.debounce(300)', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('debounce');
      expect(chain![0]!.args).toHaveLength(1);
      const arg0 = chain![0]!.args[0]!;
      expect(arg0.kind).toBe('literal');
      if (arg0.kind === 'literal') {
        expect(arg0.value).toBe(300);
      }
    });

    it('parses .throttle(100) with one numeric literal arg', () => {
      const { chain, diagnostics } = parseModifierChain('.throttle(100)', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('throttle');
      expect(chain![0]!.args).toHaveLength(1);
      const arg0 = chain![0]!.args[0]!;
      if (arg0.kind === 'literal') {
        expect(arg0.value).toBe(100);
      }
    });
  });

  describe('ref-arg modifiers', () => {
    it('parses .outside($refs.triggerEl) as one ref arg', () => {
      const { chain, diagnostics } = parseModifierChain('.outside($refs.triggerEl)', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('outside');
      expect(chain![0]!.args).toHaveLength(1);
      const arg = chain![0]!.args[0]!;
      expect(arg.kind).toBe('refExpr');
      if (arg.kind === 'refExpr') {
        expect(arg.ref).toBe('triggerEl');
      }
    });

    it('parses .outside($refs.triggerEl, $refs.panelEl) (Dropdown.rozie marquee)', () => {
      const { chain, diagnostics } = parseModifierChain(
        '.outside($refs.triggerEl, $refs.panelEl)',
        0,
      );
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('outside');
      expect(chain![0]!.args).toHaveLength(2);
      const a0 = chain![0]!.args[0]!;
      const a1 = chain![0]!.args[1]!;
      expect(a0.kind).toBe('refExpr');
      expect(a1.kind).toBe('refExpr');
      if (a0.kind === 'refExpr') expect(a0.ref).toBe('triggerEl');
      if (a1.kind === 'refExpr') expect(a1.ref).toBe('panelEl');
    });
  });

  describe('chained modifiers', () => {
    it('parses .outside($refs.x).stop.passive as 3 entries', () => {
      const { chain, diagnostics } = parseModifierChain('.outside($refs.x).stop.passive', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(3);
      expect(chain![0]!.name).toBe('outside');
      expect(chain![0]!.args).toHaveLength(1);
      expect(chain![1]!.name).toBe('stop');
      expect(chain![1]!.args).toEqual([]);
      expect(chain![2]!.name).toBe('passive');
      expect(chain![2]!.args).toEqual([]);
    });

    it('parses .throttle(100).passive (Dropdown.rozie window:resize)', () => {
      const { chain, diagnostics } = parseModifierChain('.throttle(100).passive', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(2);
      expect(chain![0]!.name).toBe('throttle');
      expect(chain![1]!.name).toBe('passive');
    });
  });

  describe('key/button filters (MOD-01 list)', () => {
    it('parses .enter, .escape, .tab, .space, .delete as identifier modifiers', () => {
      for (const key of ['.enter', '.escape', '.tab', '.space', '.delete']) {
        const { chain, diagnostics } = parseModifierChain(key, 0);
        expect(diagnostics).toEqual([]);
        expect(chain).toHaveLength(1);
        expect(chain![0]!.name).toBe(key.slice(1));
      }
    });

    it('parses mouse buttons .left, .right, .middle', () => {
      for (const btn of ['.left', '.right', '.middle']) {
        const { chain, diagnostics } = parseModifierChain(btn, 0);
        expect(diagnostics).toEqual([]);
        expect(chain).toHaveLength(1);
        expect(chain![0]!.name).toBe(btn.slice(1));
      }
    });

    it('parses .arrow-up / .arrow-down / .arrow-left / .arrow-right (Identifier permits dashes)', () => {
      for (const arrow of ['.arrow-up', '.arrow-down', '.arrow-left', '.arrow-right']) {
        const { chain, diagnostics } = parseModifierChain(arrow, 0);
        expect(diagnostics).toEqual([]);
        expect(chain).toHaveLength(1);
        expect(chain![0]!.name).toBe(arrow.slice(1));
      }
    });
  });

  describe('string-literal args', () => {
    it("parses .swipe('left') with single-quoted string literal", () => {
      const { chain, diagnostics } = parseModifierChain(".swipe('left')", 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      const arg0 = chain![0]!.args[0]!;
      expect(arg0.kind).toBe('literal');
      if (arg0.kind === 'literal') expect(arg0.value).toBe('left');
    });

    it('parses .swipe("left") with double-quoted string literal', () => {
      const { chain, diagnostics } = parseModifierChain('.swipe("left")', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      const arg0 = chain![0]!.args[0]!;
      if (arg0.kind === 'literal') expect(arg0.value).toBe('left');
    });
  });

  describe('baseOffset translation (Pitfall 4 mitigation)', () => {
    it('shifts all locs by baseOffset', () => {
      const { chain } = parseModifierChain('.stop', 100);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.loc.start).toBe(100);
      expect(chain![0]!.loc.end).toBe(105);
    });

    it('shifts chained modifier locs by baseOffset (.outside($refs.x).stop with baseOffset=200)', () => {
      const { chain } = parseModifierChain('.outside($refs.x).stop', 200);
      expect(chain).toHaveLength(2);
      // .outside starts at offset 0 in input → 200 in shifted loc
      expect(chain![0]!.loc.start).toBe(200);
      // .stop starts at offset 17 in input (after ".outside($refs.x)")
      expect(chain![1]!.loc.start).toBe(200 + 17);
    });

    it('shifts arg locs by baseOffset', () => {
      const { chain } = parseModifierChain('.debounce(300)', 50);
      const arg0 = chain![0]!.args[0]!;
      // .debounce( = 10 chars, so 300 starts at offset 10
      expect(arg0.loc.start).toBe(50 + 10);
      expect(arg0.loc.end).toBe(50 + 13);
    });
  });

  describe('error handling (ROZ070)', () => {
    it('returns chain: null + ROZ070 diagnostic on illegal modifier name (.123invalid)', () => {
      const { chain, diagnostics } = parseModifierChain('.123invalid', 0);
      expect(chain).toBeNull();
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.code).toBe('ROZ070');
      expect(diagnostics[0]!.severity).toBe('error');
    });

    it('returns chain: null + ROZ070 on unclosed paren', () => {
      const { chain, diagnostics } = parseModifierChain('.outside($refs.', 0);
      expect(chain).toBeNull();
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.code).toBe('ROZ070');
    });

    it('does NOT throw on invalid input (D-08 collected-not-thrown)', () => {
      expect(() => parseModifierChain('.@@@invalid@@@', 0)).not.toThrow();
    });

    it('error diagnostic loc.start is shifted by baseOffset', () => {
      const { diagnostics } = parseModifierChain('.123invalid', 100);
      expect(diagnostics[0]!.loc.start).toBeGreaterThanOrEqual(100);
    });
  });

  describe('ReDoS resilience (security gate)', () => {
    it('completes in <100ms on 1000 chained modifiers', () => {
      const input = '.x'.repeat(1000);
      const start = Date.now();
      const { chain } = parseModifierChain(input, 0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(chain).not.toBeNull();
      expect(chain!.length).toBe(1000);
    });
  });

  describe('real-world inputs from examples', () => {
    it('Dropdown click-outside: .outside($refs.triggerEl, $refs.panelEl)', () => {
      const { chain, diagnostics } = parseModifierChain(
        '.outside($refs.triggerEl, $refs.panelEl)',
        0,
      );
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('outside');
    });

    it('Dropdown window:resize: .throttle(100).passive', () => {
      const { chain, diagnostics } = parseModifierChain('.throttle(100).passive', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(2);
    });

    it('Modal/Dropdown keydown: .escape', () => {
      const { chain, diagnostics } = parseModifierChain('.escape', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
    });

    it('SearchInput input: .debounce(300)', () => {
      const { chain, diagnostics } = parseModifierChain('.debounce(300)', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
    });

    it('Modal backdrop click: .self', () => {
      const { chain, diagnostics } = parseModifierChain('.self', 0);
      expect(diagnostics).toEqual([]);
      expect(chain).toHaveLength(1);
      expect(chain![0]!.name).toBe('self');
    });
  });
});
