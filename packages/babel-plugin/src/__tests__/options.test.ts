// Plan 06-04 Task 2 — option-validation paths (DIST-03 O1/O2/O3).
//
// O1/O2 fail at plugin instantiation (declare()'s factory throws ROZ820)
// — Babel re-throws within transformAsync as a rejected promise.
// O3 fails inside the visitor when state.filename is unset (no `filename`
// passed to transformAsync) and uses path.buildCodeFrameError → ROZ821.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { transformAsync } from '@babel/core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import rozieBabelPlugin from '../index.js';

describe('rozieBabelPlugin options — validation (DIST-03)', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rozie-babel-options-'));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('O1: missing target option throws ROZ820 at instantiation', async () => {
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import x from 'react';\n", 'utf8');

    await expect(
      transformAsync('import x from "y";', {
        filename: importer,
        plugins: [[rozieBabelPlugin, {}]],
        babelrc: false,
        configFile: false,
      }),
    ).rejects.toThrow(/ROZ820/);
  });

  it('O1b: missing target message references "target" + "required"', async () => {
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import x from 'react';\n", 'utf8');

    await expect(
      transformAsync('import x from "y";', {
        filename: importer,
        plugins: [[rozieBabelPlugin, {}]],
        babelrc: false,
        configFile: false,
      }),
    ).rejects.toThrow(/target.*required/);
  });

  it('O2: invalid target throws ROZ820 + lists valid targets', async () => {
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import x from 'react';\n", 'utf8');

    await expect(
      transformAsync('import x from "y";', {
        filename: importer,
        plugins: [[rozieBabelPlugin, { target: 'preact' }]],
        babelrc: false,
        configFile: false,
      }),
    ).rejects.toThrow(/ROZ820.*vue\|react\|svelte\|angular/);
  });

  it('O3: missing state.filename throws ROZ821 with code-frame', async () => {
    // No `filename` in transformAsync opts AND a .rozie import — visitor
    // hits the importerFile-undefined branch and calls buildCodeFrameError.
    await expect(
      transformAsync("import Foo from './Foo.rozie';\n", {
        plugins: [[rozieBabelPlugin, { target: 'vue' }]],
        babelrc: false,
        configFile: false,
      }),
    ).rejects.toThrow(/ROZ821/);
  });
});
