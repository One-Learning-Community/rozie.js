/**
 * Snapshot tests for the Solid emitter.
 *
 * For each of the 8 reference examples, this test:
 *   1. Reads the .rozie source
 *   2. Parses + lowers to IR
 *   3. Emits Solid TSX via emitSolid()
 *   4. Asserts no error-severity diagnostics
 *   5. Compares the emitted code byte-for-byte against a locked fixture file
 *
 * On first run (no fixture file present), toMatchFileSnapshot creates the file.
 * Subsequent runs assert byte-equality. Any unintentional emitter change fails loudly.
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
const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
] as const;

describe('emitSolid — locked snapshots', () => {
  for (const name of EXAMPLES) {
    it(name + ' matches locked fixture', async () => {
      const source = readFileSync(resolve(ROOT, 'examples/' + name + '.rozie'), 'utf8');
      const { ast } = parse(source, { filename: name + '.rozie' });
      expect(ast).not.toBeNull();
      const modifierRegistry = createDefaultRegistry();
      const { ir } = lowerToIR(ast!, { modifierRegistry });
      expect(ir).not.toBeNull();
      const result = emitSolid(ir!, { filename: name + '.rozie', source });
      // No error-severity diagnostics allowed
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      await expect(result.code).toMatchFileSnapshot('./fixtures/' + name + '.snap.tsx');
    });
  }
});
