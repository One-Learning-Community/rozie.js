/**
 * codegen.mjs — the single parse-once → emit-6 → copy-themes → render-READMEs
 * engine for @rozie-ui/data-table.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitives the slider / rete codegens use.
 * NO compiler/emitter/IR change. If a compile() call emits an error-severity
 * diagnostic this script THROWS (the same diagnostics-filter contract as the
 * slider/rete codegens + the in-compile ROZ977 guard); per the scope fence, an
 * error means a mis-wired codegen path, NEVER an emitter edit.
 *
 * MULTI-COMPONENT (the rete/chartjs/maplibre precedent): the family ships the
 * parent <DataTable> PLUS the declarative <Column> child (a renderless column
 * definition carrying the per-column #cell / #headerTemplate render templates).
 * DataTable MUST be FIRST — it owns the handle-manifest + docs-table validation
 * gates (Column is renderless: no $expose, no docs page). Codegen compiles each
 * sibling .rozie source into all six leaves.
 *
 * The @tanstack/table-core bridge is INLINE in DataTable.rozie (the chartjs/rete
 * confirmed pattern) — table-core is a PEER dependency of each leaf, never a
 * colocated copy.
 *
 * VENDORED Popover (Phase 72, the command-palette→combobox precedent, the
 * SECOND cross-family composite): the header column-menu composes the shipped
 * <Popover strategy="fixed"> primitive by vendoring its canonical `.rozie`
 * source (+ `internal/middleware.ts`) into this family's `src/` as a GENERATED,
 * committed sibling — `vendorPopover()` + `copyInternal()` below. Popover is an
 * INTERNAL implementation detail: it compiles into every leaf but is EXCLUDED
 * from the public barrel (consumers use `@rozie-ui/popover` directly).
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
 *   0. vendorPopover() — copy the canonical @rozie-ui/popover Popover.rozie
 *      (+ internal/middleware.ts) into src/ FIRST (compile-input ordering hazard)
 *   1. read src/{DataTable,Column,...,Popover}.rozie
 *   2. parse() + lowerToIR() the PARENT ONCE (composed/specifier-remapped) → ir
 *      for docs tables + manifests
 *   3. for each of the 6 targets, for each component: compile() → write leaf src/<file>
 *        (+ run the req-1 adapter-import check on the emitted code)
 *        (Lit only: rewrite the vendored Popover's `.rozie` specifiers to extensionless siblings)
 *        (React only: also write <Component>.css / .global.css / .d.ts sidecars)
 *   4. copy src/themes/ → each leaf src/themes/; copy src/internal/ → each leaf src/internal/
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
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/data-table
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const POPOVER_ROOT = resolve(REPO_ROOT, 'packages/ui/popover'); // canonical primitive home (D-01)

// DataTable FIRST (owns the handle-manifest + docs-table gates); Column is the
// renderless declarative child (no $expose, no docs page — a pure addition).
const PARENT = 'DataTable';
// DataTable FIRST (owns the default export + handle-manifest/docs-table gates).
// Column is the renderless declarative child. The five Editor* drop-ins are
// presentational #editor-slot fills (no $emit/$expose → no manifest entries; the
// manifest-completeness loops key off the PARENT-only IR below, not per-component).
// Popover is the Phase 72 VENDORED composite — internal only, EXCLUDED from the
// public barrel below (see childExports). Each of the rest becomes a NAMED
// re-export via childExports; DataTable stays the default.
const COMPONENTS = [PARENT, 'Column', 'EditorText', 'EditorNumber', 'EditorSelect', 'EditorCheckbox', 'EditorDate', 'FilterText', 'FilterNumberRange', 'FilterSelect', 'GroupBar', 'DetailPanel', 'Popover'];

// D-07 (LOAD-BEARING): the authored DataTable.rozie writes a STABLE
// package-style `<components>` specifier `@rozie-ui/popover/Popover.rozie`.
// Under Option B (vendored) the codegen rewrites that specifier to the local
// sibling `./Popover.rozie` BEFORE compile() so threadParamTypes resolves the
// vendored copy on disk; the existing rewriteRozieImport then swaps
// `.rozie`→per-target ext. The authored file is NEVER edited — only this
// in-memory string is — so it stays byte-identical between B and a future
// Option A (only this remap + the D-04 drift guard are B-specific, the
// deletable plumbing). Inert until 72-03 adds the `<components>` block.
const STABLE_POPOVER_SPECIFIER = '@rozie-ui/popover/Popover.rozie';
const LOCAL_POPOVER_SPECIFIER = './Popover.rozie';

// D-03: the GENERATED banner prepended to the vendored copy. It sits OUTSIDE the
// `<rozie>` envelope (a leading HTML comment is tolerated — DataTable.rozie
// itself opens with one), so the D-04 drift guard hashes only the
// `<rozie>…</rozie>` envelope span and ignores this banner.
const POPOVER_BANNER =
  `<!-- GENERATED — do not edit. Vendored from @rozie-ui/popover by codegen.\n` +
  `     Re-run \`pnpm --filter @rozie-ui/data-table build\` to refresh.\n` +
  `     Drift between this copy and the canonical source FAILS CI (D-04 guard). -->\n`;

/**
 * D-03 / D-01 / D-07 — vendor the canonical Popover primitive `.rozie` (+ its
 * `internal/middleware.ts`) into this composite's src/ as a GENERATED,
 * committed, overwrite-on-codegen sibling.
 *
 * ORDERING HAZARD (the command-palette Pitfall 2 precedent): this MUST run in
 * main() BEFORE any source is read and BEFORE the compile loop. The vendored
 * `./Popover.rozie` is a compile INPUT — threadParamTypes' producer resolution
 * reads it on disk for slot-type threading and degrades to `null` SILENTLY
 * (untyped slot params, green-but-wrong codegen) if the file is missing at
 * compile time. Contrast copyThemes which runs AFTER write because it is a
 * leaf asset, not a compile input.
 */
function vendorPopover() {
  const canonical = resolve(POPOVER_ROOT, 'src/Popover.rozie');
  const dest = resolve(ROOT, 'src/Popover.rozie');
  writeFileSync(dest, POPOVER_BANNER + readFileSync(canonical, 'utf8'));

  const internalSrc = resolve(POPOVER_ROOT, 'src/internal');
  cpSync(internalSrc, resolve(ROOT, 'src/internal'), {
    recursive: true,
    filter: (from) => !from.endsWith('.test.ts'),
  });
}

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

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.name;
}

/** Copy src/themes/ → leaf src/themes/ (the design-token presets). */
function copyThemes(leafSrc) {
  const src = resolve(ROOT, 'src/themes');
  if (!existsSync(src)) throw new Error('codegen: src/themes/ not found (token presets must exist)');
  cpSync(src, resolve(leafSrc, 'themes'), { recursive: true });
}

/**
 * Vendor this package's OWN src/internal/ (populated by vendorPopover() with
 * the vendored middleware.ts) → leaf src/internal/ (excluding *.test.ts), so
 * the compiled Popover sibling's `import ... from './internal/middleware'`
 * resolves inside the standalone bundled leaf. Mirrors command-palette's
 * copyInternal() precedent.
 */
function copyInternal(leafSrc) {
  const src = resolve(ROOT, 'src/internal');
  if (!existsSync(src)) return;
  cpSync(src, resolve(leafSrc, 'internal'), {
    recursive: true,
    filter: (from) => !from.endsWith('.test.ts'),
  });
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
  // (1) D-03/D-07 ORDERING HAZARD: vendor the canonical Popover primitive into
  // this composite's src/ FIRST — before any source is read, before parse/lower,
  // before the compile loop. The vendored `./Popover.rozie` is a compile INPUT
  // (the command-palette Pitfall 2 precedent).
  vendorPopover();

  // Read every component source once. Keyed by component name.
  const sources = Object.fromEntries(
    COMPONENTS.map((name) => [name, readFileSync(resolve(ROOT, `src/${name}.rozie`), 'utf8')]),
  );

  // D-07: pre-compile remap of the DataTable source's stable `<components>`
  // specifier → the local vendored sibling, so threadParamTypes resolves the
  // copy on disk. The authored file is untouched; only this in-memory string
  // changes. Inert until 72-03 adds the `<components>` block to DataTable.rozie.
  const composedSource = sources[PARENT].replaceAll(STABLE_POPOVER_SPECIFIER, LOCAL_POPOVER_SPECIFIER);

  // (2) parse + lower the PARENT ONCE for the doc tables + manifests. The
  // renderless <Column> child has no $expose and no docs page, so the
  // handle-manifest + docs-table validation gates apply to DataTable only.
  // Phase 54: pass the ABSOLUTE host path so inlineScriptPartials (inside lowerToIR)
  // can resolve the sibling expand/group/facet .rzts partials relative to src/. The
  // scope hash uses only the BASENAME, so absolute vs relative is byte-identical.
  // Use the composed (specifier-remapped) source so the IR's <components> resolves
  // the local vendored sibling.
  const { ast } = parse(composedSource, { filename: resolve(ROOT, 'src', `${PARENT}.rozie`) });
  const { ir } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
    filename: resolve(ROOT, 'src', `${PARENT}.rozie`),
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
      const componentSource = componentName === PARENT ? composedSource : sources[componentName];
      const r = compile(componentSource, { target, filename });
      const errs = r.diagnostics.filter((d) => d.severity === 'error');
      if (errs.length) {
        throw new Error(
          `codegen ${target} ${componentName}: compile emitted error diagnostics (SCOPE FENCE: do NOT edit any emitter — fix the codegen path):\n` +
            errs.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
        );
      }

      // REQ-1: assert the emitted code imports only @tanstack/table-core.
      assertNoAdapterImport(target, componentName, r.code);

      // D-07 (Option B, codegen-local plumbing — NOT an emitter edit): the Lit
      // emitter emits a vendored-sibling composition import as a verbatim
      // side-effect `import './Popover.rozie';` (it registers the
      // @customElement; resolved by the rozie unplugin in the consumer-coexist
      // flow). A pre-compiled leaf package, however, is bundled standalone by
      // tsdown (entry src/index.ts, bundler resolution) with no unplugin and no
      // `.rozie` on disk — only the compiled sibling `Popover.ts` — so the raw
      // `.rozie` specifier is UNRESOLVED. Rewrite it to the extensionless
      // sibling form (`./Popover`), exactly what rewriteRozieImport(·,'lit')
      // yields and what the react/solid/angular leaves already import.
      //
      // If the parent ALSO `ref`s the composed child, the Lit emitter emits a
      // NAMED TYPE import `import type { Popover } from './Popover.rozie';`
      // (the element-class type for the `@query` ref field, Phase 66
      // composed-component-ref precedent) — collapse to a DEFAULT type import
      // off the extensionless sibling (every other target's compiled leaf
      // exports the class as `export default class Popover`). Then strip any
      // residual relative `.rozie` specifier. Lit-only, sibling-relative only;
      // leaves the canonical/consumer `.rozie` contract untouched.
      const code =
        target === 'lit'
          ? r.code
              .replace(/import '\.\/([A-Za-z0-9_]+)\.rozie';/g, "import './$1';")
              .replace(
                /import type \{ ([A-Za-z0-9_]+) \} from '\.\/([A-Za-z0-9_]+)\.rozie'/g,
                "import type $1 from './$2'",
              )
              .replace(/from '\.\/([A-Za-z0-9_]+)\.rozie'/g, "from './$1'")
          : r.code;

      writeFileSync(resolve(leafSrc, `${componentName}.${cfg.ext}`), code);

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

    // CRITICAL: Popover is EXCLUDED alongside PARENT — it is an internal
    // implementation detail of the header column-menu, NOT re-exported.
    // Consumers who want a standalone popover use `@rozie-ui/popover` directly.
    const childExports = COMPONENTS.filter((n) => n !== PARENT && n !== 'Popover').map(reexport).join('');
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

    // (4) vendor the design-token presets + the vendored Popover's internal middleware.
    copyThemes(leafSrc);
    copyInternal(leafSrc);

    // (5) README from the single PARENT IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, eventManifest, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // (6) vendor the repo LICENSE into each published leaf.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css/.global.css/.d.ts)' : '';
    const files = COMPONENTS.map((n) => `${n}.${cfg.ext}`).join(', ');
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/{${files}}${sidecars}  ✓ (+ themes/ + internal/)`);
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
