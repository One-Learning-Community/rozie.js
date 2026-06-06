/**
 * codegen.mjs — the single parse-once → emit-6 → render-READMEs engine for
 * @rozie-ui/chartjs.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive docs/.vitepress/rozie-codegen.ts
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as rozie-codegen.ts + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * Like @rozie-ui/codemirror (and UNLIKE @rozie-ui/sortable-list) there is NO
 * `src/internal/` helper to vendor: Chart.rozie imports the `chart.js` engine
 * package directly, so the leaves carry no colocated bridge and there is NO
 * internal-helper copy step.
 *
 * Divergences from the CodeMirror codegen analog:
 *   - The Events README heading SHIPS (`ir.emits.length > 0` — Chart.js is
 *     event-ful: @click/@hover/@datasetClick), where CodeMirror gated it OUT.
 *   - NO Lit `: any` type aid: CodeMirror needed one because its top-level
 *     `langExt`/`themeExt`/`phExt` arrows inferred a transitive `@codemirror/*`
 *     return type that tsdown's isolated-dts couldn't name (TS2742). Chart's
 *     engine-typed helpers (buildConfig/tooltipExternal/composed handlers) all
 *     live INSIDE $onMount and are not hoisted to class fields, so no such
 *     un-nameable inferred return type surfaces. (If a future emit shape change
 *     reintroduces TS2742 on a hoisted helper, add a scoped codegen aid here
 *     — SCOPE FENCE: do NOT edit the emitter.)
 *
 * BUILD-ORDER CONTRACT: this script writes each leaf's src/Chart.*, so it MUST
 * run before the bundled-leaf tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/Chart.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write Chart.css + Chart.d.ts)
 *   4. render each leaf README from the IR + the hand-kept handle manifest
 *   5. ENFORCE validateDocsPropsTable against docs/guide/chartjs.md
 *      (THROWS if the guide is absent AND on drift of the IR-derivable
 *      structural columns. The ROZIE_CHARTJS_SKIP_GUIDE escape hatch relaxes the
 *      absent-guide throw to a skip so the leaves can be emitted before the
 *      guide lands — Plan 30-03 authors the guide and re-runs WITHOUT the flag.)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/chartjs
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/Chart.rozie');
const FILENAME = 'Chart.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'Chart.tsx', build: 'tsdown' },
  vue: { dir: 'vue', file: 'Chart.vue', build: 'source' },
  svelte: { dir: 'svelte', file: 'Chart.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'Chart.ts', build: 'source' },
  solid: { dir: 'solid', file: 'Chart.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'Chart.ts', build: 'tsdown' },
};

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.name;
}

function main() {
  const source = readFileSync(SRC, 'utf8');

  // (2) parse + lower ONCE for the doc tables.
  const { ast } = parse(source, { filename: FILENAME });
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

  // Keep the hand-kept handle manifest in lockstep with ir.expose (Phase 21).
  for (const m of ir.expose) {
    if (!handleManifest[m.name]) {
      throw new Error(
        `codegen: method "${m.name}" is exposed by the source but has no entry in handle-manifest.mjs`,
      );
    }
  }

  // (3)(4) per-target emit + README.
  for (const [target, cfg] of Object.entries(TARGETS)) {
    const r = compile(source, { target, filename: FILENAME });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    if (errs.length) {
      throw new Error(
        `codegen ${target}: compile emitted error diagnostics (SCOPE FENCE: do NOT edit any emitter — fix the codegen path):\n` +
          errs.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
      );
    }

    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    writeFileSync(resolve(leafSrc, cfg.file), r.code);

    // Bundled leaves (tsdown) entry on src/index.ts. The emitted component is a
    // DEFAULT export, so the barrel re-exports the default under the named
    // `Chart` the READMEs/consumers import (an `export *` would NOT forward a
    // default).
    if (cfg.build === 'tsdown') {
      // React AND Solid: re-export the named `ChartHandle` type directly from
      // the component module (the React/Solid emitters emit the synthesized
      // handle interface as `export interface ChartHandle` in the .tsx itself —
      // Phase 21 REQ-10 follow-up), so consumers can `import type { ChartHandle }`
      // and the barrel forwards it verbatim. Lit gets no named type: its handle
      // is the custom element itself.
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as Chart } from './Chart';\n` +
            `export { default } from './Chart';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { ChartHandle } from './Chart';\n`
          : `export { default as Chart } from './Chart';\nexport { default } from './Chart';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'Chart.css'), r.css);
      if (r.types) writeFileSync(resolve(leafSrc, 'Chart.d.ts'), r.types);
    }

    // (4) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // Vendor the repo LICENSE into each published leaf so the tarball carries
    // its own MIT license text (the root LICENSE does not propagate into
    // per-package tarballs).
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓`);
  }

  // (5) ENFORCE docs props-table validation: the IR-derivable structural columns
  // (prop name + type + default) in docs/guide/chartjs.md MUST match ir.props or
  // this script THROWS. It does NOT overwrite the hand-authored prose
  // (Runtime-updatable? column + Descriptions stay) — VALIDATE-NOT-OVERWRITE.
  //
  // Plan 30-03 authors docs/guide/chartjs.md. Until it lands, the
  // ROZIE_CHARTJS_SKIP_GUIDE env escape hatch relaxes the absent-guide throw to
  // a skip so Plan 30-02 can emit the leaves first. Plan 30-03 runs codegen
  // WITHOUT the flag, flipping validation back to ENFORCING-passing.
  const guideRelPath = 'docs/guide/chartjs.md';
  const guideExists = existsSync(resolve(REPO_ROOT, guideRelPath));
  const skipGuide = process.env.ROZIE_CHARTJS_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). Plan 30-03 authors it; to emit the leaves ` +
        `before then, run with ROZIE_CHARTJS_SKIP_GUIDE=1.`,
    );
  }
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  if (!guideExists) {
    console.log(
      'codegen: docs props-table validation SKIPPED — docs/guide/chartjs.md not yet authored ' +
        '(ROZIE_CHARTJS_SKIP_GUIDE=1; Plan 30-03 authors the guide and re-runs WITHOUT the flag).',
    );
  } else {
    const docs = readFileSync(guidePath, 'utf8');
    const result = validateDocsPropsTable(ir, docs);
    if (!result.ok) {
      throw new Error(
        `codegen: docs props-table validation DRIFT — the IR-derivable structural columns in ${guidePath} ` +
          `do not match ir.props. Fix ONLY the structural columns in the docs table (preserve the ` +
          `Runtime-updatable? + Description prose); do NOT weaken this validator:\n` +
          result.errors.map((e) => `  - ${e}`).join('\n'),
      );
    }
    console.log(
      `codegen: docs props-table validation PASS — ${result.checkedRows} rows match ir.props (ENFORCING; throws on drift)`,
    );
  }

  console.log('codegen: done — 6 targets emitted, 6 READMEs rendered, 6 LICENSEs vendored.');
}

main();
