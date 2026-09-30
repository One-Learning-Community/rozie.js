/**
 * The Svelte `.d.rozie.ts` sidecar must name a named slot's Snippet prop
 * exactly as the compiled `.svelte` does (`row`, not `renderRow`).
 */
import { compile, parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { emitSvelteTypes } from '../index.js';

const src = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../examples/TypedEvents.rozie'),
  'utf8',
);

describe('svelte sidecar named-slot field name', () => {
  it('matches the compiled module', () => {
    const { ast } = parse(src, { filename: 'TypedEvents.rozie' });
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    const dts = emitSvelteTypes(ir!);
    const compiled = compile(src, { target: 'svelte', filename: 'TypedEvents.rozie' }).code;
    expect(compiled).toMatch(/\brow\?: Snippet/);
    expect(dts).toMatch(/\brow\?: /);
    expect(dts).not.toMatch(/renderRow/);
  });
});
