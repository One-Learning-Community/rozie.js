/**
 * manifest-snapshot.test.mjs — the round-trip anti-drift guard for the
 * popover published-primitive manifest (quick 260713-jau, replaying P75's
 * combobox D-03 work).
 *
 * Mirrors the codegen.mjs "lower once, derive everything from the same IR"
 * glue style, but as a vitest test so it runs under `pnpm --filter
 * @rozie-ui/popover test` (and therefore `turbo run test`), not just as a
 * standalone script.
 *
 * Re-parses + re-lowers Popover.rozie, re-derives the manifest via
 * buildManifest(ir) — the SAME pure transform codegen.mjs calls at build time
 * — and asserts the result deep-equals the committed
 * __fixtures__/rozie-manifest.expected.json bytes. Any drift between what
 * codegen.mjs actually emits into the published leaves and this pinned fixture
 * fails the test loudly (the "cannot drift from what's compiled" guarantee,
 * enforced in CI).
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = resolve(ROOT, 'src', 'Popover.rozie');
const FIXTURE = resolve(ROOT, '__fixtures__', 'rozie-manifest.expected.json');
const FILENAME = 'Popover.rozie';

describe('Popover rozie-manifest.json round-trip (anti-drift)', () => {
  it('buildManifest(lowerToIR(Popover.rozie)) deep-equals the committed fixture', () => {
    const source = readFileSync(SRC, 'utf8');
    const { ast } = parse(source, { filename: FILENAME });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    const manifest = buildManifest(ir);
    const generatedJson = JSON.stringify(manifest, null, 2) + '\n';

    const expectedJson = readFileSync(FIXTURE, 'utf8');

    // Structural deep-equality (not just a subset check) — asserting on the
    // parsed objects catches any field-level drift, and the raw-string
    // comparison additionally pins formatting/byte-shape. If this fails after
    // an intentional Popover.rozie contract change, re-bless the fixture by
    // regenerating it from buildManifest(ir) and committing the new bytes —
    // do NOT hand-edit __fixtures__/rozie-manifest.expected.json.
    expect(manifest).toEqual(JSON.parse(expectedJson));
    expect(generatedJson).toBe(expectedJson);
  });
});
