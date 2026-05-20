/**
 * regression-kebab-emits — Bug 2 (Angular), quick task 260520-gi1.
 *
 * RATIONALE / why this gap existed:
 *   The Angular target emits one `output<T>()` class field per `$emit` event
 *   name. A kebab-case event name like `file-added` was emitted RAW as the
 *   field identifier — `file-added = output<unknown>()` — which is not a valid
 *   JS identifier, so @babel/parser / esbuild reject the whole class.
 *   compile() produced NO ROZ diagnostic.
 *
 *   The existing core/tests/engine-examples.compile.test.ts only asserts
 *   compile() diagnostics — it never bundles or PARSES the emitted code.
 *   That is the coverage gap this spec closes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as babelParse } from '@babel/parser';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';
import { sanitizeEventName, isValidIdentifier } from '../rewrite/sanitizeEventName.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compile(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitAngular(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry })
    .code;
}

describe('Bug 2 — sanitizeEventName unit behaviour', () => {
  it('camel-cases kebab-case Uppy event names', () => {
    expect(sanitizeEventName('file-added')).toBe('fileAdded');
    expect(sanitizeEventName('file-removed')).toBe('fileRemoved');
    expect(sanitizeEventName('upload-progress')).toBe('uploadProgress');
    expect(sanitizeEventName('upload-success')).toBe('uploadSuccess');
    expect(sanitizeEventName('upload-error')).toBe('uploadError');
    expect(sanitizeEventName('restriction-failed')).toBe('restrictionFailed');
  });

  it('returns already-valid identifiers byte-identically', () => {
    for (const name of ['close', 'search', 'clear', 'add', 'toggle', 'remove', 'complete']) {
      expect(sanitizeEventName(name)).toBe(name);
    }
  });

  it('isValidIdentifier rejects kebab-case, accepts camelCase', () => {
    expect(isValidIdentifier('file-added')).toBe(false);
    expect(isValidIdentifier('fileAdded')).toBe(true);
    expect(isValidIdentifier('close')).toBe(true);
  });
});

describe('Bug 2 — Angular kebab-case output() field emit', () => {
  it('Uppy.rozie emit contains no kebab-case `X-Y = output<` field declaration', () => {
    const code = compile('Uppy');
    expect(code).not.toMatch(/[A-Za-z]+-[A-Za-z-]+\s*=\s*output</);
  });

  it('Uppy.rozie emit contains no `this.X-Y.emit` call', () => {
    const code = compile('Uppy');
    expect(code).not.toMatch(/this\.[A-Za-z]+-[A-Za-z-]+\.emit/);
  });

  it('Uppy.rozie emits aliased camelCase output fields for kebab events', () => {
    const code = compile('Uppy');
    expect(code).toContain("fileAdded = output<unknown>({ alias: 'file-added' })");
    expect(code).toContain("fileRemoved = output<unknown>({ alias: 'file-removed' })");
    expect(code).toContain("uploadProgress = output<unknown>({ alias: 'upload-progress' })");
    expect(code).toContain("restrictionFailed = output<unknown>({ alias: 'restriction-failed' })");
  });

  it('Uppy.rozie emits the valid-identifier `complete` event with NO alias', () => {
    const code = compile('Uppy');
    // `complete` is already a valid identifier — byte-identical, no alias.
    expect(code).toMatch(/\bcomplete = output<unknown>\(\);/);
    expect(code).not.toContain("complete = output<unknown>({ alias:");
  });

  it('Uppy.rozie emit parses cleanly via @babel/parser', () => {
    const code = compile('Uppy');
    expect(() =>
      babelParse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
      }),
    ).not.toThrow();
  });

  it('Modal.rozie ($emit(\'close\')) emits `close = output<void>()` with NO alias (byte-identical)', () => {
    const code = compile('Modal');
    // `close` is a valid identifier — must stay byte-identical: no alias arg.
    expect(code).toMatch(/\bclose = output<void>\(\);/);
    expect(code).not.toContain('alias:');
  });
});
