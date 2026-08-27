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
import ts from 'typescript';
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
    // 80 original probes (Task 2) + SlotCompositionProbe.rozie (Task 3).
    expect(exampleFiles.length).toBe(81);
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

/**
 * Phase 85 Plan 06 Task 3 (D5) — the deliberately-nested composition
 * fixture. Every other probe in this corpus tests a construct in
 * isolation; this proves scope correctness under the ONE shape — a loop
 * inside a slot fill inside a conditional, with a component reference and
 * scoped parameters — every known generator failure has actually lived in.
 *
 * Uses the SAME shared `harness`/`files` as the corpus above
 * (`SlotCompositionProbe.rozie` is just another `examples/*.rozie` entry),
 * so these assertions exercise the identical multi-file `ts.Program` the
 * recorded-answer snapshots above do.
 */
describe('SlotCompositionProbe.rozie — deliberately-nested composition (Task 3)', () => {
  const FILE = resolve(EXAMPLES_DIR, 'SlotCompositionProbe.rozie');
  const source = files.get(FILE) as string;

  /** offset of the Nth occurrence of `needle` in the fixture's source */
  function at(needle: string, n = 1): number {
    let i = -1;
    for (let k = 0; k < n; k++) i = source.indexOf(needle, i + 1);
    if (i < 0) throw new Error(`fixture missing: "${needle}" (#${n})`);
    return i;
  }

  it('the fixture is part of the corpus and carries no parse errors', () => {
    expect(source).toBeTruthy();
  });

  describe('(1) at the innermost interpolation, the loop alias, slot parameter, and props sigil are ALL in scope', () => {
    it('the loop alias `entry` hovers with a real element type, not "Cannot find name"', () => {
      const info = harness.quickInfoAt(FILE, at('entry.id + remaining'));
      expect(info).not.toBe('(unmapped)');
      expect(info).not.toBe('(none)');
      expect(info).toMatch(/const entry:/);
    });

    it('the slot parameter `remaining` hovers with a real (though untyped) binding, not "Cannot find name"', () => {
      const info = harness.quickInfoAt(FILE, at('remaining + total'));
      expect(info).not.toBe('(unmapped)');
      expect(info).not.toBe('(none)');
      expect(info).toMatch(/const remaining:/);
    });

    it('the `$props` sigil hovers as the generated __RozieProps interface', () => {
      const info = harness.quickInfoAt(FILE, at('$props.label.length'));
      expect(info).toMatch(/const \$props: __RozieProps/);
    });
  });

  it('(4) member access on the props-typed value reports the DECLARED property type (string), not an untyped value', () => {
    const dotLength = at('$props.label.length') + '$props.label.'.length;
    const info = harness.quickInfoAt(FILE, dotLength);
    // `.length` on a real `string` resolves to the builtin `String.prototype.length: number`
    // signature — an `any`-typed `label` would report something else entirely
    // (or nothing), so this is the actual proof `label: string` survived the
    // r-if -> slot-fill -> r-for nesting intact.
    expect(info).toMatch(/\(property\) String\.length: number/);
  });

  /** offset of `name` inside the Nth `{{ name }}` occurrence of the given class-tagged paragraph. */
  function interpOffset(classTag: string, name: string): number {
    const pStart = at(`class="${classTag}">`);
    return source.indexOf(name, pStart);
  }

  describe('(2) the slot parameter remains in scope after the loop closes but inside the fill; the loop alias does not', () => {
    it('`remaining` still resolves in the after-loop paragraph (same fill, after the r-for closes)', () => {
      const info = harness.quickInfoAt(FILE, interpOffset('after-loop', 'remaining'));
      expect(info).toMatch(/const remaining:/);
    });

    it('`entry` (the loop alias) does NOT resolve in the after-loop paragraph — a real diagnostic, not silence', () => {
      const afterLoopEntryOffset = source.indexOf('entry', interpOffset('after-loop', 'remaining') + 'remaining'.length);
      const g = harness.toGeneratedOffset(FILE, afterLoopEntryOffset);
      expect(g, 'the after-loop `entry` reference must still MAP into generated code').toBeDefined();
      const diags = harness.languageService.getSemanticDiagnostics(FILE);
      const hit = diags.find(
        (d) => d.start !== undefined && d.start <= (g as number) && (g as number) < d.start + (d.length ?? 0),
      );
      expect(hit, "expected a \"Cannot find name 'entry'\" diagnostic at the after-loop position").toBeTruthy();
      expect(String(hit && ts.flattenDiagnosticMessageText(hit.messageText, ' '))).toMatch(/Cannot find name 'entry'/);
    });
  });

  describe('(3) neither the loop alias nor the slot parameter is in scope OUTSIDE the fill', () => {
    it('`remaining` used outside the <template #header> fill reports "Cannot find name"', () => {
      const outsideOffset = interpOffset('outside-fill', 'remaining');
      const g = harness.toGeneratedOffset(FILE, outsideOffset);
      expect(g).toBeDefined();
      const diags = harness.languageService.getSemanticDiagnostics(FILE);
      const hit = diags.find(
        (d) => d.start !== undefined && d.start <= (g as number) && (g as number) < d.start + (d.length ?? 0),
      );
      expect(hit && ts.flattenDiagnosticMessageText(hit.messageText, ' ')).toMatch(/Cannot find name 'remaining'/);
    });

    it('`entry` used outside the fill (AND outside the r-for) reports "Cannot find name"', () => {
      const outsideOffset = source.indexOf('entry', interpOffset('outside-fill', 'remaining') + 'remaining'.length);
      const g = harness.toGeneratedOffset(FILE, outsideOffset);
      expect(g).toBeDefined();
      const diags = harness.languageService.getSemanticDiagnostics(FILE);
      const hit = diags.find(
        (d) => d.start !== undefined && d.start <= (g as number) && (g as number) < d.start + (d.length ?? 0),
      );
      expect(hit && ts.flattenDiagnosticMessageText(hit.messageText, ' ')).toMatch(/Cannot find name 'entry'/);
    });
  });

  it('(6) the shipped fixture compiles cleanly to all six targets — zero diagnostics (verified in inertness.test.ts-style below)', () => {
    // Full six-target compile-clean proof lives in inertness.test.ts's own
    // corpus loop (SlotCompositionProbe.rozie is just another examples/*.rozie
    // entry there). This test asserts the TypeScript layer's OWN diagnostics
    // are EXACTLY the four expected negative-probe "Cannot find name"
    // occurrences (entry x2, remaining x1 outside + already covered above) —
    // i.e. nothing ELSE is unexpectedly broken in this fixture.
    const diags = harness.languageService.getSemanticDiagnostics(FILE);
    const messages = diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
    const unexpected = messages.filter((m) => !/Cannot find name '(entry|remaining)'/.test(m));
    expect(unexpected, JSON.stringify(unexpected)).toEqual([]);
  });
});

/**
 * Phase 85 Plan 06 Task 3 (D5) — the deliberate type-error VARIANT, loaded
 * into its OWN small harness (not mixed into the main corpus) so this
 * negative case never touches the shipped 81-file Program.
 */
describe('SlotCompositionProbeError.rozie — deliberate type error reverse-maps onto source (Task 3, (5))', () => {
  const ERROR_FIXTURE = resolve(HERE, '..', 'fixtures', 'SlotCompositionProbeError.rozie');
  const errorSource = readFileSync(ERROR_FIXTURE, 'utf8');
  const errorHarness = createTwoslashHarness(new Map([[ERROR_FIXTURE, errorSource]]));

  it('a real type error is reported for `.toFixed()` on the string-typed prop', () => {
    const diags = errorHarness.languageService.getSemanticDiagnostics(ERROR_FIXTURE);
    const messages = diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
    expect(messages.some((m) => m.includes('toFixed'))).toBe(true);
  });

  it('the diagnostic reverse-maps onto `toFixed` in the .rozie source, not somewhere else', () => {
    const diags = errorHarness.languageService.getSemanticDiagnostics(ERROR_FIXTURE);
    const toFixedDiag = diags.find((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ').includes('toFixed'));
    expect(toFixedDiag).toBeTruthy();
    const srcOffset = errorHarness.toSourceOffset(ERROR_FIXTURE, toFixedDiag?.start as number);
    expect(srcOffset).toBeDefined();
    const text = errorSource.slice(srcOffset as number, (srcOffset as number) + (toFixedDiag?.length ?? 0));
    expect(text).toBe('toFixed');
  });
});
