/**
 * codegen.mjs — the single parse-once → emit-6 → render-READMEs engine for
 * @rozie-ui/tiptap.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry). NO compiler/emitter/IR change. If a compile() call
 * emits an error-severity diagnostic this script THROWS (scope fence: an error
 * means a mis-wired codegen path, never an emitter edit).
 *
 * Single-component shape (NOT the Chart.js multi-variant generalization — TipTap
 * is ONE editor). Like @rozie-ui/codemirror there is NO `src/internal/` helper to
 * vendor: TipTap.rozie imports `@tiptap/*` directly.
 *
 * Divergence from the CodeMirror analog: TipTap emits events
 * (update/selectionUpdate/focus/blur), so the Events README heading SHIPS
 * (ir.emits.length > 0), like @rozie-ui/chartjs.
 *
 * BUILD-ORDER CONTRACT: this writes each leaf's src/TipTap.*, so it MUST run
 * before the bundled-leaf (react/solid/lit) tsdown builds.
 *
 * Steps:
 *   1. read src/TipTap.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write TipTap.css + TipTap.d.ts; bundled leaves get a
 *         src/index.ts barrel)
 *   4. render each leaf README from the IR + the hand-kept handle manifest
 *   5. ENFORCE validateDocsPropsTable against docs/components/tiptap.md (THROWS if the
 *      guide is absent AND on drift of name/type/default).
 *
 *      ROZIE_TIPTAP_SKIP_GUIDE=1 was the Wave-02 bootstrap escape hatch — it
 *      relaxed the absent-guide throw to a skip so leaves could emit before Wave 03
 *      authored the guide. As of Phase 33 (Wave 04, plan 33-05) docs/components/tiptap.md
 *      SHIPS, so the bootstrap window is CLOSED: normal runs are ENFORCING with no
 *      flag, and even with the flag set the props-table validator still runs (the
 *      flag only ever relaxed the *absent-guide* throw, never the drift check). The
 *      branch is retained only as a guarded historical fallback; do not set the flag.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/tiptap
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/TipTap.rozie');
const FILENAME = 'TipTap.rozie';

/** Per-target leaf dir + emitted filename + build mode. */
const TARGETS = {
  react: { dir: 'react', file: 'TipTap.tsx', build: 'tsdown' },
  vue: { dir: 'vue', file: 'TipTap.vue', build: 'source' },
  svelte: { dir: 'svelte', file: 'TipTap.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'TipTap.ts', build: 'source' },
  solid: { dir: 'solid', file: 'TipTap.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'TipTap.ts', build: 'tsdown' },
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
    // `TipTap` consumers import (an `export *` would NOT forward a default).
    // React AND Solid also re-export the named `TipTapHandle` interface their
    // emitters synthesize in the component module; Lit's handle is the custom
    // element itself, so the plain barrel is correct there.
    if (cfg.build === 'tsdown') {
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as TipTap } from './TipTap';\n` +
            `export { default } from './TipTap';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { TipTapHandle } from './TipTap';\n`
          : `export { default as TipTap } from './TipTap';\nexport { default } from './TipTap';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'TipTap.css'), r.css);
      // The React emitter routes nested-`:root` engine rules (the placeholder
      // ghost-text escape-hatch CSS, G3 / Phase 34) into `r.globalCss` and emits
      // a sibling `import './TipTap.global.css';` side effect in the `.tsx`. Write
      // the sidecar whenever it is present so that import resolves; without it the
      // regenerated leaf imports a non-existent file. Keep it in lockstep with the
      // emit (the CodeMirror/Chart.js WR-03 discipline): if a future .rozie edit
      // removes all nested-:root engine rules, r.globalCss becomes null and the
      // emitted .tsx drops the import — clean up the stale sidecar so it does not
      // linger unreferenced in the tarball.
      const globalCssPath = resolve(leafSrc, 'TipTap.global.css');
      if (r.globalCss) {
        writeFileSync(globalCssPath, r.globalCss);
      } else if (existsSync(globalCssPath)) {
        rmSync(globalCssPath);
      }
      if (r.types) writeFileSync(resolve(leafSrc, 'TipTap.d.ts'), r.types);
    }

    // (4) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // Vendor the repo LICENSE into each published leaf (root LICENSE does not
    // propagate into per-package tarballs).
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓`);
  }

  // (5) ENFORCE docs props-table validation against docs/components/tiptap.md.
  // The guide SHIPS as of Phase 33 — the Wave-02 bootstrap window is CLOSED. The
  // skip flag is retained only as a guarded historical fallback (do not set it).
  const guideRelPath = 'docs/components/tiptap.md';
  const guideExists = existsSync(resolve(REPO_ROOT, guideRelPath));
  const skipGuide = process.env.ROZIE_TIPTAP_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). It shipped in Phase 33; if it is missing, ` +
        `restore it — do NOT re-enable the retired ROZIE_TIPTAP_SKIP_GUIDE bootstrap.`,
    );
  }
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  if (!guideExists) {
    console.log(
      'codegen: docs props-table validation SKIPPED — docs/components/tiptap.md not yet authored ' +
        '(ROZIE_TIPTAP_SKIP_GUIDE=1; Wave 03 authors the guide and re-runs WITHOUT the flag).',
    );
  } else {
    const docs = readFileSync(guidePath, 'utf8');
    const result = validateDocsPropsTable(ir, docs);
    if (!result.ok) {
      throw new Error(
        `codegen: docs props-table validation DRIFT — fix ONLY the structural columns in ${guidePath} ` +
          `(preserve the hand-authored prose); do NOT weaken this validator:\n` +
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
