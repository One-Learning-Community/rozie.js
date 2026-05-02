// Phase 2 Plan 02-05 Task 3 — D-20 byte-identical modifierPipeline pair test.
//
// IR-03 / D-20: EventBinding.modifierPipeline IR is byte-identical between
// <listeners> blocks and template @event bindings (modulo sourceLoc). Phase 2
// success criterion 4.
//
// Synthetic fixtures place the SAME chain — `.outside($refs.a, $refs.b).stop` —
// in both contexts. lowerToIR must produce identical pipelines after stripping
// sourceLoc / loc keys.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import { stripCircular } from '../helpers/serialize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures/synthetic');

function loadSynth(name: string): string {
  return fs.readFileSync(resolve(FIXTURES, `${name}.rozie`), 'utf8');
}

/**
 * Recursively strip `sourceLoc` and `loc` keys from a JSON-cloneable value so
 * deep equality comparisons ignore source position differences.
 */
function stripSourceLocs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSourceLocs);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'sourceLoc' || k === 'loc' || k === 'start' || k === 'end') continue;
      out[k] = stripSourceLocs(v);
    }
    return out;
  }
  return value;
}

describe('D-20 shared modifier pipeline — Plan 02-05', () => {
  it('listeners-context fixture writes fixtures/ir/D-20-listeners-context.snap', async () => {
    const src = loadSynth('D-20-listeners');
    const result = parse(src, { filename: 'D-20-listeners.rozie' });
    expect(result.ast).not.toBeNull();
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    const lowered = lowerToIR(result.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(lowered.ir).not.toBeNull();
    expect(lowered.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    const blockListeners = lowered.ir!.listeners.filter((l) => l.source === 'listeners-block');
    expect(blockListeners).toHaveLength(1);
    const pipeline = blockListeners[0]!.modifierPipeline;
    expect(pipeline.length).toBeGreaterThan(0);

    await expect(JSON.stringify(stripCircular(pipeline), null, 2)).toMatchFileSnapshot(
      '../../fixtures/ir/D-20-listeners-context.snap',
    );
  });

  it('template-context fixture writes fixtures/ir/D-20-template-context.snap', async () => {
    const src = loadSynth('D-20-template');
    const result = parse(src, { filename: 'D-20-template.rozie' });
    expect(result.ast).not.toBeNull();
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    const lowered = lowerToIR(result.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(lowered.ir).not.toBeNull();
    expect(lowered.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    const tplListeners = lowered.ir!.listeners.filter((l) => l.source === 'template-event');
    expect(tplListeners).toHaveLength(1);
    const pipeline = tplListeners[0]!.modifierPipeline;
    expect(pipeline.length).toBeGreaterThan(0);

    await expect(JSON.stringify(stripCircular(pipeline), null, 2)).toMatchFileSnapshot(
      '../../fixtures/ir/D-20-template-context.snap',
    );
  });

  it('D-20 byte-identity invariant: stripSourceLocs(listenersPipeline) deep-equals stripSourceLocs(templatePipeline)', () => {
    const listenersSrc = loadSynth('D-20-listeners');
    const templateSrc = loadSynth('D-20-template');

    const listenersIR = lowerToIR(parse(listenersSrc).ast!, {
      modifierRegistry: createDefaultRegistry(),
    }).ir!;
    const templateIR = lowerToIR(parse(templateSrc).ast!, {
      modifierRegistry: createDefaultRegistry(),
    }).ir!;

    const listenersPipeline = listenersIR.listeners.find(
      (l) => l.source === 'listeners-block',
    )!.modifierPipeline;
    const templatePipeline = templateIR.listeners.find(
      (l) => l.source === 'template-event',
    )!.modifierPipeline;

    expect(stripSourceLocs(listenersPipeline)).toEqual(stripSourceLocs(templatePipeline));

    // Sanity: pipelines have the same length and identical kind/modifier sequence.
    expect(listenersPipeline.length).toBe(templatePipeline.length);
    for (let i = 0; i < listenersPipeline.length; i++) {
      expect(listenersPipeline[i]!.kind).toBe(templatePipeline[i]!.kind);
      const lEntry = listenersPipeline[i]!;
      const tEntry = templatePipeline[i]!;
      if (lEntry.kind === 'wrap' || lEntry.kind === 'filter') {
        expect((tEntry as typeof lEntry).modifier).toBe(lEntry.modifier);
      } else {
        expect(tEntry.kind).toBe('listenerOption');
      }
    }
  });

  it('D-20 snapshot pair differs ONLY in sourceLoc fields (file-level invariant)', () => {
    const listenersFile = fs.readFileSync(
      resolve(__dirname, '../../fixtures/ir/D-20-listeners-context.snap'),
      'utf8',
    );
    const templateFile = fs.readFileSync(
      resolve(__dirname, '../../fixtures/ir/D-20-template-context.snap'),
      'utf8',
    );
    const listenersJson = JSON.parse(listenersFile);
    const templateJson = JSON.parse(templateFile);
    expect(stripSourceLocs(listenersJson)).toEqual(stripSourceLocs(templateJson));
  });
});
