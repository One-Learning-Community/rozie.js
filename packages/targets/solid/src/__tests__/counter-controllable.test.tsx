/**
 * counter-controllable.test.tsx — Plan 06.3-02 Task 2 (SC #1).
 *
 * Verifies the emitter's createControllableSignal integration for Counter:
 *
 *   SC #1a: Controlled mode — the emitted code declares [value, setValue] via
 *           createControllableSignal(_props, 'value', default). In controlled
 *           mode the parent owns the value; the setter routes through onValueChange.
 *
 *   SC #1b: Uncontrolled mode — defaultValue prop routes to createControllableSignal's
 *           third argument (the initial value). The internal signal drives display.
 *
 *   SC #1c: Parent-flip warning — createControllableSignal logs ROZ812 exactly once
 *           when a component transitions uncontrolled→controlled.
 *
 * Implementation approach: verify emitter code output contains the required
 * patterns that encode these behavioral claims. The createControllableSignal
 * runtime already has these semantics tested in @rozie/runtime-solid; here we
 * confirm the emitter correctly generates the call sites.
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

function compileCounter(): string {
  const source = readFileSync(resolve(ROOT, 'examples/Counter.rozie'), 'utf8');
  const { ast } = parse(source, { filename: 'Counter.rozie' });
  const modifierRegistry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry });
  const result = emitSolid(ir!, { filename: 'Counter.rozie', source });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return result.code;
}

describe('Counter createControllableSignal integration (SC #1)', () => {
  it('SC #1a: controlled mode — emitter generates createControllableSignal call with _props', () => {
    const code = compileCounter();
    // createControllableSignal must be imported from @rozie/runtime-solid
    expect(code).toContain("import { createControllableSignal } from '@rozie/runtime-solid'");
    // The destructured pair follows [value, setValue] = createControllableSignal(_props as ..., 'value', ...) pattern
    expect(code).toContain("createControllableSignal(_props as Record<string, unknown>, 'value'");
    // In controlled mode, onValueChange prop is wired — the props interface must declare it
    expect(code).toContain('onValueChange?:');
  });

  it('SC #1b: uncontrolled mode — defaultValue prop declared; emitter passes default to createControllableSignal', () => {
    const code = compileCounter();
    // defaultValue must appear in the props interface
    expect(code).toContain('defaultValue?:');
    // createControllableSignal third arg is the default (0 for Counter)
    expect(code).toContain("createControllableSignal(_props as Record<string, unknown>, 'value', 0)");
  });

  it('SC #1c: parent-flip warning — emitter produces the call site that will trigger ROZ812 at runtime', () => {
    const code = compileCounter();
    // The ROZ812 warning fires from createControllableSignal when uncontrolled→controlled.
    // Emitter correctness: createControllableSignal receives _props (reactive, cast) so it can
    // detect the transition. Verify _props is passed (not local, not a snapshot).
    expect(code).toContain('createControllableSignal(_props as Record<string, unknown>,');
    // splitProps is universal (D-141); Counter has non-model defaults so
    // mergeProps runs first and splitProps uses _merged (not raw _props).
    expect(code).toContain('splitProps(_merged,');
  });

  it('signal getter is used in JSX — value() not bare value', () => {
    const code = compileCounter();
    // The JSX must call the signal getter value() not reference bare value
    expect(code).toContain('value()');
  });
});
