import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../emitReact.js';

const REPO_ROOT = resolve(__dirname, '../../../../..');

describe('DX-01: composeSourceMap with real .rozie input', () => {
  it('Counter.rozie produces a non-empty source map with the .rozie filename in sources[]', () => {
    const filename = 'Counter.rozie';
    const source = readFileSync(resolve(REPO_ROOT, 'examples/Counter.rozie'), 'utf8');
    const { ast } = parse(source, { filename });
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    const result = emitReact(ir!, { filename, source });
    expect(result.map).not.toBeNull();
    const mappings = result.map!.mappings;
    expect(mappings, `mappings should not match /^[;,]*$/`).not.toMatch(/^[;,]*$/);
    expect(result.map!.sources).toContain('Counter.rozie');
  });
});
