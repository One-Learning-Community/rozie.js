/**
 * Phase 85 Plan 06 Task 2 (D5 / T-85-20) — the inertness guard.
 *
 * Every marked `examples/*.rozie` probe MUST compile to byte-identical
 * output, on ALL six targets, whether or not its markers are present. This
 * is written as a STANDING regression test, not a one-time diff: for each
 * marked file on disk, it compiles that file's source AND that same
 * source with every recognized marker line stripped
 * (`stripMarkerLines` — markers.ts), and asserts the compiled bytes match
 * on every target. That is reproducible at any point in the future (e.g.
 * after a compiler change), not dependent on a git-history before/after
 * that only existed at authoring time.
 *
 * Every marker landed in the TEMPLATE spelling (`<!-- ^? -->`), never the
 * SCRIPT spelling — a `<script>`-block comment survives verbatim into
 * script bodies that DO reach emitted output (the repository has an
 * end-to-end test proving exactly that for a `console.log` call), so it was
 * excluded from the shipped corpus outright.
 *
 * Within the template spelling, every one of the 71 marked probes uses the
 * TRAILING form (`markers.ts`): the marker is appended to the END of an
 * existing content line, adding NO new line. This was not the original
 * design — a STANDALONE marker on its own new line was tried first (per
 * Task 1's literal contract) and found NOT inert on five of six targets:
 * those emitters preserve `<template>` whitespace close to verbatim, so
 * even though the comment's own TEXT is dropped from the AST and never
 * reaches emitted output (confirmed in RESEARCH.md), the newline pair
 * surrounding a brand-new comment-only line is NOT collapsed away the way a
 * single inter-element newline is — it shows up as a residual blank line.
 * The trailing form adds no newline at all and was empirically verified
 * inert in every case tried before being used to mark a single real file
 * (see the git history / SUMMARY for the discovery record). 9 files have no
 * inert placement of EITHER form because they carry no `{{ }}` interpolation
 * and no attribute expression that closes on its own line — genuinely
 * nothing assertable was found, documented in the SUMMARY with each file
 * and reason.
 *
 * `compile()` is invoked exactly the way `tests/dist-parity`'s own
 * bootstrap does — absolute filename + `resolverRoot` set uniformly, which
 * that script's own comment records as verified byte-equal to the relative
 * form for single-file examples, so this guard exercises the identical
 * compile() path the shipped dist-parity/consumer/target fixtures are
 * blessed against.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, type CompileTarget } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { stripMarkerLines } from './markers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');
const EXAMPLES_DIR = resolve(ROOT, 'examples');

const TARGETS: CompileTarget[] = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

const files = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.rozie'));

function compileAllTargets(source: string, path: string): Map<CompileTarget, string> {
  const out = new Map<CompileTarget, string>();
  for (const target of TARGETS) {
    const result = compile(source, {
      target,
      filename: path,
      resolverRoot: EXAMPLES_DIR,
      types: true,
      sourceMap: false,
    });
    out.set(target, result.code);
  }
  return out;
}

describe('inertness — marking a probe changes zero bytes of emitted output (T-85-20)', () => {
  for (const file of files) {
    const path = resolve(EXAMPLES_DIR, file);
    const marked = readFileSync(path, 'utf8');
    const stripped = stripMarkerLines(marked);

    it(`${file}: with markers present`, () => {
      // Sanity: a file this test cares about MUST actually carry no
      // script-spelling markers — the design decision above, asserted, not
      // just described in a comment.
      expect(marked).not.toMatch(/^\s*\/\/\s*\^\?\s*(?: .*)?$/m);
    });

    it(`${file}: compiled output is byte-identical with and without its markers`, () => {
      if (marked === stripped) return; // unmarked file (no inert placement existed) — nothing to prove here
      const withMarkers = compileAllTargets(marked, path);
      const withoutMarkers = compileAllTargets(stripped, path);
      const mismatched = TARGETS.filter((t) => withMarkers.get(t) !== withoutMarkers.get(t));
      expect(mismatched, `${file}: non-inert on target(s): ${mismatched.join(', ')}`).toEqual([]);
    });
  }
});
