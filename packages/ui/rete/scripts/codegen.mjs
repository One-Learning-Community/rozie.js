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

// Phase 41 (controlled-graph redesign): the package ships the parent <FlowCanvas>
// PLUS the node-TYPE-template children <NodeType> (the `#body` render-by-type
// template + a nested <Port> port schema) and <Port> (the typed directional port).
// The Phase-37 per-INSTANCE <FlowNode>/<Handle> and the <Connection> edge child are
// REMOVED (D6 clean break — edges live only in the bound `graph.connections`).
// Codegen compiles each sibling .rozie source into all 6 leaves (the chartjs /
// maplibre multi-component precedent). FlowCanvas MUST be FIRST — it owns the
// handle-manifest + docs-table validation gates (the render-callback / renderless
// children have no $expose / docs page); the children are pure additions.
const PARENT = 'FlowCanvas';
const COMPONENTS = [PARENT, 'NodeType', 'Port'];

// Removed components whose pre-existing leaf outputs must be DELETED — the codegen
// drives generation but won't auto-delete a removed component's stale leaves, and
// an orphaned leaf src (e.g. Connection.tsx) + its barrel re-export would break the
// bundled-leaf tsdown build (the barrel only re-exports COMPONENTS). Cleaned per
// target below (the leaf src + React sidecars).
const REMOVED_COMPONENTS = ['FlowNode', 'Handle', 'Connection'];

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

  // parse + lower the PARENT ONCE for the doc tables + handle manifest. The
  // render-callback <FlowNode> + renderless <Handle>/<Connection> children have no
  // $expose and no docs page, so the handle-manifest + docs-table validation gates
  // apply to FlowCanvas only.
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

  // per-target emit + README. Outer loop = target; inner loop = component.
  for (const [target, cfg] of Object.entries(TARGETS)) {
    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    // STALE-LEAF CLEANUP (Phase 41 D6 clean break): delete any pre-existing leaf
    // output for a REMOVED component (FlowNode/Handle/Connection). The codegen never
    // auto-deletes a dropped component's leaves, and an orphaned leaf src + its barrel
    // re-export would break the bundled-leaf tsdown build (the barrel below only
    // re-exports COMPONENTS). Removes the per-target leaf file + the React-only
    // .css/.global.css/.d.ts sidecars.
    for (const removed of REMOVED_COMPONENTS) {
      for (const ext of [cfg.ext, 'css', 'global.css', 'd.ts']) {
        const p = resolve(leafSrc, `${removed}.${ext}`);
        if (existsSync(p)) rmSync(p);
      }
    }

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

      // FlowCanvas's 6 emits compile strict-tsc-clean as-authored (the engine calls
      // route through null-let `any` instances); the children likewise (their
      // $inject results are routed through null-let `any` aliases). There is NO
      // per-leaf type-aid `code.replace(...)` patch. Emit the compiled code verbatim.
      writeFileSync(resolve(leafSrc, `${componentName}.${cfg.ext}`), r.code);

      // React-only sidecars, per component. The render-callback / renderless
      // children emit no CSS and no synthesized handle type — the `if (r.css)` /
      // `if (r.types)` guards already handle absence; the global-css cleanup removes
      // a stale sidecar if a component carries no nested-:root engine rules.
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
    // its named export (an `export *` would NOT forward a default). The PARENT also
    // re-exports the package default + the `FlowCanvasHandle` type (React/Solid emit
    // it in the .tsx).
    if (cfg.build === 'tsdown') {
      const childExports = COMPONENTS.filter((n) => n !== PARENT)
        .map((n) => `export { default as ${n} } from './${n}';\n`)
        .join('');
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as FlowCanvas } from './FlowCanvas';\n` +
            `export { default } from './FlowCanvas';\n` +
            childExports +
            `\n/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { FlowCanvasHandle } from './FlowCanvas';\n`
          : `export { default as FlowCanvas } from './FlowCanvas';\nexport { default } from './FlowCanvas';\n` +
            childExports;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // README from the single PARENT IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .global.css + .d.ts)' : '';
    const files = COMPONENTS.map((n) => `${n}.${cfg.ext}`).join(', ');
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/{${files}}${sidecars}  ✓`);
  }

  // ENFORCE docs props-table validation against docs/components/rete.md (the
  // single-source-of-truth surface for the structural columns). VALIDATE-NOT-
  // OVERWRITE: throws on drift of name/type/default, never rewrites prose. Until
  // the guide is authored, the ROZIE_RETE_SKIP_GUIDE escape hatch relaxes the
  // absent-guide throw to a skip.
  const guideRelPath = 'docs/components/rete.md';
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

  console.log(
    `codegen: done — ${COMPONENTS.length} components × 6 targets emitted (${COMPONENTS.join(', ')}), 6 READMEs rendered, 6 LICENSEs vendored.`,
  );
}

main();
