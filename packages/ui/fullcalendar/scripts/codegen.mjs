/**
 * codegen.mjs — the single parse-once → emit-6 → render-READMEs engine for
 * @rozie-ui/fullcalendar.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive docs/.vitepress/rozie-codegen.ts
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as rozie-codegen.ts + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * Like @rozie-ui/flatpickr (and UNLIKE @rozie-ui/sortable-list) there is NO
 * `src/internal/` helper to vendor: FullCalendar.rozie imports the
 * `@fullcalendar/*` engine packages directly, so the leaves carry no colocated
 * bridge and there is NO internal-helper copy step (unlike sortable-list).
 *
 * BUILD-ORDER CONTRACT: this script writes each leaf's src/FullCalendar.*, so it
 * MUST run before the bundled-leaf tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/FullCalendar.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write FullCalendar.css + FullCalendar.d.ts)
 *   4. render each leaf README from the IR + the hand-kept event/handle manifests
 *   5. ENFORCE validateDocsPropsTable against docs/components/fullcalendar.md
 *      (THROWS if the guide is absent AND on drift of the IR-derivable
 *      structural columns — prop name, type, default. Never rewrites the
 *      hand-authored prose. Plan 27-03 ships the guide; until then the
 *      ROZIE_FULLCALENDAR_SKIP_GUIDE escape hatch relaxes the throw to a skip
 *      — see the step-(5) block.)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/fullcalendar
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/FullCalendar.rozie');
const FILENAME = 'FullCalendar.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'FullCalendar.tsx', build: 'tsdown' },
  vue: {
    dir: 'vue',
    file: 'FullCalendar.vue',
    build: 'source',
    // Vue dual-packaging (rolled out from the cropper-vue spike): the runtime
    // peers externalized from the Vite lib build + the per-family engine devDeps
    // that vue-tsc needs for declaration emit. All @fullcalendar/* subpackages
    // are externalized via the /^@fullcalendar\//  regex.
    externals: ['vue', /^@fullcalendar\//, /^vue\//],
    engineDevDeps: {
      '@fullcalendar/core': '^6.1',
      '@fullcalendar/daygrid': '^6.1',
      '@fullcalendar/timegrid': '^6.1',
      '@fullcalendar/interaction': '^6.1',
    },
  },
  svelte: { dir: 'svelte', file: 'FullCalendar.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'FullCalendar.ts', build: 'source' },
  solid: { dir: 'solid', file: 'FullCalendar.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'FullCalendar.ts', build: 'tsdown' },
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
    // FullCalendar's lone `model: true` prop is `view` (the active view NAME,
    // e.g. 'dayGridMonth') — not a form value. The emitter's CVA gate fires on
    // any single-model component, but a calendar view name binding to a form
    // control is nonsensical here, so suppress the auto-`ControlValueAccessor`
    // on the Angular target via the public `angular.cva` config knob (the same
    // mechanism the CvaOffState dist-parity fixture proves byte-equal-when-off).
    // The two-way `[(view)]` model binding is unaffected — only the forms-
    // directive bridge drops. readme.mjs already gates the "Angular forms"
    // section out for FullCalendar, so docs + emit stay consistent.
    const r = compile(source, {
      target,
      filename: FILENAME,
      ...(target === 'angular' ? { angular: { cva: false } } : {}),
    });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    if (errs.length) {
      throw new Error(
        `codegen ${target}: compile emitted error diagnostics (SCOPE FENCE: do NOT edit any emitter — fix the codegen path):\n` +
          errs.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
      );
    }

    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    // Post-emit type-gate aid (TYPE-CHECKED leaves: the bundled tsdown leaves
    // react/solid/lit AND — since the Vue dual-packaging rollout — the Vue leaf,
    // whose `vue-tsc --declaration` step FULLY type-checks the SFC for the
    // dist/index.d.ts emit; the bundled leaves' isolated-declaration emit only
    // shallow-checks, but vue-tsc deep-checks the `<script setup>` body the same
    // way `tsc --noEmit` does).
    //
    // FullCalendar.rozie's `$onMount` builds `const opts = { … }` and THEN
    // conditionally adds `opts.eventContent = …` inside the `event` portal-slot
    // guard. In plain JS that is fine; the engine accepts `eventContent` at
    // runtime. But the strict gate narrows the object literal to its initial
    // keys, so the later property add trips
    // `TS2339: Property 'eventContent' does not exist`. flatpickr never hit this
    // (its emit passes the options literal straight into `flatpickr(input, {…})`
    // with no intervening mutated `const`); this is a NEW emitter/strict-tsc
    // intersection (engine-wrapper + post-literal conditional option add). The
    // proper home for the fix is the emitter (emit a widened annotation for a
    // later-mutated options object), which is OUT OF SCOPE for this plan
    // (SCOPE FENCE). As the sanctioned in-scope per-leaf type aid, widen the
    // generated options literal to `Record<string, any>` here in codegen GLUE
    // — durable across regeneration, scoped to the single line, and a pure
    // type annotation (zero runtime/behavioral change; the source-only
    // svelte/angular leaves are never type-checked at build and don't need it).
    // Tracked as a RISK / emitter follow-up.
    let code = r.code;
    if (cfg.build === 'tsdown' || target === 'vue') {
      const before = code;
      code = code.replace('const opts = {', 'const opts: Record<string, any> = {');
      if (code === before) {
        // Fail loud if the emit shape drifts so this aid never silently no-ops
        // and leaves the gate red.
        throw new Error(
          `codegen ${target}: expected to widen the engine-options literal (\`const opts = {\`) ` +
            `for the strict type-checked-leaf gate, but the token was not found — the emit shape ` +
            `changed. Re-derive the type-gate aid (SCOPE FENCE: do NOT edit the emitter).`,
        );
      }
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
    // `FullCalendar` the READMEs/consumers import (an `export *` would NOT
    // forward a default).
    if (cfg.build === 'tsdown') {
      // React AND Solid: re-export the named `FullCalendarHandle` type directly
      // from the component module. The React/Solid emitters emit the
      // synthesized handle interface as `export interface FullCalendarHandle`
      // in the .tsx itself (Phase 21 REQ-10 follow-up), so consumers can
      // `import type { FullCalendarHandle }` and the barrel forwards it verbatim
      // — no ComponentRef derivation, no module-private caveat. Lit gets no
      // named type: its handle is the custom element itself, so the plain
      // barrel is correct there.
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as FullCalendar } from './FullCalendar';\n` +
            `export { default } from './FullCalendar';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { FullCalendarHandle } from './FullCalendar';\n`
          : `export { default as FullCalendar } from './FullCalendar';\nexport { default } from './FullCalendar';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'FullCalendar.css'), r.css);
      if (r.types) writeFileSync(resolve(leafSrc, 'FullCalendar.d.ts'), r.types);
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

  // (5) ENFORCE docs props-table validation (REQ-27-6): the IR-derivable
  // structural columns (prop name + type + default) in docs/components/fullcalendar.md
  // MUST match ir.props or this script THROWS. It does NOT overwrite the
  // hand-authored prose (Runtime-updatable? column + Descriptions stay) —
  // VALIDATE-NOT-OVERWRITE. The docs file is the single-source-of-truth surface
  // for the structural columns; reconcile the table (not the validator) if it
  // drifts. (Same ENFORCING shape as @rozie-ui/sortable-list — NOT flatpickr's
  // optional existsSync→skip.)
  //
  // Plan 27-03 authors docs/components/fullcalendar.md. Until it lands, the
  // ROZIE_FULLCALENDAR_SKIP_GUIDE env escape hatch relaxes the absent-guide
  // throw to a skip so Plan 27-02 can emit the leaves first. Plan 27-03 runs
  // codegen WITHOUT the flag, flipping validation back to ENFORCING-passing.
  const guideRelPath = 'docs/components/fullcalendar.md';
  const guideExists = existsSync(resolve(REPO_ROOT, guideRelPath));
  const skipGuide = process.env.ROZIE_FULLCALENDAR_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    // ENFORCING: an absent guidePath is a HARD failure (REQ-27-6 ships a real
    // props table). throw here so codegen cannot silently emit leaves without
    // the single-source-of-truth docs surface.
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). Plan 27-03 authors it; to emit the leaves ` +
        `before then, run with ROZIE_FULLCALENDAR_SKIP_GUIDE=1.`,
    );
  }
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  if (!guideExists) {
    console.log(
      'codegen: docs props-table validation SKIPPED — docs/components/fullcalendar.md not yet authored ' +
        '(ROZIE_FULLCALENDAR_SKIP_GUIDE=1; Plan 27-03 authors the guide and re-runs WITHOUT the flag).',
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
