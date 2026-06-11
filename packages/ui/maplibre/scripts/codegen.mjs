/**
 * codegen.mjs — the single parse-once → emit-6 → render-READMEs engine for
 * @rozie-ui/maplibre.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive the @rozie-ui/codemirror codegen
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as the codemirror codegen + the in-compile ROZ977 guard); per the
 * scope fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * Like @rozie-ui/codemirror (and UNLIKE @rozie-ui/sortable-list) there is NO
 * `src/internal/` helper to vendor: MapLibre.rozie imports `maplibre-gl`
 * directly, so the leaves carry no colocated bridge and there is NO
 * internal-helper copy step.
 *
 * Divergences from the CodeMirror codegen analog:
 *   - NO `languages.ts` sibling module / `/languages` subpath: that is a
 *     CodeMirror-specific tree-shakable language-preset surface. MapLibre ships
 *     ONLY the component, so the entire G2 language-preset machinery
 *     (`LANGUAGES_TS`, `LANG_EXTERNALS`, `patchLeafLangPackaging`) is omitted.
 *   - NO per-leaf type-aid `code.replace(...)` patches: MapLibre's 6 emits
 *     compile strict-tsc-clean as-authored (verified), so the CodeMirror
 *     `themeExt`/`langExt`/`buildMarkers` `: any` annotations have no analog here.
 *     If a future emit shape needs one, ADD it as a fail-loud token-anchored
 *     replace (the CodeMirror pattern) — do NOT edit the emitter (SCOPE FENCE).
 *   - Events README heading SHIPS (MapLibre is event-ful; readme.mjs gates it on
 *     ir.emits.length > 0 — the chartjs analog).
 *
 * BUILD-ORDER CONTRACT: this script writes each leaf's src/MapLibre.*, so it
 * MUST run before the bundled-leaf tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/MapLibre.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write MapLibre.css + MapLibre.global.css + MapLibre.d.ts)
 *   4. render each leaf README from the IR + the hand-kept handle manifest
 *   5. ENFORCE validateDocsPropsTable against docs/components/maplibre.md
 *      (THROWS if the guide is absent AND on drift of the IR-derivable
 *      structural columns — prop name, type, default. Never rewrites the
 *      hand-authored prose. Wave 3 ships the guide; until then the
 *      ROZIE_MAPLIBRE_SKIP_GUIDE escape hatch relaxes the throw to a skip
 *      — see the step-(5) block.)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/maplibre
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root

// Phase 37: the package now ships the parent <MapLibre> PLUS the declarative
// <Source>/<Layer> children (the dogfood of the Phase 36 $provide/$inject
// primitive). Codegen compiles each sibling .rozie source into all 6 leaves (the
// chartjs multi-variant precedent). MapLibre MUST be FIRST — it owns the
// handle-manifest + docs-table validation gates (the renderless children have no
// $expose / docs page); the children are pure additions.
const PARENT = 'MapLibre';
const COMPONENTS = [PARENT, 'Source', 'Layer'];

/** Per-target leaf dir + emitted file extension (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', ext: 'tsx', build: 'tsdown' },
  vue: { dir: 'vue', ext: 'vue', build: 'source' },
  svelte: { dir: 'svelte', ext: 'svelte', build: 'source' },
  angular: { dir: 'angular', ext: 'ts', build: 'source' },
  solid: { dir: 'solid', ext: 'tsx', build: 'tsdown' },
  lit: { dir: 'lit', ext: 'ts', build: 'tsdown' },
};

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.name;
}

function main() {
  // Read every component source once. Keyed by component name.
  const sources = Object.fromEntries(
    COMPONENTS.map((name) => [name, readFileSync(resolve(ROOT, `src/${name}.rozie`), 'utf8')]),
  );

  // (2) parse + lower the PARENT ONCE for the doc tables + handle manifest. The
  // renderless <Source>/<Layer> children have no $expose and no docs page, so the
  // handle-manifest + docs-table validation gates apply to MapLibre only.
  const { ast } = parse(sources[PARENT], { filename: `${PARENT}.rozie` });
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

  // Keep the hand-kept handle manifest in lockstep with ir.expose (Phase 21).
  for (const m of ir.expose) {
    if (!handleManifest[m.name]) {
      throw new Error(
        `codegen: method "${m.name}" is exposed by the source but has no entry in handle-manifest.mjs`,
      );
    }
  }

  // (3)(4) per-target emit + README. Outer loop = target; inner loop = component.
  for (const [target, cfg] of Object.entries(TARGETS)) {
    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    // Compile each sibling component into this leaf. The SCOPE FENCE throw is
    // applied to EACH compile — an error means a mis-wired codegen/authoring path,
    // NEVER an emitter edit (escalate as a compiler gap instead).
    for (const componentName of COMPONENTS) {
      const filename = `${componentName}.rozie`;
      const r = compile(sources[componentName], { target, filename });
      const errs = r.diagnostics.filter((d) => d.severity === 'error');
      if (errs.length) {
        throw new Error(
          `codegen ${target} ${componentName}: compile emitted error diagnostics (SCOPE FENCE: do NOT edit any emitter — fix the codegen path):\n` +
            errs.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
        );
      }

      // MapLibre's emits compile strict-tsc-clean as-authored (verified across all
      // leaves); the renderless children likewise. There is NO per-leaf type-aid
      // `code.replace(...)` patch. Emit the compiled code verbatim.
      writeFileSync(resolve(leafSrc, `${componentName}.${cfg.ext}`), r.code);

      // React-only sidecars, per component. The renderless children emit no CSS
      // and no synthesized handle type — the `if (r.css)` / `if (r.types)` guards
      // already handle absence; the global-css cleanup removes a stale sidecar if
      // a component carries no nested-:root engine rules.
      if (target === 'react') {
        if (r.css) writeFileSync(resolve(leafSrc, `${componentName}.css`), r.css);
        const globalCssPath = resolve(leafSrc, `${componentName}.global.css`);
        if (r.globalCss) {
          writeFileSync(globalCssPath, r.globalCss);
        } else if (existsSync(globalCssPath)) {
          rmSync(globalCssPath);
        }
        if (r.types) writeFileSync(resolve(leafSrc, `${componentName}.d.ts`), r.types);
      }
    }

    // Bundled leaves (tsdown) entry on src/index.ts. Each component is a DEFAULT
    // export, so the multi-export barrel re-exports every component's default under
    // its named export (an `export *` would NOT forward a default). The PARENT
    // also re-exports the package default + the `MapLibreHandle` type (React/Solid
    // emit `export interface MapLibreHandle` in the .tsx; Lit's handle is the
    // custom element itself, so it gets no named type).
    if (cfg.build === 'tsdown') {
      const childExports = COMPONENTS.filter((n) => n !== PARENT)
        .map((n) => `export { default as ${n} } from './${n}';\n`)
        .join('');
      const parentBlock =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as MapLibre } from './MapLibre';\n` +
            `export { default } from './MapLibre';\n` +
            childExports +
            `\n/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { MapLibreHandle } from './MapLibre';\n`
          : `export { default as MapLibre } from './MapLibre';\nexport { default } from './MapLibre';\n` +
            childExports;
      writeFileSync(resolve(leafSrc, 'index.ts'), parentBlock);
    }

    // (4) README from the single PARENT IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // Vendor the repo LICENSE into each published leaf so the tarball carries
    // its own MIT license text (the root LICENSE does not propagate into
    // per-package tarballs). Copy-from-root keeps the 6 copies from drifting.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .global.css + .d.ts)' : '';
    const files = COMPONENTS.map((n) => `${n}.${cfg.ext}`).join(', ');
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/{${files}}${sidecars}  ✓`);
  }

  // (5) ENFORCE docs props-table validation: the IR-derivable structural columns
  // (prop name + type + default) in docs/components/maplibre.md MUST match ir.props
  // or this script THROWS. It does NOT overwrite the hand-authored prose
  // (Runtime-updatable? column + Descriptions stay) — VALIDATE-NOT-OVERWRITE. The
  // docs file is the single-source-of-truth surface for the structural columns;
  // reconcile the table (not the validator) if it drifts. (Same ENFORCING shape
  // as @rozie-ui/codemirror.)
  //
  // Wave 3 authors docs/components/maplibre.md. Until it lands, the
  // ROZIE_MAPLIBRE_SKIP_GUIDE env escape hatch relaxes the absent-guide throw to
  // a skip so this wave can emit the leaves first. Wave 3 runs codegen WITHOUT
  // the flag, flipping validation back to ENFORCING-passing.
  const guideRelPath = 'docs/components/maplibre.md';
  const guideExists = existsSync(resolve(REPO_ROOT, guideRelPath));
  const skipGuide = process.env.ROZIE_MAPLIBRE_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    // ENFORCING: an absent guidePath is a HARD failure (the docs page ships a
    // real props table). throw here so codegen cannot silently emit leaves
    // without the single-source-of-truth docs surface.
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). Wave 3 authors it; to emit the leaves ` +
        `before then, run with ROZIE_MAPLIBRE_SKIP_GUIDE=1.`,
    );
  }
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  if (!guideExists) {
    console.log(
      'codegen: docs props-table validation SKIPPED — docs/components/maplibre.md not yet authored ' +
        '(ROZIE_MAPLIBRE_SKIP_GUIDE=1; Wave 3 authors the guide and re-runs WITHOUT the flag).',
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

  console.log(
    `codegen: done — ${COMPONENTS.length} components × 6 targets emitted (${COMPONENTS.join(', ')}), 6 READMEs rendered, 6 LICENSEs vendored.`,
  );
}

main();
