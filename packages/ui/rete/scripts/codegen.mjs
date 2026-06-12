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

/**
 * Per-target leaf dir + emitted file extension (`build` mode is informational).
 *
 * `barrelExt` — the module-path suffix the barrel `index.ts` uses when it
 *   re-exports each component (`'.vue'` / `'.svelte'`, or `''` for extensionless
 *   TS/TSX module specifiers). Distinct from `ext` (the emitted leaf file's
 *   extension) because `import { default as X } from './X.vue'` needs the `.vue`
 *   suffix while `from './X'` is correct for `.tsx`/`.ts`.
 * `exportStyle` — `'default'` (the component module's DEFAULT export is the
 *   component: React/Solid/Lit `.tsx`/`.ts`, and the Vue/Svelte SFCs) vs
 *   `'named'` (Angular emits a named `export class <Name>` — re-export it by
 *   name). Mirrors the @rozie-ui/chartjs barrel convention.
 */
const TARGETS = {
  react: { dir: 'react', ext: 'tsx', barrelExt: '', exportStyle: 'default', build: 'tsdown' },
  vue: { dir: 'vue', ext: 'vue', barrelExt: '.vue', exportStyle: 'default', build: 'source' },
  svelte: { dir: 'svelte', ext: 'svelte', barrelExt: '.svelte', exportStyle: 'default', build: 'source' },
  angular: { dir: 'angular', ext: 'ts', barrelExt: '', exportStyle: 'named', build: 'source' },
  solid: { dir: 'solid', ext: 'tsx', barrelExt: '', exportStyle: 'default', build: 'tsdown' },
  lit: { dir: 'lit', ext: 'ts', barrelExt: '', exportStyle: 'default', build: 'tsdown' },
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

    // Named-export BARREL — emitted for EVERY target (not just the bundled
    // tsdown leaves). This is the fix for the Phase-41 packaging gap: without a
    // barrel the source-shipped leaves (vue/svelte/angular) could only point
    // `exports["."]` at FlowCanvas.<ext>, so the documented
    // `import FlowCanvas, { NodeType, Port } from '@rozie-ui/rete-<target>'`
    // resolved ONLY on react (which had a hand-mirrored barrel). The barrel
    // re-exports every component by name + a back-compat default (= FlowCanvas).
    //
    // Per-target re-export FORM (mirrors @rozie-ui/chartjs barrelLine):
    //  - exportStyle 'default' (react/solid/lit .tsx/.ts + vue/svelte SFCs): the
    //    component is the module DEFAULT → `export { default as X } from './X<ext>'`
    //    (an `export *` would NOT forward a default). A `export { default } from
    //    './FlowCanvas<ext>'` gives the package its back-compat default.
    //  - exportStyle 'named' (angular): the emitter writes `export class <Name>`
    //    → re-export by NAME (`export { X } from './X'`). The angular leaves ALSO
    //    emit `export default <Name>`, so the FlowCanvas default re-export below
    //    still resolves for back-compat.
    //
    // For Lit the per-component module also carries the `@customElement(...)`
    // self-registration side effect; `export { default as X } from './X'` imports
    // (and therefore evaluates) every component module, so importing the barrel
    // runs all three custom-element registrations — no bare side-effect import
    // needed.
    const bx = cfg.barrelExt; // module-path suffix in the barrel ('' | '.vue' | '.svelte')
    const reexport = (name) =>
      cfg.exportStyle === 'named'
        ? `export { ${name} } from './${name}${bx}';\n`
        : `export { default as ${name} } from './${name}${bx}';\n`;

    const childExports = COMPONENTS.filter((n) => n !== PARENT).map(reexport).join('');
    const handleType =
      (target === 'react' || target === 'solid') && ir.expose.length > 0
        ? `\n/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
            .map((m) => m.name)
            .join(', ')} }. */\n` + `export type { FlowCanvasHandle } from './FlowCanvas';\n`
        : '';
    const barrel =
      reexport(PARENT) +
      // Back-compat package default = FlowCanvas (every target's FlowCanvas leaf
      // has a default export: SFC default, .tsx/.ts default, and the angular
      // `export default FlowCanvas`).
      `export { default } from './FlowCanvas${bx}';\n` +
      childExports +
      handleType;
    writeFileSync(resolve(leafSrc, 'index.ts'), barrel);

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
