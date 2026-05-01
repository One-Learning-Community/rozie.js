// MOD-01 — modifier PEG grammar scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 04. Anchors paths per RESEARCH.md Pitfall 8.
//
// Grammar covers identifier modifiers (.stop, .escape), parameterized modifiers
// (.debounce(300)), modifiers with $refs args (.outside($refs.x, $refs.y)),
// and arbitrary chaining (.outside($refs.x).stop.passive). See RESEARCH.md
// Pattern 8 for the full PEG grammar.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('modifier-grammar (MOD-01)', () => {
  it('test infrastructure is wired', () => {
    expect(__dirname).toMatch(/tests$/);
  });

  it.todo('parses .stop as { name: "stop", args: [] }');
  it.todo('parses .passive as { name: "passive", args: [] }');
  it.todo('parses .escape as { name: "escape", args: [] }');
  it.todo('parses .debounce(300) as { name: "debounce", args: [{ kind: "literal", value: 300 }] }');
  it.todo('parses .throttle(100) as { name: "throttle", args: [{ kind: "literal", value: 100 }] }');
  it.todo('parses .outside($refs.triggerEl, $refs.panelEl) as { name: "outside", args: [refExpr, refExpr] }');
  it.todo('parses chain .outside($refs.x).stop.passive as 3-element ModifierChain');
  it.todo('parseModifierChain wrapper adds baseOffset to every loc (RESEARCH.md Pitfall 4 mitigation)');
  it.todo('returns ROZ070 diagnostic on syntactically invalid modifier chain');
});
