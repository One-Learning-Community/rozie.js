/**
 * DIST-05 strict-bytes parity gate (Plan 06-06 / D-93; Phase 06.2 P3 / D-126
 * extended 5 → 8 examples).
 *
 * Asserts that ALL FOUR Rozie distribution entrypoints produce byte-identical
 * output for every (8 reference example × 4 targets) tuple:
 *   • Leg 1 — @rozie/core.compile() direct
 *   • Leg 2 — @rozie/cli runBuildMatrix (writes to disk)
 *   • Leg 3 — @rozie/babel-plugin (writes sibling via transformAsync)
 *   • Leg 4 — @rozie/unplugin createTransformHook (in-process)
 *
 * Total: 8 × 4 × 4 = 128 byte-equal assertions + React sidecar checks
 * (.d.ts / .module.css / .global.css) per fixture × 3 legs that surface
 * those sidecars (Legs 1-3; Leg 4 doesn't surface sidecars in the same
 * shape — they're virtual ids in unplugin per D-58).
 *
 * Phase 06.2 P3 D-126: EXAMPLES extended 5 → 8 (TreeNode + Card + CardHeader
 * appended). Modal regenerates per the D-119 retrofit (additive — <components>{
 * Counter } block + <Counter /> embed in body content area). Non-Modal
 * existing fixtures (Counter / SearchInput / Dropdown / TodoList × 4 targets ×
 * sidecars) MUST stay byte-identical — verified by `git diff --name-only`
 * empty result on non-Modal paths post-bootstrap.
 *
 * Trailing-newline contract (D-93):
 *   - `result.code` and `result.types` MUST already end with `\n` — the
 *     assertion is strict raw-byte equality (no normalize() softening). If
 *     compile() ever stops emitting a trailing newline for one of these
 *     fields, this test fails loudly rather than papering over the regression.
 *   - `result.css` and `result.globalCss` come from PostCSS, which does NOT
 *     emit a trailing `\n`. The bootstrap script (D-93) appends one at write
 *     time so committed fixtures are `\n`-terminated; here we apply the same
 *     normalization to the live result before comparing. This is the ONLY
 *     intentional normalize() in the test path; documented per WR-04.
 *
 * .map parity is deferred to v2 per RESEARCH OQ4.
 *
 * The test suite runs in-process with no child_process spawns; total runtime
 * < 5s on a warm cache.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, ModifierRegistry, registerBuiltins } from '@rozie/core';
import { runBuildMatrix } from '@rozie/cli';
// `createTransformHook` is the test-only entrypoint into unplugin's
// per-target pipeline; not exported from `@rozie/unplugin` (the public
// surface is `unplugin` factory). Imported directly from the source via
// relative path — same pattern as `@rozie/core/compile.ts` importing
// sibling target-* packages by relative path. The dist-parity workspace
// is private; this is allowed.
import { createTransformHook } from '../../packages/unplugin/src/transform.js';
import { transformAsync } from '@babel/core';
import rozieBabelPlugin from '@rozie/babel-plugin';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const FIXTURES_DIR = resolve(HERE, 'fixtures');

// Phase 06.2 P3 D-126: extended 5 → 8 examples.
// Phase 07.2 Plan 06 D-216: extended 8 → 9 with ModalConsumer (the dogfood
// closing the consumer-side surface). 9 × 6 × 4 = 216 cells — the hard SPEC.md
// ship gate. ModalConsumer references sibling Modal.rozie + WrapperModal.rozie
// via the IR cache; each Leg below detects `name === 'ModalConsumer'` and
// stages the sibling .rozie files alongside (or wires resolverRoot) so the
// producer resolution flows through correctly.
// Phase 07.3 Plan 09: extended 9 → 10 with WrapperModal so the consumer-side
// `r-model:open="$props.open"` forwarding pattern is byte-locked across all
// 4 entrypoints. (10 × 6 × 4 = 240 cells as of Phase 07.3 — superseded below.)
// Quick-task 260519-vyv (Spike 004) — extended 10 → 11 with PortalListStyled,
// the canonical `@portal NAME { ... }` producer-side CSS-scoping fixture.
// Single-file example (no sibling .rozie); byte-locked across all 4
// entrypoints. 11 × 6 × 4 = 264 cells (+ React .d.ts/.module.css sidecars).
// Phase 10 Plan 04 — extended 11 → 12 with PortalListStyledScss, the SCSS
// proving fixture (a `<style lang="scss">` fork of PortalListStyled). It proves
// the substituteCompiledStyle splice carries the compiled SCSS-to-CSS output
// byte-identically across all 4 entrypoints and 6 targets with zero
// preprocessor leakage (SPEC-REQ-6/7). Single-file example (no sibling .rozie).
// (12 × 6 × 4 = 288 cells as of Phase 10 Plan 04 — superseded below.)
// Phase 10 test-coverage gap closure — extended 12 → 13 with
// BadgeGridStyledScss, a SECOND SCSS proving fixture. PortalListStyledScss
// only exercises the structural SCSS surface (nesting, $variables, one
// @mixin/@include, the & parent-ref, :root, @portal); BadgeGridStyledScss
// covers the otherwise-uncovered PROGRAMMATIC surface — @if/@else, @each,
// @for, a @function, %placeholder + @extend, #{...} interpolation, and a
// Sass map via `@use 'sass:map'` — proving all of it compiles to byte-
// identical plain CSS across all 4 entrypoints and 6 targets with zero
// preprocessor leakage. Single-file example (no sibling .rozie).
// 13 × 6 × 4 = 312 cells (+ React .d.ts/.module.css sidecars).
// Phase 14 attribute-fallthrough — extended 13 → 17 with the four
// proving fixtures: ThemedButton (D-05/D-06 auto-fallthrough dogfood),
// ThemedButtonManual (R5 `inherit-attrs="false"` + manual `r-bind="$attrs"`),
// ThemedButtonConsumer (the consumer dogfood — multi-rozie, references the
// two ThemedButton variants via <components>; registered in
// EXAMPLE_SIBLING_ROZIE below), and RBindProbe (R11d literal `r-bind`
// class-merge + reordered probe; single-file). 17 × 6 × 4 = 408 cells
// (+ React .d.ts/.module.css sidecars).
// Phase 16 prop-default coercion — extended 17 → 18 with PropDefaultCoercion
// (SPEC R1/R5 cross-target prop-default conformance probe; single-file —
// the six default shapes null / 0 / '' / false / () => [] / () => ({k:1})
// MUST coerce undefined→declaredDefault uniformly across all 6 targets,
// with D-02 once-per-instance factory invocation). +1 × 6 × 4 = 24 new
// cells: 408 → 432 cells (+ React .d.ts/.module.css sidecars).
const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  'ModalConsumer',
  'WrapperModal',
  'PortalListStyled',
  'PortalListStyledScss',
  'BadgeGridStyledScss',
  'ThemedButton',
  'ThemedButtonManual',
  'ThemedButtonConsumer',
  'RBindProbe',
  'PropDefaultCoercion',
  // Phase 17 — Lit ::part() cross-shadow bridge proving fixtures. PartCard is a
  // single-file producer leaf; PartCardConsumer references it via <components>
  // (sibling staged below). Byte-parity across all 4 entrypoints × 6 targets.
  'PartCard',
  'PartCardConsumer',
  // Phase 21 $expose dogfood (REQ-11). Typed input exposing reset()/focus().
  // Byte-parity across all 4 entrypoints × 6 targets; the D-03 proof that
  // registering it drifts ONLY the new ExposeProbe.* fixtures. Single-file
  // producer — no <components>, no resolver-root.
  'ExposeProbe',
  // Phase 23 (angular-cva-forms-integration) off-state byte-equality probe.
  // Single-model (`value` String model:true). Its Angular leg is compiled with
  // cva:false (live FIXTURE_ANGULAR_CVA_OFF set); the committed Angular fixture
  // is the suppressed-CVA shape and the off-state byte-equality block below
  // asserts it byte-identical across all four entrypoints.
  'CvaOffState',
  // Phase 24 (security-self-test-battery) D-11 — the single r-html enabling
  // fixture. One String `content` prop rendered raw via `r-html` exercises every
  // target's raw-HTML sink (React dangerouslySetInnerHTML, Vue v-html, Svelte
  // {@html}, Angular [innerHTML], Solid innerHTML, Lit ${unsafeHTML(...)}) from
  // ONE source. The committed bytes are the corpus the Plan-04 security batteries
  // scan. Single-file; no sibling .rozie producers — stays OUT of RESOLVER_ROOT.
  'RHtml',
  // Phase 26 (portable-template-interpolation) D-08 — the dedicated object-
  // interpolation parity fixture. An untyped <data> object ({ a: 1, b: [2, 3] })
  // interpolated in a text node, a :data-x attribute binding, and a class
  // interpolation. The Phase 26 annotateDisplayWrap gate WRAPs all three on the
  // five non-Vue targets (identical 2-space JSON via rozieDisplay); Vue stays
  // raw. The committed per-target bytes are the SPEC-1/SPEC-4 byte-exact cross-
  // target JSON-parity contract across all four entrypoints — a STRONGER
  // precision proof than VR for JSON text (D-09; the Linux-Docker VR cell is
  // SKIPPED for this fixture). Single-file; no sibling .rozie producers — stays
  // OUT of RESOLVER_ROOT.
  'ObjectInterp',
] as const;

// Phase 07.2 Plan 06 — siblings ModalConsumer reaches via `<components>`.
// Used by Leg 3 (babel-plugin sibling-copy) and Leg 2 (CLI implicit via
// `root: ROOT`).
// Phase 07.3 Plan 09 — WrapperModal references Modal.rozie via <components>;
// its compile likewise needs Modal.rozie staged alongside.
// Phase 23 (angular-cva-forms-integration) — per-fixture Angular CVA opt-out
// (must mirror bootstrap-fixtures.mjs's FIXTURE_ANGULAR_CVA_OFF). Fixtures in
// this set assert their Angular leg with `cva: false` across ALL FOUR
// entrypoints — proving cva:false suppresses CVA byte-equally end-to-end
// (Pitfall 2: a default/threading divergence between compile()'s emitOpts and
// the three other legs would fail byte-equality here). Each leg below threads
// the opt-out into its native option surface:
//   Leg 1 (compile)      → angular: { cva: false }
//   Leg 2 (CLI)          → BuildOptionsExt.cva = false (--no-cva)
//   Leg 3 (babel-plugin) → plugin option angular: { cva: false }
//   Leg 4 (unplugin)     → createTransformHook(registry, target, /* cva */ false)
const FIXTURE_ANGULAR_CVA_OFF = new Set(['CvaOffState']);

const EXAMPLE_SIBLING_ROZIE: Record<string, string[]> = {
  ModalConsumer: ['Modal.rozie', 'WrapperModal.rozie', 'Counter.rozie'],
  WrapperModal: ['Modal.rozie', 'Counter.rozie'],
  // Phase 14 — ThemedButtonConsumer references both ThemedButton wrappers
  // via `<components>`; the babel-plugin Leg 3 needs both siblings staged
  // in tmpDir so the producer resolver can find them.
  ThemedButtonConsumer: ['ThemedButton.rozie', 'ThemedButtonManual.rozie'],
  // Phase 17 — PartCardConsumer reaches PartCard.rozie via <components>; the
  // babel-plugin Leg 3 needs the sibling staged in tmpDir so the producer
  // resolver can find it (same pattern as ThemedButtonConsumer).
  PartCardConsumer: ['PartCard.rozie'],
};
// Phase 06.4 P3 (D-LIT-22): TARGETS extended with 'lit' — additive only.
// 8 examples × 1 target × 3 entrypoints excl. babel-plugin sidecar parity
// totals 24 net-new byte-equal assertions (24 of the 32 leg-tuples below are
// added; legs 1/2/3/4 each cover one entrypoint, so 8 × 4 = 32 lit assertions
// total. The plan's "24 new assertions" figure counted CLI / babel-plugin /
// unplugin (3 entrypoints), with compile() folded into "Leg 1"; reading the
// matrix as 4 legs is the canonical count. Total parity grows 160 → 192).
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function primaryExt(target: Target): string {
  if (target === 'angular') return '.angular.ts';
  if (target === 'react') return '.tsx';
  if (target === 'solid') return '.solid.tsx';
  if (target === 'lit') return '.lit.ts';
  return `.${target}`;
}

/** D-89 layout: CLI/babel emit by their native convention; parity fixture uses primaryExt. */
function emittedExt(target: Target): string {
  if (target === 'angular') return '.ts';
  if (target === 'react') return '.tsx';
  if (target === 'solid') return '.tsx';  // CLI emits .tsx; fixture named .solid.tsx for disambiguation
  if (target === 'lit') return '.ts';     // CLI emits .ts; fixture named .lit.ts for disambiguation
  return `.${target}`;
}

function loadFixture(name: string, target: Target): string {
  return readFileSync(join(FIXTURES_DIR, `${name}${primaryExt(target)}`), 'utf8');
}

function loadSidecarOrNull(name: string, suffix: string): string | null {
  try {
    return readFileSync(join(FIXTURES_DIR, `${name}${suffix}`), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Match bootstrap script's write-time normalization (D-93 trailing-LF only).
 *
 * WR-04: applied ONLY to `result.css` / `result.globalCss` — PostCSS does not
 * emit a trailing newline, but committed fixtures do (bootstrap appends one).
 * For `result.code` / `result.types` we assert raw bytes; both fields are
 * required by D-93 to already end in `\n`.
 */
function normalizeCss(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}

/**
 * Phase 07.2 Plan 03 — consumer-side fixture 48-cell subset.
 *
 * The two consumer-side slot-matrix fixtures (`consumer-named-fill`,
 * `consumer-scoped-fill`) ship their own per-target baselines under
 * `tests/slot-matrix/fixtures/<class>/expected.<ext>`. This subset gates
 * byte-equality of those baselines across all 4 entrypoints — proving
 * Pitfall 1 (resolver-shape mismatch across entrypoints) does NOT
 * manifest for the consumer-side scoped-fill type-flow path.
 *
 * 2 fixtures × 6 targets × 4 entrypoints = 48 cells (subset toward the
 * full 216-cell gate landed in Plan 07.2-06).
 *
 * The slot-matrix fixtures are multi-file (consumer + sibling producer);
 * compile() needs `resolverRoot` set to the fixture directory so the IR
 * cache can resolve `./producer.rozie`. The 4 entrypoints derive the
 * resolverRoot differently:
 *
 *   - Leg 1 (compile()): explicit `resolverRoot` arg
 *   - Leg 2 (CLI): chdir to the fixture dir before invoking
 *   - Leg 3 (babel-plugin): consumer's filename is in the fixture dir →
 *     the babel-plugin's wrapper compile() uses `process.cwd()` by default,
 *     which we set to the fixture dir
 *   - Leg 4 (unplugin createTransformHook): the new
 *     `threadParamTypesForPipeline` helper in unplugin uses
 *     `dirname(filePath)` — so the fixture absolute path Just Works
 */
const CONSUMER_FIXTURES = [
  'consumer-named-fill',
  'consumer-scoped-fill',
  // Phase 07.2 Plan 04 — Wave 2 dynamic-name dispatch (R5) extends the
  // consumer-side subset by +24 cells (1 × 6 × 4). Together: 72 cells.
  'consumer-dynamic-name',
  // Phase 07.2 Plan 05 — Wave 2 re-projection (R6) extends the consumer-
  // side subset by another +24 cells (1 × 6 × 4). Together: 96 cells.
  // The fixture is 3-file (inner + wrapper + consumer); the consumer
  // input.rozie compiles via the IR cache resolving wrapper.rozie which
  // in turn resolves inner.rozie — all via the same resolverRoot ==
  // fixtureDir convention as the existing 2-file fixtures.
  'consumer-re-projection',
] as const;
const SLOT_MATRIX_FIXTURES_DIR = resolve(HERE, '../slot-matrix/fixtures');

function consumerFixturePath(fixtureClass: string): string {
  return join(SLOT_MATRIX_FIXTURES_DIR, fixtureClass, 'input.rozie');
}

function consumerExpectedPath(fixtureClass: string, target: Target): string {
  return join(SLOT_MATRIX_FIXTURES_DIR, fixtureClass, `expected${primaryExt(target)}`);
}

describe('DIST-05 strict-bytes parity gate — consumer-side 96-cell subset (Phase 07.2 Wave 1 + Wave 2)', () => {
  describe.each(CONSUMER_FIXTURES)('%s', (fixtureClass) => {
    const consumerPath = consumerFixturePath(fixtureClass);
    const consumerSource = readFileSync(consumerPath, 'utf8');
    const fixtureDir = dirname(consumerPath);

    describe.each(TARGETS)('%s target', (target) => {
      const expectedPath = consumerExpectedPath(fixtureClass, target);
      const fixture = readFileSync(expectedPath, 'utf8');

      it('Leg 1 — compile() direct produces baseline bytes', () => {
        const result = compile(consumerSource, {
          target,
          filename: consumerPath,
          resolverRoot: fixtureDir,
          types: true,
          sourceMap: false,
        });
        expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(result.code).toBe(fixture);
      });

      it('Leg 2 — CLI runBuildMatrix produces baseline bytes', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-parity-consumer-cli-'));
        try {
          // CLI needs the fixture directory as cwd so the producer
          // resolver finds `./producer.rozie`. runBuildMatrix doesn't
          // accept resolverRoot directly; we chdir for the duration of
          // the call.
          const origCwd = process.cwd();
          process.chdir(fixtureDir);
          try {
            await runBuildMatrix(
              [consumerPath],
              {
                target: [target],
                out: tmpDir,
                types: true,
                sourceMap: false,
                root: fixtureDir,
              },
              { exit: 'throw' },
            );
          } finally {
            process.chdir(origCwd);
          }
          // D-89 layout: <outDir>/<target>/<source-rel>/<basename>.<ext>
          // With root=fixtureDir + consumerPath=fixtureDir/input.rozie,
          // the source-rel is `input.rozie` (flat).
          const outPath = resolve(tmpDir, target, `input${emittedExt(target)}`);
          const cliBytes = readFileSync(outPath, 'utf8');
          expect(cliBytes).toBe(fixture);
        } finally {
          rmSync(tmpDir, { recursive: true, force: true });
        }
      });

      it('Leg 3 — babel-plugin produces baseline bytes via sibling write', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-parity-consumer-babel-'));
        try {
          // Copy consumer + ALL sibling .rozie files into tmpDir so the
          // babel-plugin's sibling write doesn't pollute the fixture
          // directory. Phase 07.2 Plan 05 — 3-file fixtures (e.g.,
          // consumer-re-projection: inner.rozie + wrapper.rozie + input.rozie)
          // need ALL siblings copied, not just `producer.rozie`.
          const tmpConsumer = join(tmpDir, 'input.rozie');
          writeFileSync(tmpConsumer, consumerSource, 'utf8');
          for (const sibling of readdirSync(fixtureDir)) {
            if (sibling.endsWith('.rozie') && sibling !== 'input.rozie') {
              writeFileSync(
                join(tmpDir, sibling),
                readFileSync(join(fixtureDir, sibling), 'utf8'),
                'utf8',
              );
            }
          }
          const importer = join(tmpDir, 'consumer.ts');
          writeFileSync(importer, `import X from './input.rozie';`, 'utf8');

          // babel-plugin's compile() defaults resolverRoot to process.cwd();
          // chdir to tmpDir so the producer resolver finds the sibling.
          const origCwd = process.cwd();
          process.chdir(tmpDir);
          try {
            await transformAsync(readFileSync(importer, 'utf8'), {
              filename: importer,
              plugins: [[rozieBabelPlugin, { target }]],
              babelrc: false,
              configFile: false,
            });
          } finally {
            process.chdir(origCwd);
          }

          const sibling = join(tmpDir, `input${emittedExt(target)}`);
          const babelBytes = readFileSync(sibling, 'utf8');
          expect(babelBytes).toBe(fixture);
        } finally {
          rmSync(tmpDir, { recursive: true, force: true });
        }
      });

      it('Leg 4 — unplugin createTransformHook produces baseline bytes', () => {
        const registry = new ModifierRegistry();
        registerBuiltins(registry);
        const hook = createTransformHook(registry, target);
        // Pass the consumer's absolute path as the file id — unplugin's
        // threadParamTypesForPipeline helper uses dirname(filePath) as the
        // resolverRoot, so the sibling producer.rozie resolves correctly.
        const result = hook.call({}, consumerSource, consumerPath);
        expect(result).not.toBeNull();
        expect(result!.code).toBe(fixture);
      });
    });
  });
});

describe('DIST-05 strict-bytes parity gate (D-93) — 18 examples × 6 targets × 4 entrypoints = 432 cells', () => {
  describe.each(EXAMPLES)('%s', (name) => {
    const rozieSourcePath = resolve(ROOT, `examples/${name}.rozie`);
    const rozieSource = readFileSync(rozieSourcePath, 'utf8');

    describe.each(TARGETS)('%s target', (target) => {
      const fixture = loadFixture(name, target);

      it('Leg 1 — compile() direct produces fixture bytes', () => {
        // Phase 07.2 Plan 06 — multi-rozie examples (e.g., ModalConsumer
        // composing Modal + WrapperModal) need an absolute filename + a
        // resolverRoot so the IR cache + ProducerResolver can locate the
        // sibling .rozie producers. For single-file examples (Counter through
        // CardHeader), absolute-filename + resolverRoot is byte-equivalent
        // to the relative form (verified empirically — all 192 baselines
        // unchanged after the switch), so we use the same shape uniformly.
        const hasSiblings = name in EXAMPLE_SIBLING_ROZIE;
        // Phase 23 — off-state probe asserts its Angular leg with cva:false.
        const cvaOff = target === 'angular' && FIXTURE_ANGULAR_CVA_OFF.has(name);
        const result = compile(rozieSource, {
          target,
          filename: hasSiblings ? rozieSourcePath : `${name}.rozie`,
          ...(hasSiblings ? { resolverRoot: dirname(rozieSourcePath) } : {}),
          ...(cvaOff ? { angular: { cva: false } } : {}),
          types: true,
          sourceMap: false,
        });
        expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        // WR-04: assert raw bytes including trailing LF — compile() is
        // contractually required to emit `\n`-terminated `result.code`.
        expect(result.code.endsWith('\n')).toBe(true);
        expect(result.code).toBe(fixture);

        // React sidecar parity (per D-93 React adds 3 sidecars when present)
        if (target === 'react') {
          const dts = loadSidecarOrNull(name, '.d.ts');
          if (dts !== null) {
            // WR-04: same strict-LF contract for .d.ts.
            expect(result.types.endsWith('\n')).toBe(true);
            expect(result.types).toBe(dts);
          }
          // Phase 25 de-CSS-Modules: React scoped-CSS sidecar fixture is now
          // a plain `.css` file (was `.module.css`); `result.css` content is
          // unchanged — only the on-disk extension moved.
          const moduleCss = loadSidecarOrNull(name, '.css');
          if (moduleCss !== null && result.css) {
            expect(normalizeCss(result.css)).toBe(moduleCss);
          }
          const globalCss = loadSidecarOrNull(name, '.global.css');
          if (globalCss !== null && result.globalCss) {
            expect(normalizeCss(result.globalCss)).toBe(globalCss);
          }
        }
      });

      it('Leg 2 — CLI runBuildMatrix produces fixture bytes', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-parity-cli-'));
        try {
          // Phase 23 — off-state probe drives the CLI with --no-cva (cva:false)
          // for its Angular leg.
          const cvaOff = target === 'angular' && FIXTURE_ANGULAR_CVA_OFF.has(name);
          await runBuildMatrix(
            [rozieSourcePath],
            {
              target: [target],
              out: tmpDir,
              types: true,
              sourceMap: false,
              root: ROOT,
              ...(cvaOff ? { cva: false } : {}),
            },
            { exit: 'throw' },
          );
          // D-89 layout: <outDir>/<target>/<source-rel>/<name>.<ext>
          const outPath = resolve(tmpDir, target, 'examples', `${name}${emittedExt(target)}`);
          const cliBytes = readFileSync(outPath, 'utf8');
          // WR-04: CLI writes result.code raw; assert strict bytes with LF.
          expect(cliBytes.endsWith('\n')).toBe(true);
          expect(cliBytes).toBe(fixture);

          if (target === 'react') {
            const dtsFix = loadSidecarOrNull(name, '.d.ts');
            if (dtsFix !== null) {
              const cliDts = readFileSync(outPath.replace(/\.tsx$/, '.d.ts'), 'utf8');
              expect(cliDts.endsWith('\n')).toBe(true);
              expect(cliDts).toBe(dtsFix);
            }
            const cssFix = loadSidecarOrNull(name, '.css');
            if (cssFix !== null) {
              // Phase 25 de-CSS-Modules: React now writes a PLAIN `.css`
              // sibling (was `.module.css`); the parity-corpus fixture is
              // likewise a plain `.css` file. `result.css` content is
              // unchanged — only the on-disk extension moved.
              const cliCss = readFileSync(outPath.replace(/\.tsx$/, '.css'), 'utf8');
              expect(normalizeCss(cliCss)).toBe(cssFix);
            }
            const globalFix = loadSidecarOrNull(name, '.global.css');
            if (globalFix !== null) {
              const cliGlobal = readFileSync(outPath.replace(/\.tsx$/, '.global.css'), 'utf8');
              expect(normalizeCss(cliGlobal)).toBe(globalFix);
            }
          }
        } finally {
          rmSync(tmpDir, { recursive: true, force: true });
        }
      });

      it('Leg 3 — babel-plugin produces fixture bytes via sibling write', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-parity-babel-'));
        try {
          // Stage the .rozie file in tmpDir so the importer's dirname
          // resolves correctly; the babel-plugin reads `${name}.rozie`
          // sibling-relative to state.filename (the importer).
          const tmpRozie = join(tmpDir, `${name}.rozie`);
          writeFileSync(tmpRozie, rozieSource, 'utf8');
          // Phase 07.2 Plan 06 — multi-rozie examples (ModalConsumer)
          // additionally stage the sibling .rozie producers so the
          // babel-plugin's compile() can resolve `<components>` imports
          // through the IR cache + ProducerResolver.
          const siblings = EXAMPLE_SIBLING_ROZIE[name] ?? [];
          for (const sibling of siblings) {
            const srcPath = resolve(ROOT, 'examples', sibling);
            writeFileSync(join(tmpDir, sibling), readFileSync(srcPath, 'utf8'), 'utf8');
          }
          const importer = join(tmpDir, 'consumer.ts');
          writeFileSync(importer, `import X from './${name}.rozie';`, 'utf8');

          // T-06-06-05 mitigation — capture pre-test mtime watermark so we
          // can assert the sibling was written DURING this test (rather
          // than picked up stale from a prior bootstrap run).
          const testStartMs = Date.now();
          // Slight pad so a same-millisecond write still satisfies > start.
          await new Promise((r) => setTimeout(r, 5));

          // Phase 23 — off-state probe drives the babel-plugin with the
          // angular: { cva: false } namespace for its Angular leg.
          const cvaOff = target === 'angular' && FIXTURE_ANGULAR_CVA_OFF.has(name);
          await transformAsync(readFileSync(importer, 'utf8'), {
            filename: importer,
            plugins: [[rozieBabelPlugin, { target, ...(cvaOff ? { angular: { cva: false } } : {}) }]],
            babelrc: false,
            configFile: false,
          });

          const sibling = join(tmpDir, `${name}${emittedExt(target)}`);
          const siblingMs = statSync(sibling).mtimeMs;
          expect(siblingMs).toBeGreaterThanOrEqual(testStartMs);

          const babelBytes = readFileSync(sibling, 'utf8');
          // WR-04: babel-plugin writes result.code raw; assert strict bytes with LF.
          expect(babelBytes.endsWith('\n')).toBe(true);
          expect(babelBytes).toBe(fixture);

          if (target === 'react') {
            const dtsFix = loadSidecarOrNull(name, '.d.ts');
            if (dtsFix !== null) {
              const babelDts = readFileSync(sibling.replace(/\.tsx$/, '.d.ts'), 'utf8');
              expect(babelDts.endsWith('\n')).toBe(true);
              expect(babelDts).toBe(dtsFix);
            }
            const cssFix = loadSidecarOrNull(name, '.css');
            if (cssFix !== null) {
              // Phase 25 de-CSS-Modules: React now writes a PLAIN `.css`
              // sibling (was `.module.css`); the parity-corpus fixture is
              // likewise a plain `.css` file. `result.css` content is
              // unchanged — only the on-disk extension moved.
              const babelCss = readFileSync(sibling.replace(/\.tsx$/, '.css'), 'utf8');
              expect(normalizeCss(babelCss)).toBe(cssFix);
            }
            const globalFix = loadSidecarOrNull(name, '.global.css');
            if (globalFix !== null) {
              const babelGlobal = readFileSync(sibling.replace(/\.tsx$/, '.global.css'), 'utf8');
              expect(normalizeCss(babelGlobal)).toBe(globalFix);
            }
          }
        } finally {
          rmSync(tmpDir, { recursive: true, force: true });
        }
      });

      it('Leg 4 — unplugin createTransformHook produces fixture bytes', () => {
        const registry = new ModifierRegistry();
        registerBuiltins(registry);
        // Phase 23 — off-state probe threads cva:false into the unplugin hook
        // (the third createTransformHook arg) for its Angular leg.
        const cvaOff = target === 'angular' && FIXTURE_ANGULAR_CVA_OFF.has(name);
        const hook = createTransformHook(registry, target, cvaOff ? false : undefined);
        // Invoke with an empty `this` — the production plugin context carries
        // `addWatchFile` / `warn` / `error`; the hook tolerates their absence
        // (existing transform.test cases verify this).
        //
        // Phase 07.2 Plan 06 — multi-rozie examples (ModalConsumer) need the
        // absolute consumer path so unplugin's threadParamTypesForPipeline
        // helper (Plan 07.2-03) computes resolverRoot = dirname(filePath)
        // correctly and the IR cache can resolve sibling .rozie producers.
        const hasSiblings = name in EXAMPLE_SIBLING_ROZIE;
        const filePathForHook = hasSiblings ? rozieSourcePath : `${name}.rozie`;
        const result = hook.call({}, rozieSource, filePathForHook);
        expect(result).not.toBeNull();
        // WR-04: unplugin's createTransformHook returns the same compile()
        // result.code; the trailing-LF contract applies here too.
        expect(result!.code.endsWith('\n')).toBe(true);
        expect(result!.code).toBe(fixture);
        // .map parity deferred to v2 per RESEARCH OQ4 — would compare JSON
        // mappings only, ignoring file/sources fields. v1 omits.
      });
    });
  });
});

/**
 * Phase 23 (angular-cva-forms-integration) Plan 04 — off-state byte-equality
 * gate (SPEC-6 / Pitfall 2).
 *
 * The CvaOffState fixture's Angular leg is emitted with `cva: false` by ALL
 * FOUR entrypoints (asserted byte-equal by the main parity block above via the
 * FIXTURE_ANGULAR_CVA_OFF set). This block adds the SEMANTIC off-state
 * assertions on top of byte-equality:
 *
 *   1. The cva:false Angular output contains NO CVA surface (no
 *      NG_VALUE_ACCESSOR provider, no writeValue / the other accessor methods).
 *   2. All four entrypoints produce byte-IDENTICAL cva:false Angular output
 *      for it (re-asserted directly here for a focused failure message — the
 *      main block asserts each leg == the committed fixture, which transitively
 *      proves cross-leg equality).
 *   3. The default-ON emit DOES contain the CVA surface (the off-state is a
 *      real suppression, not a fixture that never had CVA).
 *
 * This is the load-bearing dist-parity proof that the emitter-side
 * `opts.cva ?? true` default + identical threading across compile() /
 * CLI / babel-plugin / unplugin cannot diverge.
 */
describe('Phase 23 — CvaOffState off-state cva:false byte-equality across four entrypoints', () => {
  const name = 'CvaOffState';
  const rozieSourcePath = resolve(ROOT, `examples/${name}.rozie`);
  const rozieSource = readFileSync(rozieSourcePath, 'utf8');

  // Leg 1 (compile) cva:false output — the reference for the off-state checks.
  const offResult = compile(rozieSource, {
    target: 'angular',
    filename: `${name}.rozie`,
    angular: { cva: false },
    types: true,
    sourceMap: false,
  });

  it('cva:false Angular emit contains NO CVA surface', () => {
    expect(offResult.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(offResult.code).not.toContain('NG_VALUE_ACCESSOR');
    expect(offResult.code).not.toContain('writeValue');
    expect(offResult.code).not.toContain('registerOnChange');
    expect(offResult.code).not.toContain('setDisabledState');
    expect(offResult.code).not.toContain('__rozieCvaOnChange');
  });

  it('default-ON Angular emit DOES contain the CVA surface (off-state is a real suppression)', () => {
    const onResult = compile(rozieSource, {
      target: 'angular',
      filename: `${name}.rozie`,
      types: true,
      sourceMap: false,
    });
    expect(onResult.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(onResult.code).toContain('NG_VALUE_ACCESSOR');
    expect(onResult.code).toContain('writeValue');
  });

  it('cva:false Angular output is byte-identical across all four entrypoints', async () => {
    // Leg 1 — compile() (already computed as offResult above).
    const leg1 = offResult.code;

    // Leg 2 — CLI runBuildMatrix with --no-cva (cva:false).
    const cliTmp = mkdtempSync(join(tmpdir(), 'rozie-parity-cvaoff-cli-'));
    let leg2: string;
    try {
      await runBuildMatrix(
        [rozieSourcePath],
        { target: ['angular'], out: cliTmp, types: true, sourceMap: false, root: ROOT, cva: false },
        { exit: 'throw' },
      );
      leg2 = readFileSync(resolve(cliTmp, 'angular', 'examples', `${name}.ts`), 'utf8');
    } finally {
      rmSync(cliTmp, { recursive: true, force: true });
    }

    // Leg 3 — babel-plugin with angular: { cva: false }.
    const babelTmp = mkdtempSync(join(tmpdir(), 'rozie-parity-cvaoff-babel-'));
    let leg3: string;
    try {
      const tmpRozie = join(babelTmp, `${name}.rozie`);
      writeFileSync(tmpRozie, rozieSource, 'utf8');
      const importer = join(babelTmp, 'consumer.ts');
      writeFileSync(importer, `import X from './${name}.rozie';`, 'utf8');
      await transformAsync(readFileSync(importer, 'utf8'), {
        filename: importer,
        plugins: [[rozieBabelPlugin, { target: 'angular', angular: { cva: false } }]],
        babelrc: false,
        configFile: false,
      });
      leg3 = readFileSync(join(babelTmp, `${name}.ts`), 'utf8');
    } finally {
      rmSync(babelTmp, { recursive: true, force: true });
    }

    // Leg 4 — unplugin createTransformHook(registry, 'angular', false).
    const registry = new ModifierRegistry();
    registerBuiltins(registry);
    const hook = createTransformHook(registry, 'angular', false);
    const leg4Result = hook.call({}, rozieSource, `${name}.rozie`);
    expect(leg4Result).not.toBeNull();
    const leg4 = leg4Result!.code;

    // Cross-leg byte-equality (trim only the trailing-newline divergence that
    // the CLI/babel raw-write vs compile()-direct paths may differ on — the
    // main parity block already asserts each leg == the LF-terminated fixture).
    expect(leg2.trim()).toBe(leg1.trim());
    expect(leg3.trim()).toBe(leg1.trim());
    expect(leg4.trim()).toBe(leg1.trim());

    // And none of the legs carry CVA surface.
    for (const code of [leg1, leg2, leg3, leg4]) {
      expect(code).not.toContain('NG_VALUE_ACCESSOR');
      expect(code).not.toContain('writeValue');
    }
  });
});

/**
 * WR-07 (Phase 07.4 review) — snapshot/dist-parity Lit fixture byte-identity.
 *
 * The 8 Lit reference examples are fixtured in two places that BOTH come
 * from the same `compile()` output of the same `.rozie` source:
 *
 *   • `packages/targets/lit/src/__tests__/fixtures/<Name>.lit.ts.snap`
 *     — the target-lit unit-test snapshot (Vitest `toMatchFileSnapshot`).
 *   • `tests/dist-parity/fixtures/<Name>.lit.ts`
 *     — the canonical baseline bytes that all 4 distribution entrypoints
 *     (compile / CLI / babel-plugin / unplugin) must produce.
 *
 * They MUST agree byte-for-byte. Without this guard, a future emit change
 * that regenerates one file via `pnpm --filter @rozie/target-lit test -u`
 * but forgets `pnpm --filter dist-parity bootstrap` (or vice versa) leaves
 * silent drift — the dist-parity gate keeps asserting the OLD shape and
 * production consumers ship the NEW shape.
 *
 * This is option (c) from the WR-07 review fix: "add a test that asserts
 * byte-identity between the two sets and fails CI if they drift." Symlinks
 * (option a) and pretest-hook generation (option b) were rejected for
 * platform/portability reasons.
 *
 * The two extra dist-parity fixtures (ModalConsumer, WrapperModal) are
 * consumer-side and have no snap counterpart — excluded from this check.
 */
describe('WR-07 — snap/dist-parity Lit fixture byte-identity', () => {
  const LIT_OVERLAP = [
    'Counter',
    'SearchInput',
    'Dropdown',
    'TodoList',
    'Modal',
    'TreeNode',
    'Card',
    'CardHeader',
  ] as const;

  describe.each(LIT_OVERLAP)('%s', (name) => {
    it('__tests__/fixtures/*.lit.ts.snap == tests/dist-parity/fixtures/*.lit.ts', () => {
      const snapPath = resolve(
        ROOT,
        'packages/targets/lit/src/__tests__/fixtures',
        `${name}.lit.ts.snap`,
      );
      const distPath = resolve(FIXTURES_DIR, `${name}.lit.ts`);
      const snap = readFileSync(snapPath, 'utf8');
      const dist = readFileSync(distPath, 'utf8');
      // Bytes must match exactly. If this fails, regenerate BOTH:
      //   pnpm --filter @rozie/target-lit test -u
      //   pnpm --filter dist-parity bootstrap
      expect(snap).toBe(dist);
    });
  });
});
