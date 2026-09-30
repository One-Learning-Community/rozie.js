/**
 * SOLID-SCOPED-DEFAULT-SLOT — a default slot WITH params (Modal's `<slot :close>`)
 * accepts function children `({ close }) => <.../>`, in BOTH the compiled
 * module and the `.d.rozie.ts` sidecar (one shared emitSlotDecl feeds both).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitSolidTypes } from '@rozie/target-solid';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const CONSUMER_TSX = `import Modal from './Modal';

export const ok = (
  <Modal>{({ close }) => <button onClick={() => close()}>x</button>}</Modal>
);
export const plain = <Modal><span /></Modal>;
`;

function tsc(files: Record<string, string>): void {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-scoped-default-'));
  try {
    for (const [n, c] of Object.entries(files)) writeFileSync(join(tmpDir, n), c, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
    } catch (err) {
      throw new Error('tsc failed:\n' + ((err as { stdout?: Buffer }).stdout?.toString() ?? ''));
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const src = readFileSync(resolve(ROOT, 'examples/Modal.rozie'), 'utf8');

describe('SOLID-SCOPED-DEFAULT-SLOT — function children on a scoped default slot', () => {
  it('sidecar (.d.rozie.ts) accepts function children', () => {
    const { ast } = parse(src, { filename: 'Modal.rozie' });
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    const dts = emitSolidTypes(ir!);
    expect(dts).not.toMatch(/D-131/);
    tsc({ 'Modal.d.ts': dts, 'Consumer.tsx': CONSUMER_TSX });
  });

  it('compiled module accepts function children', () => {
    const r = compile(src, { target: 'solid', filename: 'Modal.rozie', sourceMap: false });
    tsc({ 'Modal.tsx': r.code, 'Consumer.tsx': CONSUMER_TSX });
  });
});
