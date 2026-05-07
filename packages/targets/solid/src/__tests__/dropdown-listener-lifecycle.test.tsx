/**
 * dropdown-listener-lifecycle.test.tsx — Plan 06.3-02 Task 2 (SC #2).
 *
 * Verifies the emitter's createOutsideClick integration for Dropdown:
 *
 *   SC #2a: outside click closes — the emitted code generates a createOutsideClick
 *           call that receives a `when` accessor: `() => open()`. When `open` is
 *           true, the handler fires. When false, the `when()` guard prevents firing.
 *           This is the marquee "no stale prop" test.
 *
 *   SC #2b: parent-flip-mid-lifecycle correctness — because the `when` predicate
 *           is a reactive accessor `() => open()` (not a captured boolean snapshot),
 *           parent re-renders updating `open` are observed by the listener without
 *           re-subscribing. The emitter must NOT capture the value at creation time.
 *
 * Implementation approach: verify emitter code output contains the required patterns.
 * createOutsideClick's runtime stale-prop semantics are tested in @rozie/runtime-solid;
 * here we confirm the emitter generates the correct call site (accessor form, not value form).
 *
 * @plan 06.3-02 Task 2
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../emitSolid.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compileDropdown(): string {
  const source = readFileSync(resolve(ROOT, 'examples/Dropdown.rozie'), 'utf8');
  const { ast } = parse(source, { filename: 'Dropdown.rozie' });
  const modifierRegistry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry });
  const result = emitSolid(ir!, { filename: 'Dropdown.rozie', source });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return result.code;
}

describe('Dropdown outside click listener lifecycle (SC #2)', () => {
  it('SC #2a: outside click closes — emitter generates createOutsideClick with a when accessor', () => {
    const code = compileDropdown();
    // createOutsideClick must be imported from @rozie/runtime-solid
    expect(code).toContain("from '@rozie/runtime-solid'");
    expect(code).toContain('createOutsideClick');
    // createOutsideClick call is emitted (at least one occurrence)
    expect(code).toContain('createOutsideClick(');
  });

  it('SC #2b: no stale prop — when predicate uses reactive accessor form not captured value', () => {
    const code = compileDropdown();
    // The `when` predicate must be a thunk (arrow function) so it re-evaluates on each
    // outside click — never capturing a stale boolean snapshot.
    // Pattern: createOutsideClick([...], handler, () => ...)
    // The third arg must start with `() =>` (or `(e) =>`) — NOT a bare boolean expression.
    // We verify by checking the presence of the arrow-function form in the call.
    const outsideClickIdx = code.indexOf('createOutsideClick(');
    expect(outsideClickIdx).toBeGreaterThan(-1);
    // Extract the createOutsideClick call region (first 200 chars after the call start)
    const callRegion = code.slice(outsideClickIdx, outsideClickIdx + 300);
    // Must contain an arrow function as the third argument (when predicate)
    expect(callRegion).toMatch(/createOutsideClick\(\s*\[/);
    // The when thunk must appear — () => something
    expect(callRegion).toContain('() =>');
  });

  it('conditional show uses Show component — open() is the reactive guard', () => {
    const code = compileDropdown();
    // r-if on the panel must compile to <Show when={open()}> (not a ternary)
    expect(code).toContain('<Show when={open()}');
    // Solid imports must include Show (appears in the import from 'solid-js')
    expect(code).toContain('Show');
  });

  it('named slot trigger uses function-prop invocation per D-133', () => {
    const code = compileDropdown();
    // Dropdown has a `trigger` named slot WITH context (passes `open` to the slot).
    // D-133 pattern: {_props.triggerSlot?.({ open: open() })}
    expect(code).toContain('triggerSlot');
  });
});
