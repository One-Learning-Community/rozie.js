/**
 * codegen.mjs — the single parse-once → emit-6 → render-READMEs engine for
 * @rozie-ui/pdf.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive the @rozie-ui/maplibre codegen
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as the maplibre codegen + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * Like @rozie-ui/maplibre, PdfViewer.rozie imports `pdfjs-dist` directly, so the
 * leaves carry no colocated bridge and there is NO internal-helper copy step.
 *
 * PdfViewer.rozie's 5 emits compile strict-tsc-clean as-authored (verified across
 * all leaves), and the engine container is a `<div ref>` (not an `<img>`), so
 * there is NO per-leaf type-aid `code.replace(...)` patch — the cropper imageEl
 * `useRef<HTMLElement>` anchor does not exist here. Emit the compiled code
 * verbatim (the maplibre `const code = r.code` shape). If a future emit shape
 * needs an aid, ADD it as a fail-loud token-anchored replace — do NOT edit the
 * emitter (SCOPE FENCE).
 *
 * BUILD-ORDER CONTRACT: this script writes each leaf's src/PdfViewer.*, so it MUST
 * run before the bundled-leaf tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/PdfViewer.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write PdfViewer.css [+ PdfViewer.global.css if present] + PdfViewer.d.ts)
 *   4. render each leaf README from the IR + the hand-kept handle manifest
 *   5. ENFORCE validateDocsPropsTable against docs/components/pdf.md
 *      (THROWS if the guide is absent AND on drift of the IR-derivable structural
 *      columns — prop name, type, default. Never rewrites the hand-authored prose.
 *      ROZIE_PDF_SKIP_GUIDE=1 relaxes the absent-guide throw to a skip so the
 *      leaves can be emitted before the guide lands.)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/pdf
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/PdfViewer.rozie');
const FILENAME = 'PdfViewer.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'PdfViewer.tsx', build: 'tsdown' },
  vue: {
    dir: 'vue',
    file: 'PdfViewer.vue',
    build: 'source',
    // Vue dual-packaging (rolled out from the cropper-vue spike): the runtime
    // peers externalized from the Vite lib build + the per-family engine devDep
    // that vue-tsc needs for declaration emit.
    externals: ['vue', 'pdfjs-dist', /^vue\//],
    engineDevDeps: { 'pdfjs-dist': '^6' },
  },
  svelte: { dir: 'svelte', file: 'PdfViewer.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'PdfViewer.ts', build: 'source' },
  solid: { dir: 'solid', file: 'PdfViewer.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'PdfViewer.ts', build: 'tsdown' },
};

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.name;
}

/** Common Vite-lib build devDeps shared by every Vue leaf (engine devDep added per-family). */
const COMMON_VUE_BUILD_DEV_DEPS = {
  '@vitejs/plugin-vue': '^6',
  vite: '^8',
  'vite-plugin-css-injected-by-js': '^5',
  vue: '^3.5',
  'vue-tsc': '^3',
};

/**
 * Vue dual-packaging emitter (generalized from the cropper-vue spike): the Vue
 * leaf ships BOTH a compiled drop-in (`.` → dist/index.mjs CSS-inlined +
 * dist/index.d.ts) AND the raw SFC (`./source`). Vue cannot use tsdown (it does
 * not compile SFCs), so the build is Vite lib mode + @vitejs/plugin-vue +
 * vite-plugin-css-injected-by-js. Writes/patches the four Vue-leaf files
 * idempotently each codegen run; `version` is PRESERVED (hand-bumped in
 * package.json — codegen must never touch it). The wave-2 JS leaves
 * (react/solid/svelte/lit) will reuse this same package.json patch shape — hence
 * the workspace:^ normalization below (a no-op for Vue, which has zero
 * @rozie/runtime-* deps).
 */
function emitVueDualPackaging({ leafDir, componentName, externals, engineDevDeps }) {
  const renderExternal = (e) => (e instanceof RegExp ? e.toString() : `'${e}'`);
  const externalsLiteral = `[${externals.map(renderExternal).join(', ')}]`;

  // vite.config.ts — Vite lib build, CSS inlined into JS, runtime peers external.
  writeFileSync(
    resolve(leafDir, 'vite.config.ts'),
    `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

// Vue dual-packaging: compile the raw SFC to a drop-in dist/index.mjs. Vue cannot
// use tsdown (it does not compile SFCs), so we use Vite lib mode +
// @vitejs/plugin-vue. vite-plugin-css-injected-by-js bundles the SFC
// \`<style scoped>\` CSS INTO the JS (injected at import time) so consumers need no
// separate CSS import. The runtime peers (vue + the family engine) are externalized.
export default defineConfig({
  plugins: [vue(), cssInjectedByJsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: ${externalsLiteral},
    },
  },
});
`,
  );

  // src/index.ts barrel — re-export the SFC default under the named component.
  writeFileSync(
    resolve(leafDir, 'src', 'index.ts'),
    `export { default as ${componentName} } from './${componentName}.vue';
export { default } from './${componentName}.vue';
`,
  );

  // tsconfig.json — drives vue-tsc DECLARATION EMIT (dist/index.d.ts) with relaxed
  // strictness (the SFC is deliberately any-typed via type-only <script setup>).
  writeFileSync(
    resolve(leafDir, 'tsconfig.json'),
    `{
  // strictNullChecks/exactOptionalPropertyTypes/noImplicitAny relaxed: the SFC is
  // deliberately \`any\`-typed (type-only <script setup> macros). This tsconfig drives
  // vue-tsc DECLARATION EMIT (not noEmit typecheck) to produce dist/index.d.ts.
  //
  // No \`types: ["react"]\` (Vue leaf) so vue-tsc resolves vue's own types.
  "extends": "../../../../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "strictNullChecks": false,
    "exactOptionalPropertyTypes": false,
    "noImplicitAny": false,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
`,
  );

  // package.json — MERGE dual exports / real build scripts / build+engine devDeps
  // onto the existing leaf manifest, PRESERVING name/version/keywords/peers/
  // peerDependenciesMeta/publishConfig/author/repo/bugs/homepage.
  const pkgPath = resolve(leafDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.exports = {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.mjs',
      default: './dist/index.mjs',
    },
    './source': {
      vue: `./src/${componentName}.vue`,
      default: `./src/${componentName}.vue`,
    },
  };
  pkg.files = ['dist', 'src'];
  pkg.sideEffects = false;
  pkg.scripts = {
    ...pkg.scripts,
    build: 'vite build && vue-tsc --declaration --emitDeclarationOnly',
    typecheck: 'vue-tsc --noEmit',
  };
  const mergedDevDeps = {
    ...(pkg.devDependencies ?? {}),
    ...COMMON_VUE_BUILD_DEV_DEPS,
    ...engineDevDeps,
  };
  pkg.devDependencies = Object.fromEntries(
    Object.keys(mergedDevDeps)
      .sort()
      .map((k) => [k, mergedDevDeps[k]]),
  );
  // workspace:^ baking (forward-looking, no-op for Vue): the wave-2 JS leaves
  // reuse this patch and carry @rozie/runtime-* deps; bake the caret policy now so
  // `workspace:*` is normalized to `workspace:^` wherever a @rozie/runtime-* dep
  // appears. Vue leaves carry ZERO @rozie deps, so this loop is a no-op here.
  for (const depField of ['dependencies', 'devDependencies']) {
    const deps = pkg[depField];
    if (!deps) continue;
    for (const [name, ver] of Object.entries(deps)) {
      if (name.startsWith('@rozie/runtime-') && ver === 'workspace:*') {
        deps[name] = 'workspace:^';
      }
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
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

    // PdfViewer's 5 emits compile strict-tsc-clean as-authored (verified across
    // all leaves) and the engine container is a `<div ref>`, so there is NO
    // per-leaf type-aid `code.replace(...)` patch (the cropper imageEl
    // `useRef<HTMLImageElement>` retype has no analog here). Emit the compiled
    // code verbatim (the maplibre shape).
    const code = r.code;

    writeFileSync(resolve(leafSrc, cfg.file), code);

    // Vue leaf: emit the dual-packaging build config + barrel + tsconfig + patch
    // the leaf package.json (compiled drop-in at `.` + raw SFC at `./source`).
    if (target === 'vue') {
      emitVueDualPackaging({
        leafDir: resolve(ROOT, 'packages', cfg.dir),
        componentName: cfg.file.replace(/\.vue$/, ''),
        externals: cfg.externals,
        engineDevDeps: cfg.engineDevDeps,
      });
    }

    // Bundled leaves (tsdown) entry on src/index.ts. The emitted component is a
    // DEFAULT export, so the barrel re-exports the default under the named
    // `PdfViewer` consumers import (an `export *` would NOT forward a default).
    if (cfg.build === 'tsdown') {
      // React AND Solid: re-export the named `PdfViewerHandle` type directly from
      // the component module (the emitters emit `export interface PdfViewerHandle`
      // in the .tsx). Lit gets no named type: its handle is the custom element.
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as PdfViewer } from './PdfViewer';\n` +
            `export { default } from './PdfViewer';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { PdfViewerHandle } from './PdfViewer';\n`
          : `export { default as PdfViewer } from './PdfViewer';\nexport { default } from './PdfViewer';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'PdfViewer.css'), r.css);
      // Keep the global-css sidecar in lockstep with the emit: write it when the
      // React emitter routes nested-`:root` engine rules into r.globalCss (+ emits
      // a sibling `import './PdfViewer.global.css';`); remove a stale one otherwise.
      // PdfViewer.rozie SHIPS nested-:root engine rules (the text-layer/page CSS,
      // Phase 34), so r.globalCss is present and the sidecar IS written (the
      // maplibre analog).
      const globalCssPath = resolve(leafSrc, 'PdfViewer.global.css');
      if (r.globalCss) {
        writeFileSync(globalCssPath, r.globalCss);
      } else if (existsSync(globalCssPath)) {
        rmSync(globalCssPath);
      }
      if (r.types) writeFileSync(resolve(leafSrc, 'PdfViewer.d.ts'), r.types);
    }

    // (4) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // Vendor the repo LICENSE into each published leaf so the tarball carries its
    // own MIT license text (the root LICENSE does not propagate into per-package
    // tarballs).
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .global.css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓`);
  }

  // (5) ENFORCE docs props-table validation against docs/components/pdf.md.
  const guideRelPath = 'docs/components/pdf.md';
  const guideExists = existsSync(resolve(REPO_ROOT, guideRelPath));
  const skipGuide = process.env.ROZIE_PDF_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). Author it; to emit the leaves before then, ` +
        `run with ROZIE_PDF_SKIP_GUIDE=1.`,
    );
  }
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  if (!guideExists) {
    console.log(
      'codegen: docs props-table validation SKIPPED — docs/components/pdf.md not yet authored ' +
        '(ROZIE_PDF_SKIP_GUIDE=1; author the guide and re-run WITHOUT the flag).',
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
