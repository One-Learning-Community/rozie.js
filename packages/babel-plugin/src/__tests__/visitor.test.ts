// Plan 06-04 Task 2 — visitor happy paths (DIST-03 V1/V2/V3).
//
// Each test uses a per-test mkdtempSync sandbox so writes can't collide
// across cases or pollute the repo. Tests run @babel/core.transformAsync
// end-to-end (not unit-testing the visitor in isolation) — the Babel API
// surface IS part of the contract per DIST-03 / D-92.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { transformAsync } from '@babel/core';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import rozieBabelPlugin from '../index.js';

// __dirname under ESM (vitest runs as ESM). Resolves to .../packages/babel-plugin/src/__tests__/
const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(HERE, '../../../../examples');

describe('rozieBabelPlugin visitor — happy paths (DIST-03)', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rozie-babel-visitor-'));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('V1: vue target — rewrites import + writes sibling .vue', async () => {
    copyFileSync(resolve(EXAMPLES_DIR, 'Counter.rozie'), join(tmpDir, 'Counter.rozie'));
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import Counter from './Counter.rozie';\n", 'utf8');

    const result = await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'vue' }]],
      babelrc: false,
      configFile: false,
    });

    // Import source rewritten to the sibling extension (Babel may emit
    // either single or double quotes depending on its generator config;
    // assert on the path token itself).
    expect(result?.code).toMatch(/['"]\.\/Counter\.vue['"]/);
    expect(result?.code).not.toMatch(/Counter\.rozie/);
    // Sibling .vue file written
    const siblingPath = join(tmpDir, 'Counter.vue');
    expect(existsSync(siblingPath)).toBe(true);
    const sibling = readFileSync(siblingPath, 'utf8');
    expect(sibling).toContain('<template>');
    expect(sibling).toContain('<script setup');
  });

  it('V2: react target — writes .tsx + .d.ts + .module.css siblings; rewrites import to .tsx', async () => {
    copyFileSync(resolve(EXAMPLES_DIR, 'Counter.rozie'), join(tmpDir, 'Counter.rozie'));
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import Counter from './Counter.rozie';\n", 'utf8');

    const result = await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'react' }]],
      babelrc: false,
      configFile: false,
    });

    expect(result?.code).toMatch(/['"]\.\/Counter\.tsx['"]/);
    // Primary artifact + sidecars (D-84 React-only)
    expect(existsSync(join(tmpDir, 'Counter.tsx'))).toBe(true);
    expect(existsSync(join(tmpDir, 'Counter.d.ts'))).toBe(true);
    expect(existsSync(join(tmpDir, 'Counter.module.css'))).toBe(true);
    // .d.ts has the canonical CounterProps interface (Plan 06-02)
    const dts = readFileSync(join(tmpDir, 'Counter.d.ts'), 'utf8');
    expect(dts).toContain('export interface CounterProps');
    expect(dts).toContain('onValueChange');
    // .module.css carries the scoped style block bytes (non-empty)
    const css = readFileSync(join(tmpDir, 'Counter.module.css'), 'utf8');
    expect(css.length).toBeGreaterThan(0);
  });

  it('V3: non-rozie import passes through unchanged — no fs writes', async () => {
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import x from 'react';\n", 'utf8');

    const result = await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'vue' }]],
      babelrc: false,
      configFile: false,
    });

    // Import unchanged
    expect(result?.code).toMatch(/['"]react['"]/);
    // No sibling files invented
    expect(existsSync(join(tmpDir, 'react.vue'))).toBe(false);
    expect(existsSync(join(tmpDir, 'react.tsx'))).toBe(false);
  });
});
