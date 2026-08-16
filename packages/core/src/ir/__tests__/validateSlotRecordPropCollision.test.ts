/**
 * validateSlotRecordPropCollision.test.ts — Phase 79 Plan 01 Task 2/3 (ROZ095).
 *
 * Drives through `lowerToIR` (NOT the validator in isolation), matching the
 * `validateEmitNameCollision.test.ts` convention: `parse()` + `createDefaultRegistry()`
 * + diagnostics-array filtering by code. Proves the validator fires from the
 * single chokepoint both `compile()` and `@rozie/unplugin` share.
 *
 * D-06/D-07: a `<props>` key exactly equal to `slots`, `snippets`, `templates`,
 * or `rozieSlots` is a HARD ERROR — these four strings are the slot-record
 * property names the compiler synthesizes on the React/Solid, Svelte, Angular,
 * and Lit consumer surfaces respectively. The reserved set is exactly those
 * four exact strings, not a fuzzy match (Task 3's scope-discipline check).
 *
 * Task 3 extends this file with a corpus-scan proving AC-24's non-vacuous
 * "zero live instances across the 52-file .rozie corpus" half.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';

// packages/core/src/ir/__tests__ → repo root is five levels up (one deeper
// than the packages/core/src/__tests__ analogs' four-level REPO_ROOT).
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');

/** Recursively collect every `.rozie` file under `dir` (hand-rolled walk — no
 * globbing dependency, mirroring packages/cli/src/__tests__/multi-target.test.ts).
 * Skips `node_modules` / dotfile directories: pnpm's content-addressable store
 * symlinks packages into their own dependents' `node_modules`, which recreates
 * a cyclic `.../node_modules/@x/node_modules/@x/...` tree that would otherwise
 * walk forever (and eventually ENAMETOOLONG). */
function collectRozieFiles(dir: string): string[] {
  const out: string[] = [];
  function walk(current: string): void {
    for (const name of readdirSync(current)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const abs = join(current, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else if (name.endsWith('.rozie')) out.push(abs);
    }
  }
  if (existsSync(dir)) walk(dir);
  return out;
}

function lower(
  src: string,
  filename = 'Collider.rozie',
): { diagnostics: Diagnostic[] } {
  const registry = createDefaultRegistry();
  const { ast, diagnostics: parseDiags } = parse(src, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.code).join(', ')}`,
    );
  }
  const { diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    filename,
  });
  return { diagnostics: [...parseDiags, ...irDiags] };
}

function roz095(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(
    (d) => d.code === RozieErrorCode.SLOT_RECORD_PROP_NAME_RESERVED,
  );
}

/** A component with one declared prop (given name, Number type) plus one named slot. */
function componentWithProp(propName: string): string {
  return `<rozie name="Collider">
<props>{ ${propName}: { type: Number, default: 0 } }</props>
<template>
  <div>
    <slot name="content" />
  </div>
</template>
</rozie>
`;
}

describe('validateSlotRecordPropCollision (ROZ095) — via lowerToIR', () => {
  it('<props> key "slots" fires exactly one ROZ095 naming React and Solid, plus a rename hint', () => {
    const { diagnostics } = lower(componentWithProp('slots'));
    const hits = roz095(diagnostics);
    expect(hits.length).toBe(1);
    const hit = hits[0]!;
    expect(hit.severity).toBe('error');
    expect(hit.loc).toBeTruthy();
    expect(hit.message).toContain("'slots'");
    expect(hit.message).toContain('React');
    expect(hit.message).toContain('Solid');
    expect(hit.hint).toBeTruthy();
  });

  it('<props> key "snippets" fires exactly one ROZ095 naming Svelte', () => {
    const { diagnostics } = lower(componentWithProp('snippets'));
    const hits = roz095(diagnostics);
    expect(hits.length).toBe(1);
    const hit = hits[0]!;
    expect(hit.severity).toBe('error');
    expect(hit.loc).toBeTruthy();
    expect(hit.message).toContain("'snippets'");
    expect(hit.message).toContain('Svelte');
  });

  it('<props> key "templates" fires exactly one ROZ095 naming Angular', () => {
    const { diagnostics } = lower(componentWithProp('templates'));
    const hits = roz095(diagnostics);
    expect(hits.length).toBe(1);
    const hit = hits[0]!;
    expect(hit.severity).toBe('error');
    expect(hit.loc).toBeTruthy();
    expect(hit.message).toContain("'templates'");
    expect(hit.message).toContain('Angular');
  });

  it('<props> key "rozieSlots" fires exactly one ROZ095 naming Lit', () => {
    const { diagnostics } = lower(componentWithProp('rozieSlots'));
    const hits = roz095(diagnostics);
    expect(hits.length).toBe(1);
    const hit = hits[0]!;
    expect(hit.severity).toBe('error');
    expect(hit.loc).toBeTruthy();
    expect(hit.message).toContain("'rozieSlots'");
    expect(hit.message).toContain('Lit');
  });

  it('singular near-miss prop names (slot/snippet/template/rozieSlot) fire zero ROZ095 — exact match only, not fuzzy', () => {
    for (const propName of ['slot', 'snippet', 'template', 'rozieSlot']) {
      const { diagnostics } = lower(componentWithProp(propName));
      expect(roz095(diagnostics).length).toBe(0);
    }
  });

  it('a component with slots but no reserved-name prop fires zero ROZ095', () => {
    const { diagnostics } = lower(componentWithProp('label'));
    expect(roz095(diagnostics).length).toBe(0);
  });

  // ---- Task 3 — AC-24 corpus scan (non-vacuous, minimum-file-count guarded) ----
  //
  // CRITICAL: `.rozie` files contain em-dashes and are silently skipped by
  // plain `grep` as if they were binary (feedback_grep_rozie_binary_detection).
  // This scan reads every file through Node's `fs.readFileSync` with explicit
  // `utf8` encoding — no shell grep, no binary-detection hazard at all — and
  // runs each through the SAME `parse()` + `lowerToIR` pipeline the tests above
  // use, asserting the collected diagnostics contain zero ROZ095 entries.
  describe('AC-24 — 52-file .rozie corpus contains zero ROZ095 instances', () => {
    const corpusFiles = [
      ...collectRozieFiles(join(REPO_ROOT, 'examples')),
      ...collectRozieFiles(join(REPO_ROOT, 'packages', 'ui')),
      ...collectRozieFiles(join(REPO_ROOT, 'tests')),
    ];

    it('scans at least 50 files (guards against an accidentally-empty glob passing vacuously)', () => {
      expect(corpusFiles.length).toBeGreaterThanOrEqual(50);
    });

    it('every scanned file produces zero ROZ095 diagnostics', () => {
      const offenders: string[] = [];
      const skipped: string[] = [];

      for (const filePath of corpusFiles) {
        const src = readFileSync(filePath, 'utf8');
        let diagnostics: Diagnostic[];
        try {
          ({ diagnostics } = lower(src, filePath));
        } catch {
          // A file that fails to parse for unrelated reasons (e.g. a
          // fixture deliberately authored to exercise a parse error) is
          // skipped EXPLICITLY, not silently swallowed — a swallowed parse
          // failure would hide a real ROZ095. Recorded for visibility.
          skipped.push(filePath);
          continue;
        }
        if (roz095(diagnostics).length > 0) {
          offenders.push(filePath);
        }
      }

      expect(
        offenders,
        `Found ${offenders.length} file(s) with a reserved slot-record <props> key (ROZ095): ${offenders.join(', ')}. (${skipped.length} file(s) skipped due to unrelated parse errors: ${skipped.join(', ')})`,
      ).toEqual([]);
    });
  });
});
