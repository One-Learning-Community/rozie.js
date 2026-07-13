/**
 * codegen.mjs — the single parse-once → emit-6 → vendor-internal → render-READMEs
 * engine for @rozie-ui/popover.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry). NO compiler/emitter/IR change. If a compile() call emits
 * an error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as the cropper/maplibre codegen + the in-compile ROZ977 guard); per the
 * scope fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * Popover wraps the npm engine `@floating-ui/dom` (peer dep on each leaf; tsdown
 * external on react/solid/lit; Vite-external + vue-tsc devDep on vue). The branchy
 * middleware builder lives in `src/internal/middleware.ts`, vendored into each leaf
 * via copyInternal (excluding *.test.ts).
 *
 * BUILD-ORDER CONTRACT: this script writes each leaf's src/Popover.*, so it MUST
 * run before the bundled-leaf tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/Popover.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write Popover.css [+ Popover.global.css if present] + Popover.d.ts)
 *   4. vendor src/internal/ → each leaf src/internal/
 *   5. render each leaf README from the IR + the hand-kept event/handle manifests
 *   6. ENFORCE validateDocsPropsTable against docs/components/popover.md
 *      (THROWS if absent AND on drift of the IR-derivable structural columns —
 *      prop name, type, default. ROZIE_POPOVER_SKIP_GUIDE=1 relaxes the
 *      absent-guide throw to a skip so the leaves can be emitted before the guide.)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildManifest, compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/popover
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/Popover.rozie');
const FILENAME = 'Popover.rozie';
const ENGINE = '@floating-ui/dom';
const ENGINE_VERSION = '^1.7.2';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'Popover.tsx', build: 'tsdown' },
  vue: {
    dir: 'vue',
    file: 'Popover.vue',
    build: 'source',
    externals: ['vue', ENGINE, /^vue\//],
    engineDevDeps: { [ENGINE]: ENGINE_VERSION },
  },
  svelte: { dir: 'svelte', file: 'Popover.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'Popover.ts', build: 'source' },
  solid: { dir: 'solid', file: 'Popover.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'Popover.ts', build: 'tsdown' },
};

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf8')).name;
}

/** Vendor src/internal/ → leaf src/internal/ (excluding *.test.ts), if present. */
function copyInternal(leafSrc) {
  const src = resolve(ROOT, 'src/internal');
  if (!existsSync(src)) return;
  cpSync(src, resolve(leafSrc, 'internal'), {
    recursive: true,
    filter: (from) => !from.endsWith('.test.ts'),
  });
}

/** Copy src/themes/ → leaf src/themes/ (the design-token presets). */
function copyThemes(leafSrc) {
  const src = resolve(ROOT, 'src/themes');
  if (!existsSync(src)) throw new Error('codegen: src/themes/ not found (token presets must exist)');
  cpSync(src, resolve(leafSrc, 'themes'), { recursive: true });
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
 * idempotently each codegen run; `version` is PRESERVED.
 */
function emitVueDualPackaging({ leafDir, componentName, externals, engineDevDeps }) {
  const renderExternal = (e) => (e instanceof RegExp ? e.toString() : `'${e}'`);
  const externalsLiteral = `[${externals.map(renderExternal).join(', ')}]`;

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

  writeFileSync(
    resolve(leafDir, 'src', 'index.ts'),
    `export { default as ${componentName} } from './${componentName}.vue';
export { default } from './${componentName}.vue';
`,
  );

  writeFileSync(
    resolve(leafDir, 'tsconfig.json'),
    `{
  // strictNullChecks/exactOptionalPropertyTypes/noImplicitAny relaxed: the SFC is
  // deliberately \`any\`-typed (type-only <script setup> macros). This tsconfig drives
  // vue-tsc DECLARATION EMIT (not noEmit typecheck) to produce dist/index.d.ts.
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
    './themes/*': './src/themes/*',
    './rozie-manifest.json': './rozie-manifest.json',
  };
  pkg.files = ['dist', 'src', 'rozie-manifest.json'];
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

  // Published-primitive manifest — derived ONCE from the same IR. The bytes are
  // target-agnostic, so the SAME manifestJson is written into all 6 leaf roots.
  const manifest = buildManifest(ir);
  const manifestJson = JSON.stringify(manifest, null, 2) + '\n';

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

  // (3)(4)(5) per-target emit + vendor internal + README.
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

    // Vue leaf dual-packaging config + barrel + tsconfig + package.json patch.
    if (target === 'vue') {
      emitVueDualPackaging({
        leafDir: resolve(ROOT, 'packages', cfg.dir),
        componentName: cfg.file.replace(/\.vue$/, ''),
        externals: cfg.externals,
        engineDevDeps: cfg.engineDevDeps,
      });
    }

    // Bundled leaves (tsdown) entry on src/index.ts.
    if (cfg.build === 'tsdown') {
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as Popover } from './Popover';\n` +
            `export { default } from './Popover';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { PopoverHandle } from './Popover';\n`
          : `export { default as Popover } from './Popover';\nexport { default } from './Popover';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'Popover.css'), r.css);
      const globalCssPath = resolve(leafSrc, 'Popover.global.css');
      if (r.globalCss) {
        writeFileSync(globalCssPath, r.globalCss);
      } else if (existsSync(globalCssPath)) {
        rmSync(globalCssPath);
      }
      if (r.types) writeFileSync(resolve(leafSrc, 'Popover.d.ts'), r.types);
    }

    // (4) vendor the internal helper (middleware builder) + design-token themes.
    copyInternal(leafSrc);
    copyThemes(leafSrc);

    // (5) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, eventManifest, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // Vendor the repo LICENSE into each published leaf.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    // Published-primitive manifest at the LEAF PACKAGE ROOT (sibling to
    // package.json, NOT under src/) — byte-identical across all 6 leaves.
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'rozie-manifest.json'), manifestJson);

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(
      `codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓ (+ internal/ + themes/ + rozie-manifest.json)`,
    );
  }

  // (6) ENFORCE docs props-table validation against docs/components/popover.md.
  const guideRelPath = 'docs/components/popover.md';
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  const guideExists = existsSync(guidePath);
  const skipGuide = process.env.ROZIE_POPOVER_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). Author it; to emit the leaves before then, ` +
        `run with ROZIE_POPOVER_SKIP_GUIDE=1.`,
    );
  }
  if (!guideExists) {
    console.log(
      'codegen: docs props-table validation SKIPPED — docs/components/popover.md not yet authored ' +
        '(ROZIE_POPOVER_SKIP_GUIDE=1; author the guide and re-run WITHOUT the flag).',
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
    'codegen: done — 6 targets emitted, internal + themes vendored, 6 READMEs rendered, 6 LICENSEs vendored.',
  );
}

main();
