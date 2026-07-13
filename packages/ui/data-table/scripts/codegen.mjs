/**
 * codegen.mjs — the single parse-once → emit-6 → copy-themes → render-READMEs
 * engine for @rozie-ui/data-table.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry / ProducerResolver) — the exact primitives the slider /
 * rete / command-palette codegens use. NO compiler/emitter/IR change. If a
 * compile() call emits an error-severity diagnostic this script THROWS (the same
 * diagnostics-filter contract as the slider/rete codegens + the in-compile ROZ977
 * guard); per the scope fence, an error means a mis-wired codegen path, NEVER an
 * emitter edit.
 *
 * MULTI-COMPONENT (the rete/chartjs/maplibre precedent): the family ships the
 * parent <DataTable> PLUS the declarative <Column> child (a renderless column
 * definition carrying the per-column #cell / #headerTemplate render templates)
 * and the Editor / Filter / GroupBar / DetailPanel drop-ins. DataTable MUST be FIRST
 * — it owns the handle-manifest + docs-table validation gates (Column is
 * renderless: no $expose, no docs page). Codegen compiles each sibling .rozie
 * source into all six leaves.
 *
 * The @tanstack/table-core bridge is INLINE in DataTable.rozie (the chartjs/rete
 * confirmed pattern) — table-core is a PEER dependency of each leaf, never a
 * colocated copy.
 *
 * COMPOSED Popover (Option A — published-package composition, the command-palette
 * →combobox precedent graduated in Phase 75, D-05/D-06/D-07): the header
 * column-menu composes the shipped <Popover strategy="fixed"> primitive by
 * RESOLVING the authored STABLE package-style `<components>` specifier
 * `@rozie-ui/popover/Popover.rozie` to the PUBLISHED per-target
 * `@rozie-ui/popover-<target>` package's compiled manifest, via @rozie/core's
 * compiler-level resolver (resolveManifestProducer) — found by walking
 * node_modules UPWARD from data-table/src (the 6 popover-<target> packages are
 * devDependencies of this family root, so pnpm symlinks them there). There is NO
 * vendored `.rozie` sibling and NO in-memory specifier remap: the popover
 * resolves at compile-time for scoped-slot type threading + r-model two-way
 * validation, and is a runtime peerDependency of every data-table leaf. It is
 * NOT re-exported from the barrel — consumers use `@rozie-ui/popover-<target>`
 * directly.
 *
 * REQ-1 ADAPTER-IMPORT CHECK: after compiling each leaf, this script asserts the
 * emitted code imports ONLY `@tanstack/table-core` — NEVER a per-framework
 * adapter (`@tanstack/{react,vue,svelte,solid,angular,lit}-table`). The whole
 * point of the family is one framework-agnostic core wired by hand; an adapter
 * import would defeat it. The check THROWS on violation.
 *
 * Like the slider, this vendors the `src/themes/` design-token presets
 * (base / shadcn / material / bootstrap) into each leaf so consumers can
 * `import '@rozie-ui/data-table-<fw>/themes/X.css'`.
 *
 * Steps:
 *   1. read src/{DataTable,Column,...}.rozie
 *   2. parse() + lowerToIR() the PARENT ONCE (threading the ProducerResolver so
 *      the `<components>` popover specifier resolves) → ir for docs tables + manifests
 *   3. for each of the 6 targets, for each component: compile() (with the same
 *      resolver + resolverRoot) → write leaf src/<file>
 *        (+ run the req-1 adapter-import check on the emitted code)
 *        (React only: also write <Component>.css / .global.css / .d.ts sidecars)
 *   4. copy src/themes/ → each leaf src/themes/
 *   5. render each leaf README from the IR + the hand-kept event/handle manifests
 *   6. vendor the repo LICENSE per leaf
 *   7. VALIDATE-NOT-OVERWRITE the docs props-table against docs/components/data-table.md
 *        (THROWS on structural drift; ROZIE_DATA_TABLE_SKIP_GUIDE=1 relaxes the
 *        absent-guide throw to a skip while the docs page is a later wave)
 *
 * BUILD-ORDER CONTRACT: this writes each leaf's src/<Component>.*, so it MUST run
 * before the bundled-leaf tsdown builds (`turbo run build --force`).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse, ProducerResolver } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { derivePeerLabel, renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/data-table
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root

// DataTable FIRST (owns the handle-manifest + docs-table gates); Column is the
// renderless declarative child (no $expose, no docs page — a pure addition).
const PARENT = 'DataTable';
// DataTable FIRST (owns the default export + handle-manifest/docs-table gates).
// Column is the renderless declarative child. The five Editor* drop-ins are
// presentational #editor-slot fills (no $emit/$expose → no manifest entries; the
// manifest-completeness loops key off the PARENT-only IR below, not per-component).
// Popover is NO LONGER a component this codegen compiles: under Option A it comes
// from the published `@rozie-ui/popover-<target>` package (resolved at compile
// time via the ProducerResolver below), NOT a vendored sibling. Each of the rest
// becomes a NAMED re-export via childExports; DataTable stays the default.
const COMPONENTS = [PARENT, 'Column', 'EditorText', 'EditorNumber', 'EditorSelect', 'EditorCheckbox', 'EditorDate', 'FilterText', 'FilterNumberRange', 'FilterSelect', 'GroupBar', 'DetailPanel'];

/**
 * Per-target leaf dir + emitted file extension (`build` mode is informational).
 *
 * `barrelExt` — the module-path suffix the barrel `index.ts` uses when it
 *   re-exports each component (`'.vue'` / `'.svelte'`, or `''` for extensionless
 *   TS/TSX module specifiers).
 * `exportStyle` — `'default'` (the component module's DEFAULT export is the
 *   component: react/solid/lit .tsx/.ts + the vue/svelte SFCs) vs `'named'`
 *   (angular emits `export class <Name>` — re-export by name). Mirrors the
 *   rete/chartjs barrel convention.
 */
const TARGETS = {
  react: { dir: 'react', ext: 'tsx', barrelExt: '', exportStyle: 'default', build: 'tsdown' },
  vue: { dir: 'vue', ext: 'vue', barrelExt: '.vue', exportStyle: 'default', build: 'source' },
  svelte: { dir: 'svelte', ext: 'svelte', barrelExt: '.svelte', exportStyle: 'default', build: 'source' },
  angular: { dir: 'angular', ext: 'ts', barrelExt: '', exportStyle: 'named', build: 'source' },
  solid: { dir: 'solid', ext: 'tsx', barrelExt: '', exportStyle: 'default', build: 'tsdown' },
  lit: { dir: 'lit', ext: 'ts', barrelExt: '', exportStyle: 'default', build: 'tsdown' },
};

// REQ-1 / REQ-4: forbidden per-framework adapter specifiers. The leaves must import
// ONLY the framework-agnostic cores `@tanstack/table-core` and `@tanstack/virtual-core`
// — a `@tanstack/<fw>-table` or `@tanstack/<fw>-virtual` adapter would defeat the
// single-core no-adapter design (D-02). NOTE: `@tanstack/virtual-core` is the ALLOWED
// virtualization import and is deliberately NOT in this list.
const FORBIDDEN_ADAPTERS = [
  '@tanstack/react-table',
  '@tanstack/vue-table',
  '@tanstack/svelte-table',
  '@tanstack/solid-table',
  '@tanstack/angular-table',
  '@tanstack/lit-table',
  '@tanstack/react-virtual',
  '@tanstack/vue-virtual',
  '@tanstack/svelte-virtual',
  '@tanstack/solid-virtual',
  '@tanstack/angular-virtual',
  '@tanstack/lit-virtual',
];

function leafPkg(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf8'));
}

/** Copy src/themes/ → leaf src/themes/ (the design-token presets). */
function copyThemes(leafSrc) {
  const src = resolve(ROOT, 'src/themes');
  if (!existsSync(src)) throw new Error('codegen: src/themes/ not found (token presets must exist)');
  cpSync(src, resolve(leafSrc, 'themes'), { recursive: true });
}

/** REQ-1: throw if the emitted code imports any per-framework @tanstack adapter. */
function assertNoAdapterImport(target, componentName, code) {
  for (const adapter of FORBIDDEN_ADAPTERS) {
    if (code.includes(adapter)) {
      throw new Error(
        `codegen ${target} ${componentName}: REQ-1 VIOLATION — emitted code imports the per-framework ` +
          `adapter "${adapter}". The leaves must import ONLY "@tanstack/table-core" and ` +
          `"@tanstack/virtual-core" (the framework-agnostic cores wired by hand). ` +
          `Remove the adapter import from the .rozie source.`,
      );
    }
  }
}

function main() {
  // Read every component source once. Keyed by component name. Popover is NOT a
  // component here (Option A — it resolves from the published package), so there
  // is no vendored sibling to read and no ordering hazard to guard.
  const sources = Object.fromEntries(
    COMPONENTS.map((name) => [name, readFileSync(resolve(ROOT, `src/${name}.rozie`), 'utf8')]),
  );

  // Option A (P75 precedent): a per-run ProducerResolver, rooted at this package
  // (ROOT), reused across the doc-table lowerToIR() call and every per-target
  // compile() below. `resolverRoot`/`ResolverOptions.root` feeds ONLY the
  // tsconfig-paths matcher — the published `@rozie-ui/popover-<target>` package
  // itself is found by walking node_modules UPWARD from dirname(fromFile)
  // (data-table/src), which resolves because this family root declares each
  // popover-<target> as a devDependency, so pnpm symlinks them into
  // data-table/node_modules.
  const resolver = new ProducerResolver({ root: ROOT });

  // (2) parse + lower the PARENT ONCE for the doc tables + manifests. The
  // renderless <Column> child has no $expose and no docs page, so the
  // handle-manifest + docs-table validation gates apply to DataTable only.
  // Phase 54: pass the ABSOLUTE host path so inlineScriptPartials (inside lowerToIR)
  // can resolve the sibling expand/group/facet .rzts partials relative to src/. The
  // scope hash uses only the BASENAME, so absolute vs relative is byte-identical.
  // Use the RAW authored source (no specifier remap) — the stable
  // `@rozie-ui/popover/Popover.rozie` specifier now resolves to the published
  // per-target manifest via the threaded resolver.
  const { ast } = parse(sources[PARENT], { filename: resolve(ROOT, 'src', `${PARENT}.rozie`) });
  const { ir } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
    filename: resolve(ROOT, 'src', `${PARENT}.rozie`),
    resolver,
  });

  // Keep the hand-kept manifests in lockstep with the IR.
  for (const ev of ir.emits) {
    if (!eventManifest[ev]) {
      throw new Error(`codegen: event "${ev}" is emitted by the source but has no entry in event-manifest.mjs`);
    }
  }
  for (const m of ir.expose) {
    if (!handleManifest[m.name]) {
      throw new Error(`codegen: method "${m.name}" is exposed by the source but has no entry in handle-manifest.mjs`);
    }
  }

  // (3)(4)(5)(6) per-target emit + req-1 check + vendor themes + README + LICENSE.
  for (const [target, cfg] of Object.entries(TARGETS)) {
    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    // Compile each sibling component into this leaf. The SCOPE FENCE throw is
    // applied to EACH compile — an error means a mis-wired codegen/authoring
    // path, NEVER an emitter edit (escalate as a compiler gap instead).
    for (const componentName of COMPONENTS) {
      // Phase 54: ABSOLUTE host path so the .rzts/.rzjs script-partial inline pass
      // resolves sibling partials against src/ (the DataTable host imports
      // ./expand.rzts / ./group.rzts / ./facet.rzts). Basename-only scope hash →
      // byte-identical leaf output vs the relative-filename pre-extraction form.
      const filename = resolve(ROOT, 'src', `${componentName}.rozie`);
      const r = compile(sources[componentName], { target, filename, resolverRoot: ROOT, resolver });
      const errs = r.diagnostics.filter((d) => d.severity === 'error');
      if (errs.length) {
        throw new Error(
          `codegen ${target} ${componentName}: compile emitted error diagnostics (SCOPE FENCE: do NOT edit any emitter — fix the codegen path):\n` +
            errs.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
        );
      }

      // REQ-1: assert the emitted code imports only @tanstack/table-core.
      assertNoAdapterImport(target, componentName, r.code);

      // Option A: write the emitted code VERBATIM for every target. The composed
      // popover import is the bare published specifier `@rozie-ui/popover-<target>`
      // (e.g. Lit emits `import '@rozie-ui/popover-lit';`), NOT a `./Popover`
      // sibling, so there is nothing to rewrite.
      writeFileSync(resolve(leafSrc, `${componentName}.${cfg.ext}`), r.code);

      // React-only sidecars, per component. The renderless Column emits no
      // synthesized handle type; the `if (r.css)` / `if (r.types)` guards already
      // handle absence; the global-css cleanup removes a stale sidecar if a
      // component carries no nested-:root engine rules.
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

    // Named-export BARREL — emitted for EVERY target. Re-exports DataTable +
    // Column by name + a back-compat default (= DataTable).
    //  - exportStyle 'default' (react/solid/lit .tsx/.ts + vue/svelte SFCs): the
    //    component is the module DEFAULT → `export { default as X } from './X<ext>'`
    //    (an `export *` would NOT forward a default).
    //  - exportStyle 'named' (angular): the emitter writes `export class <Name>`
    //    → re-export by NAME. The angular leaves ALSO emit `export default <Name>`,
    //    so the DataTable default re-export still resolves for back-compat.
    // For Lit the per-component module carries the `@customElement(...)`
    // self-registration side effect; re-exporting evaluates each module, so
    // importing the barrel runs both custom-element registrations.
    const bx = cfg.barrelExt;
    const reexport = (name) =>
      cfg.exportStyle === 'named'
        ? `export { ${name} } from './${name}${bx}';\n`
        : `export { default as ${name} } from './${name}${bx}';\n`;

    // Every non-PARENT component (Column + the Editor*/Filter*/GroupBar/DetailPanel
    // drop-ins) is a NAMED re-export. Popover is NOT among them — under Option A it
    // is an external published package (`@rozie-ui/popover-<target>`), not a
    // compiled sibling, so there is nothing local to re-export; consumers who want a
    // standalone popover use `@rozie-ui/popover-<target>` directly.
    const childExports = COMPONENTS.filter((n) => n !== PARENT).map(reexport).join('');
    const handleType =
      (target === 'react' || target === 'solid') && ir.expose.length > 0
        ? `\n/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
            .map((m) => m.name)
            .join(', ')} }. */\n` + `export type { DataTableHandle } from './DataTable';\n`
        : '';
    const barrel =
      reexport(PARENT) +
      // Back-compat package default = DataTable (every target's DataTable leaf has
      // a default export: SFC default, .tsx/.ts default, angular `export default`).
      `export { default } from './DataTable${bx}';\n` +
      childExports +
      handleType;
    writeFileSync(resolve(leafSrc, 'index.ts'), barrel);

    // (4) vendor the design-token presets.
    copyThemes(leafSrc);

    // (5) README from the single PARENT IR parse. The peer-dependency install
    // line is DERIVED from the leaf's real package.json peerDependencies so it
    // cannot drift from the modules the emitted code actually imports.
    const pkg = leafPkg(cfg.dir);
    const pkgName = pkg.name;
    const peerLabel = derivePeerLabel(pkg.peerDependencies, pkg.peerDependenciesMeta);
    const readme = renderReadme(target, ir, eventManifest, pkgName, handleManifest, peerLabel);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // (6) vendor the repo LICENSE into each published leaf.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css/.global.css/.d.ts)' : '';
    const files = COMPONENTS.map((n) => `${n}.${cfg.ext}`).join(', ');
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/{${files}}${sidecars}  ✓ (+ themes/)`);
  }

  // (7) ENFORCE docs props-table validation against docs/components/data-table-api.md
  // (the single-source-of-truth surface for the structural columns since the
  // 260623-dt8 docs restructure moved the dense API tables off the overview page
  // onto the dedicated API reference page).
  // VALIDATE-NOT-OVERWRITE: throws on drift of name/type/default, never rewrites
  // prose. Until the guide is authored (a later wave), ROZIE_DATA_TABLE_SKIP_GUIDE=1
  // relaxes the absent-guide throw to a skip.
  const guideRelPath = 'docs/components/data-table-api.md';
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  const guideExists = existsSync(guidePath);
  const skipGuide = process.env.ROZIE_DATA_TABLE_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). To emit the leaves before then, run with ` +
        `ROZIE_DATA_TABLE_SKIP_GUIDE=1.`,
    );
  }
  if (!guideExists) {
    console.log('codegen: docs props-table validation SKIPPED (ROZIE_DATA_TABLE_SKIP_GUIDE=1).');
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
    `codegen: done — ${COMPONENTS.length} components × 6 targets emitted (${COMPONENTS.join(', ')}), ` +
      `themes vendored, 6 READMEs rendered, 6 LICENSEs vendored.`,
  );
}

main();
