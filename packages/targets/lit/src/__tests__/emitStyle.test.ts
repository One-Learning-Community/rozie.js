/**
 * emitStyle unit tests — Plan 06.4-02 Task 1/2.
 *
 * Per D-LIT-15 / D-LIT-16:
 *   - Scoped CSS rules go into `static styles = css\`...\``
 *   - `:root { }` rules extract to a module-level `injectGlobalStyles(id, ...)` call
 *     imported from @rozie/runtime-lit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';
import { emitStyle } from '../emit/emitStyle.js';
import {
  LitImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compile(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitLit(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
}

describe('emitStyle — D-LIT-15 / D-LIT-16 split', () => {
  it('Counter: scoped-only CSS produces only static styles (no injectGlobalStyles)', () => {
    const code = compile('Counter');
    expect(code).toContain('static styles = css`');
    expect(code).not.toContain('injectGlobalStyles');
  });

  it('Modal: :root rules extract to injectGlobalStyles call with rozie-modal-global id', () => {
    const code = compile('Modal');
    expect(code).toContain("injectGlobalStyles('rozie-modal-global'");
    expect(code).toContain('static styles = css`');
    // Both blocks present — scoped portion lives in static styles, :root in
    // the module-level call.
  });

  it('Dropdown: :root rules extract to injectGlobalStyles call with rozie-dropdown-global id', () => {
    const code = compile('Dropdown');
    expect(code).toContain("injectGlobalStyles('rozie-dropdown-global'");
  });

  it('CardHeader: scoped-only CSS does NOT add injectGlobalStyles import', () => {
    const code = compile('CardHeader');
    expect(code).not.toContain('injectGlobalStyles');
  });

  it('emitStyle() unit: empty styles produce empty result', () => {
    const result = emitStyle(
      { type: 'StyleSection', scopedRules: [], rootRules: [], sourceLoc: { start: 0, end: 0 } },
      '',
      {
        componentName: 'X',
        lit: new LitImportCollector(),
        runtime: new RuntimeLitImportCollector(),
      },
    );
    expect(result.staticStylesField).toBe('');
    expect(result.globalStyleCall).toBe('');
  });
});
