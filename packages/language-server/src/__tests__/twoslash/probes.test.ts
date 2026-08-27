/**
 * Phase 85 Plan 06 Task 2 (D5 / REQ-V12) — recorded expected answers for the
 * shipped `examples/*.rozie` probes.
 *
 * One snapshot file PER PROBE — not one giant combined snapshot — so a
 * generator change surfaces as a diff grouped by file, the same
 * report-by-class discipline REQ-V12 already applies to the corpus survey.
 * Wired into the language-server package's normal `test` run, so an answer
 * changing silently is impossible: a snapshot diff is a real Vitest failure.
 *
 * Every marker in this corpus is loaded into ONE shared `ts.LanguageService`
 * (`createTwoslashHarness`), mirroring how the real server sees a project —
 * every `.rozie` file sharing one TS Program — which is also what the
 * standing REQ-V6 guard (`virtualCode.prove.test.ts`) exercises with two
 * fixtures; here it runs across the real 80-file corpus.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createTwoslashHarness, resolveMarkersForFile } from './assertQuickInfo.js';
import { findMarkers } from './markers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');
const EXAMPLES_DIR = resolve(ROOT, 'examples');

const exampleFiles = readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith('.rozie'))
  .sort();

const files = new Map<string, string>();
for (const f of exampleFiles) {
  files.set(resolve(EXAMPLES_DIR, f), readFileSync(resolve(EXAMPLES_DIR, f), 'utf8'));
}

const harness = createTwoslashHarness(files);

const markedFiles = exampleFiles.filter((f) => findMarkers(files.get(resolve(EXAMPLES_DIR, f)) as string).length > 0);

function report(fileLabel: string, resolved: ReturnType<typeof resolveMarkersForFile>): string {
  return resolved
    .map((r, i) => {
      const status = r.error ? `ERROR: ${r.error}` : `line ${r.targetLine}${r.unmapped ? ' (unmapped)' : ''}`;
      return [`[${fileLabel}#${i}] kind=${r.kind} marker@L${r.markerLine} -> ${status}`, r.answer].join('\n');
    })
    .join('\n\n');
}

describe('probes — recorded answers for every marked examples/*.rozie probe (REQ-V12: reported per-file)', () => {
  it(`${markedFiles.length} of ${exampleFiles.length} example probes carry at least one recorded marker`, () => {
    // See SUMMARY for the full accounting of every unmarked file + reason
    // (either no `{{ }}`/binding/event expression exists in the template at
    // all, or none has an inert trailing placement).
    expect(markedFiles.length).toBeGreaterThan(0);
    expect(exampleFiles.length).toBe(80);
  });

  for (const file of markedFiles) {
    it(`${file}: recorded answer(s)`, async () => {
      const path = resolve(EXAMPLES_DIR, file);
      const source = files.get(path) as string;
      const resolved = resolveMarkersForFile(harness, path, source);
      expect(resolved.length).toBeGreaterThan(0);
      await expect(report(file, resolved)).toMatchFileSnapshot(`__snapshots__/${file}.twoslash.snap`);
    });
  }
});
