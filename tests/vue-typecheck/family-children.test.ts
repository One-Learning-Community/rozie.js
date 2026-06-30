/**
 * VUE-FAMILY-CHILDREN — Layer 3 SFC-BODY gate (quick task 260629-ksp, Task 3).
 *
 * Gap this closes (threat T-ksp-03): the existing Vue gates cover the public
 * SURFACE only —
 *   - vue-consumer-surface.test.ts strict-typechecks a CONSUMER of each leaf's
 *     COMPILED dist `.d.ts` (the published type surface), and
 *   - vue-leaf-structure.test.ts is a package.json structural guard.
 * Neither vue-tsc's the @rozie-ui Vue family CHILD SFC *bodies* — the committed
 * `packages/ui/<family>/packages/vue/src/*.vue` files reached via each leaf's
 * `./source` export. Those bodies ship to any consumer that imports the raw
 * `.vue` source, and they carry real type errors that the leaf's OWN relaxed
 * tsconfig (`noImplicitAny:false`, `strictNullChecks:false` — it only drives
 * declaration emit) silently hides (memory `data_table_vue_consumer_typecheck_gap`,
 * `vue_source_residual_typecheck_classes`).
 *
 * This gate vue-tsc's the SFC bodies under the SAME strict consumer tsconfig
 * (`strict:true` + `noImplicitAny:true`) used by vue-consumer-surface, so the
 * full typed-consumer rigor applies to the SFC bodies, not just the surface.
 *
 * REPORTED/BASELINE SPLIT (the vue-leaf-structure "enforced clean set + reported
 * set" pattern). The known-broken Vue-emitter gaps are RECORDED, NOT FIXED here
 * (fixing the Vue emitter / leaf `.rozie` sources is an explicitly out-of-scope
 * serious-phase item — quick task 260629-ksp constraint). To surface the gap
 * WITHOUT bricking CI for everyone:
 *   - Each family declares a BASELINE of its currently-known SFC-body errors,
 *     keyed `file → { TScode → count }` (counts, NOT line numbers — robust to the
 *     line shifts a routine regen produces).
 *   - The gate asserts the LIVE per-file/per-code error counts EQUAL the baseline.
 *   - A NEW error (regression: new file, new code, or higher count) flips RED.
 *   - FEWER errors (the Vue-emitter phase fixed some) ALSO flips RED — that is
 *     intentional: it forces whoever fixes the emitter to tighten this baseline
 *     (and, ideally, delete it) rather than letting the gate rot.
 *   - A family with an EMPTY baseline ({}) is ENFORCED CLEAN — any error fails.
 *
 * So the current end state is (b) "failures surfaced": the baseline documents the
 * exact known-broken inventory; CI stays green at today's known state and goes RED
 * only on a real delta. See 260629-ksp-SUMMARY.md for the full inventory.
 *
 * Implementation mirrors the VUE-TSC harness: per family, copy the leaf's
 * committed `src/*.{vue,ts}` (+ any `internal/`/`themes/` subdirs its relative
 * imports need) into a tmpdir, drop in the strict tsconfig + engine-module
 * ambient stubs, symlink that LEAF's own node_modules (so its real peer deps —
 * @tanstack/table-core, sortablejs, @rozie/runtime-vue — resolve), then run that
 * leaf's pinned `node_modules/.bin/vue-tsc --noEmit`.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  cpSync,
  copyFileSync,
  symlinkSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

/** `file → { TScode → count }`. Empty object = ENFORCED CLEAN. */
type Baseline = Record<string, Record<string, number>>;

interface FamilySpec {
  /** Human label / family dir under packages/ui. */
  name: string;
  /** Path (from repo ROOT) to the compiled Vue leaf package. */
  leaf: string;
  /**
   * Currently-known SFC-body strict-typecheck errors, keyed file → code → count.
   * RECORDED, NOT FIXED (out-of-scope Vue-emitter gaps). See module docblock.
   */
  baseline: Baseline;
}

// Baselines captured 2026-06-29 under tsconfig.consumer.strict.json
// (strict + noImplicitAny) over each leaf's committed src/*.vue. These are the
// documented Vue-emitter residual gaps (attr-nullability TS2322, model-write
// narrowing TS2345, body-passthrough implicit-any TS70xx) — out of scope for
// quick task 260629-ksp. Tighten/delete when the Vue-emitter serious phase fixes
// them.
const FAMILIES: FamilySpec[] = [
  {
    name: 'data-table',
    leaf: 'packages/ui/data-table/packages/vue',
    baseline: {
      'DataTable.vue': {
        TS2322: 6,
        TS2345: 9,
        TS7006: 2,
        TS7022: 1,
        TS7023: 1,
        TS7053: 11,
      },
    },
  },
  {
    name: 'listbox',
    leaf: 'packages/ui/listbox/packages/vue',
    baseline: {
      'Listbox.vue': {
        TS2322: 4,
        // TS2339 ×8 (Class-3 windowing `never` narrowing) CLEARED by Phase 65 Plan 04
        // (the headless-core/windowing.rzts pinMeasurement typed-wrapper retype dissolves
        // into the Vue SFC too, giving the pin-hook read a real object-or-null shape).
      },
    },
  },
  {
    // Engine-wrapper family — currently CLEAN under strict. Enforced clean: any
    // SFC-body error here fails the gate (no baseline to absorb it).
    name: 'sortable-list',
    leaf: 'packages/ui/sortable-list/packages/vue',
    baseline: {},
  },
];

/** Parse vue-tsc output into `file → { TScode → count }`. */
function parseErrors(output: string): Baseline {
  const map: Baseline = {};
  // Matches e.g. `DataTable.vue(30,410): error TS2322: ...`. Continuation lines
  // (indented elaboration) lack this shape and are ignored.
  const re = /^(\S+\.vue)\(\d+,\d+\): error (TS\d+):/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output)) !== null) {
    const file = m[1];
    const code = m[2];
    (map[file] ??= {})[code] = ((map[file] ??= {})[code] ?? 0) + 1;
  }
  return map;
}

/** Run vue-tsc over one family's SFC bodies; return parsed error inventory. */
function typecheckFamily(spec: FamilySpec): Baseline {
  const leafDir = resolve(ROOT, spec.leaf);
  const srcDir = join(leafDir, 'src');
  const leafNodeModules = join(leafDir, 'node_modules');

  // Fail LOUD on a setup gap rather than reporting a false green: the leaf must
  // be installed (workspace node_modules present) so its peer deps resolve.
  if (!existsSync(srcDir)) {
    throw new Error(`[${spec.name}] missing leaf src dir: ${srcDir}`);
  }
  if (!existsSync(leafNodeModules)) {
    throw new Error(
      `[${spec.name}] missing leaf node_modules: ${leafNodeModules} — install/build the workspace first.`,
    );
  }
  const vueTscBin = join(leafNodeModules, '.bin', 'vue-tsc');
  if (!existsSync(vueTscBin)) {
    throw new Error(`[${spec.name}] vue-tsc not found at ${vueTscBin}`);
  }

  const tmpDir = mkdtempSync(join(tmpdir(), `rozie-vue-family-${spec.name}-`));
  try {
    // Copy every committed source entry the SFC bodies need: *.vue, *.ts
    // (index.ts re-exports), and the relative-import subdirs (internal/ helpers,
    // themes/). Skip dist/node_modules — never present under src/ anyway.
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const from = join(srcDir, entry.name);
      const to = join(tmpDir, entry.name);
      if (entry.isDirectory()) {
        cpSync(from, to, { recursive: true });
      } else if (entry.name.endsWith('.vue') || entry.name.endsWith('.ts')) {
        copyFileSync(from, to);
      }
    }
    // Strict consumer tsconfig (strict + noImplicitAny) → tsconfig.json.
    copyFileSync(
      join(HERE, 'tsconfig.consumer.strict.json'),
      join(tmpDir, 'tsconfig.json'),
    );
    // Ambient `any` stubs for vanilla-JS engine modules (sortablejs etc.). Merges
    // harmlessly with a leaf's real engine dep when one is installed.
    copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
    // Symlink the LEAF's node_modules so its real peer deps resolve.
    symlinkSync(leafNodeModules, join(tmpDir, 'node_modules'), 'dir');

    let output = '';
    try {
      execFileSync(vueTscBin, ['--noEmit', '-p', 'tsconfig.json'], {
        cwd: tmpDir,
        stdio: 'pipe',
      });
      // exit 0 → no errors.
    } catch (err) {
      // vue-tsc exits non-zero when it reports errors; the report is on stdout.
      const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
      const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
      output = stdout + '\n' + stderr;
    }
    return parseErrors(output);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Diff live inventory against baseline. Returns human-readable mismatch lines
 * (empty = exact match). A mismatch is any of: a file with errors absent from
 * the baseline, a missing baseline file, a new/missing error code, or a count
 * delta.
 */
function diffAgainstBaseline(live: Baseline, baseline: Baseline): string[] {
  const mismatches: string[] = [];
  const files = new Set([...Object.keys(live), ...Object.keys(baseline)]);
  for (const file of [...files].sort()) {
    const liveCodes = live[file] ?? {};
    const baseCodes = baseline[file] ?? {};
    const codes = new Set([...Object.keys(liveCodes), ...Object.keys(baseCodes)]);
    for (const code of [...codes].sort()) {
      const lc = liveCodes[code] ?? 0;
      const bc = baseCodes[code] ?? 0;
      if (lc !== bc) {
        const verb = lc > bc ? 'REGRESSION' : 'IMPROVED (tighten baseline)';
        mismatches.push(`  ${file} ${code}: live=${lc} baseline=${bc}  [${verb}]`);
      }
    }
  }
  return mismatches;
}

describe('VUE-FAMILY-CHILDREN — strict vue-tsc over @rozie-ui Vue family child SFC bodies (Layer 3)', () => {
  for (const spec of FAMILIES) {
    const baselineTotal = Object.values(spec.baseline).reduce(
      (sum, codes) => sum + Object.values(codes).reduce((s, n) => s + n, 0),
      0,
    );
    const label =
      baselineTotal === 0
        ? `${spec.name}: SFC bodies are strict-clean (enforced)`
        : `${spec.name}: SFC-body errors match the recorded baseline (${baselineTotal} known, do-not-fix-here)`;

    it(label, () => {
      const live = typecheckFamily(spec);
      const mismatches = diffAgainstBaseline(live, spec.baseline);
      expect(
        mismatches,
        `[${spec.name}] SFC-body strict-typecheck inventory drifted from the recorded baseline.\n` +
          `If you ADDED an error, that is a regression — fix it.\n` +
          `If you FIXED Vue-emitter errors, tighten/remove this family's baseline in family-children.test.ts.\n` +
          mismatches.join('\n'),
      ).toEqual([]);
    });
  }
});
