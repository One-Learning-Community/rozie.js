/**
 * codegen.mjs — the single parse-once → emit-6 → render-READMEs engine for
 * @rozie-ui/flatpickr.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive docs/.vitepress/rozie-codegen.ts
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as rozie-codegen.ts + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * Unlike @rozie-ui/sortable-list there is NO `src/internal/` helper to vendor:
 * Flatpickr.rozie imports `flatpickr` directly, so the leaves carry no
 * colocated bridge. (Step 1 of the flatpickr port; mirror of the sortable-list
 * codegen otherwise.)
 *
 * BUILD-ORDER CONTRACT: this script writes each leaf's src/Flatpickr.*, so it
 * MUST run before the bundled-leaf tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/Flatpickr.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write Flatpickr.css + Flatpickr.d.ts)
 *   4. render each leaf README from the IR + the hand-kept event manifest
 *   5. (optional) ENFORCE validateDocsPropsTable IF a guide page with a
 *      "### Props" table exists (none ships for flatpickr today — skipped).
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/flatpickr
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/Flatpickr.rozie');
const FILENAME = 'Flatpickr.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'Flatpickr.tsx', build: 'tsdown' },
  vue: {
    dir: 'vue',
    file: 'Flatpickr.vue',
    build: 'source',
    // Vue dual-packaging (rolled out from the cropper-vue spike): the runtime
    // peers externalized from the Vite lib build + the per-family engine devDep
    // that vue-tsc needs for declaration emit.
    externals: ['vue', 'flatpickr', /^vue\//],
    engineDevDeps: { flatpickr: '^4.6' },
  },
  svelte: { dir: 'svelte', file: 'Flatpickr.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'Flatpickr.ts', build: 'source' },
  solid: { dir: 'solid', file: 'Flatpickr.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'Flatpickr.ts', build: 'tsdown' },
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

    // Vue leaf strict-tsc aid: the Vue dual-packaging build runs
    // `vue-tsc --declaration` which FULLY type-checks the SFC for the
    // dist/index.d.ts emit (the bundled tsdown leaves' isolated-declaration emit
    // never deep-checks the call body, which is why flatpickr's bundled leaves
    // stayed green without an aid). flatpickr's `Options` narrows several fields
    // to string-literal unions (mode / position / monthSelectorType / …), but
    // the emitted props type them as plain `string`, so the inline options
    // literal fails to satisfy the `flatpickr(Node, Options)` overload and TS
    // falls through to the `(string, …)` overload (TS2769). Cast the engine call
    // to bypass the literal-union mismatch — a pure type assertion (zero runtime
    // change; the internal `instance` binding is not part of the emitted .d.ts
    // surface). NOT an emitter edit (SCOPE FENCE): a durable, token-anchored,
    // fail-loud codegen aid, mirroring the cropper imageEl / fullcalendar `opts`
    // aids. The svelte leaf (svelte-package) still never strict-body-checks at
    // build; the ANGULAR leaf, however, now compiles via ng-packagr (real
    // ngc/tsc) under the dist+source standard, so it hits the same TS2769 and
    // gets the same cast (its call site uses the Angular signal/ElementRef form).
    let code = r.code;
    if (target === 'vue') {
      const NEEDLE = 'instance = flatpickr(inputElRef.value!, {';
      if (!code.includes(NEEDLE)) {
        throw new Error(
          'codegen vue: flatpickr engine-call type-aid anchor not found — the Vue emit shape ' +
            `changed. Expected to cast:\n  ${NEEDLE}\n` +
            'Re-confirm the emitted flatpickr() call and update (or remove) this aid.',
        );
      }
      code = code.replace(NEEDLE, 'instance = (flatpickr as any)(inputElRef.value!, {');
    }
    if (target === 'angular') {
      const NEEDLE = 'this.instance = flatpickr(this.inputEl()!.nativeElement, {';
      if (!code.includes(NEEDLE)) {
        throw new Error(
          'codegen angular: flatpickr engine-call type-aid anchor not found — the Angular emit ' +
            `shape changed. Expected to cast:\n  ${NEEDLE}\n` +
            'Re-confirm the emitted flatpickr() call and update (or remove) this aid.',
        );
      }
      code = code.replace(NEEDLE, 'this.instance = (flatpickr as any)(this.inputEl()!.nativeElement, {');
    }
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
    // `Flatpickr` the READMEs/consumers import (an `export *` would NOT forward
    // a default).
    if (cfg.build === 'tsdown') {
      // React AND Solid: re-export the named `FlatpickrHandle` type directly
      // from the component module. The React/Solid emitters now emit the
      // synthesized handle interface as `export interface FlatpickrHandle`
      // in the .tsx itself (Phase 21 REQ-10 follow-up), so consumers can
      // `import type { FlatpickrHandle }` and the barrel forwards it verbatim
      // — no ComponentRef derivation, no module-private caveat. Lit gets no
      // named type: its handle is the custom element itself, so the plain
      // barrel is correct there.
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as Flatpickr } from './Flatpickr';\n` +
            `export { default } from './Flatpickr';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { FlatpickrHandle } from './Flatpickr';\n`
          : `export { default as Flatpickr } from './Flatpickr';\nexport { default } from './Flatpickr';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'Flatpickr.css'), r.css);
      if (r.types) writeFileSync(resolve(leafSrc, 'Flatpickr.d.ts'), r.types);
    }

    // (4) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, eventManifest, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // Vendor the repo LICENSE into each published leaf so the tarball carries
    // its own MIT license text (the root LICENSE does not propagate into
    // per-package tarballs). Copy-from-root keeps the 6 copies from drifting.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓`);
  }

  // (5) OPTIONAL docs props-table validation. Flatpickr ships a live-compile
  // showcase page (docs/examples/flatpickr.md) with no "### Props" table, so
  // there is nothing to validate against — unlike sortable-list's
  // docs/components/sortable-list.md. If a guide page is added later, this enforces
  // structural-column parity (VALIDATE-NOT-OVERWRITE) and throws on drift.
  const guidePath = resolve(REPO_ROOT, 'docs/components/flatpickr.md');
  if (existsSync(guidePath)) {
    const docs = readFileSync(guidePath, 'utf8');
    const result = validateDocsPropsTable(ir, docs);
    if (!result.ok) {
      throw new Error(
        `codegen: docs props-table validation DRIFT in ${guidePath}:\n` +
          result.errors.map((e) => `  - ${e}`).join('\n'),
      );
    }
    console.log(
      `codegen: docs props-table validation PASS — ${result.checkedRows} rows match ir.props`,
    );
  } else {
    console.log(
      'codegen: docs props-table validation SKIPPED — no docs/components/flatpickr.md props table (showcase page only)',
    );
  }

  console.log('codegen: done — 6 targets emitted, 6 READMEs rendered.');
}

main();
