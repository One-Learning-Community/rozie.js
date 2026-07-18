/**
 * slotScopeParamType — RED test (quick 260717-uvm).
 *
 * Lit is the only target whose scoped-slot scope params thread as `unknown`.
 * Producer emit (emitSlotDecl.ts) writes `interface Rozie<X>SlotCtx { p: unknown }`
 * and `@property() <name>?: (scope: { p: unknown }) => unknown`; consumer emit
 * (emitSlotFiller.ts) writes `(scope: { p: unknown }) => html\`…\``. `unknown`
 * forbids property access without narrowing — this test asserts the fix:
 * scope-param types synthesize to `any` (the paramTypes-absent fallback,
 * mirroring React's refineSlotTypes) instead of `unknown`. The render-callback
 * RETURN type `=> unknown` is intentionally left unchanged.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compile(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitLit(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
}

describe('slotScopeParamType — Lit scope params synthesize `any`, not `unknown`', () => {
  it('Dropdown: producer ctxInterface fields for the "trigger" slot are `any`, not `unknown`', () => {
    const code = compile('Dropdown');
    expect(code).toMatch(/interface RozieTriggerSlotCtx/);
    expect(code).toContain('open: any;');
    expect(code).toContain('toggle: any;');
  });

  it('Dropdown: producer @property scope-param types are `any`; render return type `=> unknown` unchanged', () => {
    const code = compile('Dropdown');
    expect(code).toContain(
      'trigger?: (scope: { open: any; toggle: any }) => unknown',
    );
  });

  it('Dropdown: default-slot @property scope-param type is `any`', () => {
    const code = compile('Dropdown');
    expect(code).toContain(
      '__rozieDefaultSlot__?: (scope: { close: any }) => unknown',
    );
  });

  it('Dropdown: no emitted `scope: { ... }` object has any `unknown`-typed inner member', () => {
    const code = compile('Dropdown');
    expect(code).not.toMatch(/scope:\s*\{[^}]*:\s*unknown/);
  });

  it('TodoList: producer ctxInterface fields for the default slot ("item"/"toggle"/"remove") are `any`, not `unknown`', () => {
    const code = compile('TodoList');
    expect(code).toMatch(/interface RozieDefaultSlotCtx/);
    expect(code).toContain('item: any;');
    expect(code).toContain('toggle: any;');
    expect(code).toContain('remove: any;');
  });
});
