/**
 * codegen.mjs — the single parse-once → emit-6 → render-READMEs engine for
 * @rozie-ui/rete.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive the @rozie-ui/maplibre codegen
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract + the in-compile ROZ977 guard); per the scope fence, an error means a
 * mis-wired codegen path, never an emitter edit.
 *
 * Like @rozie-ui/maplibre, FlowCanvas.rozie imports the engine packages (`rete`,
 * `rete-area-plugin`, `rete-connection-plugin`, `rete-render-utils`) directly, so
 * the leaves carry no colocated bridge and there is NO internal-helper copy step.
 *
 * BUILD-ORDER CONTRACT: this writes each leaf's src/FlowCanvas.*, so it MUST run
 * before the bundled-leaf tsdown builds (`turbo run build --force`).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/rete
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/FlowCanvas.rozie');
const FILENAME = 'FlowCanvas.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'FlowCanvas.tsx', build: 'tsdown' },
  vue: { dir: 'vue', file: 'FlowCanvas.vue', build: 'source' },
  svelte: { dir: 'svelte', file: 'FlowCanvas.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'FlowCanvas.ts', build: 'source' },
  solid: { dir: 'solid', file: 'FlowCanvas.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'FlowCanvas.ts', build: 'tsdown' },
};

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.name;
}

function main() {
  const source = readFileSync(SRC, 'utf8');

  // parse + lower ONCE for the doc tables.
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

    // FlowCanvas.rozie's 6 emits compile strict-tsc-clean as-authored (the engine
    // calls route through null-let `any` instances), so there is NO per-leaf
    // type-aid `code.replace(...)` patch. If a future emit shape needs one, ADD it
    // as a fail-loud token-anchored replace (the CodeMirror pattern) — do NOT edit
    // the emitter (SCOPE FENCE).
    const code = r.code;
    writeFileSync(resolve(leafSrc, cfg.file), code);

    // Bundled leaves (tsdown) entry on src/index.ts. The emitted component is a
    // DEFAULT export, so the barrel re-exports the default under the named
    // `FlowCanvas` the READMEs/consumers import. React AND Solid also forward the
    // synthesized `FlowCanvasHandle` type emitted into the .tsx.
    if (cfg.build === 'tsdown') {
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as FlowCanvas } from './FlowCanvas';\n` +
            `export { default } from './FlowCanvas';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { FlowCanvasHandle } from './FlowCanvas';\n`
          : `export { default as FlowCanvas } from './FlowCanvas';\nexport { default } from './FlowCanvas';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars (scoped CSS + the :root engine-DOM escape-hatch CSS +
    // the synthesized handle .d.ts).
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'FlowCanvas.css'), r.css);
      const globalCssPath = resolve(leafSrc, 'FlowCanvas.global.css');
      if (r.globalCss) {
        writeFileSync(globalCssPath, r.globalCss);
      } else if (existsSync(globalCssPath)) {
        rmSync(globalCssPath);
      }
      if (r.types) writeFileSync(resolve(leafSrc, 'FlowCanvas.d.ts'), r.types);
    }

    // README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .global.css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓`);
  }

  // ENFORCE docs props-table validation against docs/guide/rete.md (the
  // single-source-of-truth surface for the structural columns). VALIDATE-NOT-
  // OVERWRITE: throws on drift of name/type/default, never rewrites prose. Until
  // the guide is authored, the ROZIE_RETE_SKIP_GUIDE escape hatch relaxes the
  // absent-guide throw to a skip.
  const guideRelPath = 'docs/guide/rete.md';
  const guideExists = existsSync(resolve(REPO_ROOT, guideRelPath));
  const skipGuide = process.env.ROZIE_RETE_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). To emit the leaves before then, run with ` +
        `ROZIE_RETE_SKIP_GUIDE=1.`,
    );
  }
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  if (!guideExists) {
    console.log('codegen: docs props-table validation SKIPPED (ROZIE_RETE_SKIP_GUIDE=1).');
  } else {
    const docs = readFileSync(guidePath, 'utf8');
    const result = validateDocsPropsTable(ir, docs);
    if (!result.ok) {
      throw new Error(
        `codegen: docs props-table validation DRIFT — fix ONLY the structural columns in ${guidePath} ` +
          `(preserve prose); do NOT weaken the validator:\n` +
          result.errors.map((e) => `  - ${e}`).join('\n'),
      );
    }
    console.log(
      `codegen: docs props-table validation PASS — ${result.checkedRows} rows match ir.props (ENFORCING)`,
    );
  }

  console.log('codegen: done — 6 targets emitted, 6 READMEs rendered, 6 LICENSEs vendored.');
}

main();
