/**
 * codegen.mjs — the single parse-once → emit-6 → copy-internal → render-READMEs
 * engine for @rozie-ui/sortable-list.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive docs/.vitepress/rozie-codegen.ts
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as rozie-codegen.ts + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * BUILD-ORDER CONTRACT (from 20-01): this script writes each leaf's
 * src/SortableList.* + src/internal/, so it MUST run before the bundled-leaf
 * tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/SortableList.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write SortableList.css + SortableList.d.ts)
 *   4. copy src/internal/ → each leaf src/internal/ (excluding *.test.ts)
 *   5. render each leaf README from the IR + the hand-kept event manifest
 *   6. ENFORCE validateDocsPropsTable against docs/components/sortable-list.md
 *      (THROWS on drift of the IR-derivable structural columns — prop name,
 *      type, default — but NEVER rewrites the hand-authored prose; Plan 20-04)
 */
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/sortable-list
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/SortableList.rozie');
const FILENAME = 'SortableList.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'SortableList.tsx', build: 'tsdown' },
  vue: {
    dir: 'vue',
    file: 'SortableList.vue',
    build: 'source',
    // Vue dual-packaging (rolled out from the cropper-vue spike): the runtime
    // peers externalized from the Vite lib build + the per-family engine devDeps
    // that vue-tsc needs for declaration emit. The vendored src/internal/
    // useSortableJS bridge is NOT externalized — the Vite lib build BUNDLES it
    // into dist/index.mjs (only vue + sortablejs are external).
    externals: ['vue', 'sortablejs', /^vue\//],
    engineDevDeps: { sortablejs: '^1.15', '@types/sortablejs': '^1.15' },
  },
  svelte: { dir: 'svelte', file: 'SortableList.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'SortableList.ts', build: 'source' },
  solid: { dir: 'solid', file: 'SortableList.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'SortableList.ts', build: 'tsdown' },
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

/** Copy src/internal/ → leaf src/internal/, excluding any *.test.ts. */
function copyInternal(leafSrc) {
  const src = resolve(ROOT, 'src/internal');
  const dest = resolve(leafSrc, 'internal');
  cpSync(src, dest, {
    recursive: true,
    filter: (from) => !from.endsWith('.test.ts'),
  });
}

function main() {
  const source = readFileSync(SRC, 'utf8');

  // (2) parse + lower ONCE for the doc tables.
  const { ast } = parse(source, { filename: FILENAME });
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

  // Keep the hand-kept event manifest in lockstep with ir.emits.
  for (const ev of ir.emits) {
    if (!eventManifest[ev]) {
      throw new Error(
        `codegen: event "${ev}" is emitted by the source but has no entry in event-manifest.mjs`,
      );
    }
  }

  // Keep the hand-kept handle manifest in lockstep with ir.expose (Phase 21).
  for (const m of ir.expose) {
    if (!handleManifest[m.name]) {
      throw new Error(
        `codegen: method "${m.name}" is exposed by the source but has no entry in handle-manifest.mjs`,
      );
    }
  }

  // (3)(4)(5) per-target emit + vendor + README.
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

    // Vue leaf: emit the dual-packaging build config + barrel + tsconfig + patch
    // the leaf package.json (compiled drop-in at `.` + raw SFC at `./source`).
    // The vendored src/internal/ bridge is copied below (copyInternal) and gets
    // BUNDLED into dist/index.mjs by the Vite lib build (it is not externalized).
    if (target === 'vue') {
      emitVueDualPackaging({
        leafDir: resolve(ROOT, 'packages', cfg.dir),
        componentName: cfg.file.replace(/\.vue$/, ''),
        externals: cfg.externals,
        engineDevDeps: cfg.engineDevDeps,
      });
    }

    // Bundled leaves (tsdown) entry on src/index.ts. The emitted component is
    // a DEFAULT export (`export default function|class SortableList`), so the
    // barrel must re-export the default under the named `SortableList` the
    // READMEs/consumers import. `export *` would NOT forward a default — that
    // is why the 20-01 stub barrel produced an empty bundle. Regenerating the
    // barrel here keeps it in lockstep with the emitted export shape.
    if (cfg.build === 'tsdown') {
      // React/Solid emit a named `SortableListHandle` interface in the leaf
      // itself (Phase 21 $expose), so the barrel forwards it verbatim for
      // `import type { SortableListHandle }`. Lit gets no named type — its handle
      // is the custom element itself — so the plain barrel is correct there.
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as SortableList } from './SortableList';\n` +
            `export { default } from './SortableList';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { SortableListHandle } from './SortableList';\n`
          : `export { default as SortableList } from './SortableList';\nexport { default } from './SortableList';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'SortableList.css'), r.css);
      if (r.types) writeFileSync(resolve(leafSrc, 'SortableList.d.ts'), r.types);
    }

    // (4) vendor the helper (relative ./internal/useSortableJS resolves verbatim).
    copyInternal(leafSrc);

    // (5) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, eventManifest, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // (5b) Vendor the repo LICENSE into each published leaf so the tarball
    // carries its own MIT license text (npm best practice; the root LICENSE
    // does not propagate into per-package tarballs). Copy-from-root keeps the
    // 6 leaf copies from drifting.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓`);
  }

  // (6) ENFORCE docs props-table validation (Plan 20-04): the IR-derivable
  // structural columns (prop name + type + default) in docs/components/sortable-list.md
  // MUST match ir.props or this script THROWS. It does NOT overwrite the
  // hand-authored prose (the Runtime-updatable? column + Descriptions stay) —
  // VALIDATE-NOT-OVERWRITE (OQ2). The docs file is the single-source-of-truth
  // surface for the structural columns; reconcile the table (not the validator)
  // if it drifts.
  const docsPath = resolve(REPO_ROOT, 'docs/components/sortable-list.md');
  if (!existsSync(docsPath)) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${docsPath} not found (the docs page is the single-source-of-truth surface and must exist)`,
    );
  }
  const docs = readFileSync(docsPath, 'utf8');
  const result = validateDocsPropsTable(ir, docs);
  if (!result.ok) {
    throw new Error(
      `codegen: docs props-table validation DRIFT — the IR-derivable structural columns in ${docsPath} ` +
        `do not match ir.props. Fix ONLY the structural columns in the docs table (preserve the ` +
        `Runtime-updatable? + Description prose); do NOT weaken this validator:\n` +
        result.errors.map((e) => `  - ${e}`).join('\n'),
    );
  }
  console.log(
    `codegen: docs props-table validation PASS — ${result.checkedRows} rows match ir.props (ENFORCING; throws on drift)`,
  );

  console.log('codegen: done — 6 targets emitted, internal/ vendored, 6 READMEs rendered.');
}

main();
