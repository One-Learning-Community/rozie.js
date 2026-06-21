/**
 * codegen.mjs — parse-once -> emit-6 -> render-READMEs for @rozie-ui/captcha.
 *
 * MULTI-COMPONENT: the family ships TWO components from one codegen pass — the
 * provider-switchable `Captcha` (the PRIMARY component: owns each package's
 * default export, the docs slug `captcha`, and the README "main" framing) and
 * the standalone imperative-first `RecaptchaV3`. Loop shape is OUTER-targets,
 * INNER-components: parse+lower each component ONCE up front, then for each of
 * the six targets emit every component's leaf file + do the per-leaf one-time
 * work (copyInternal / combined barrel / vue dual-pkg / README) exactly once.
 *
 * Pure GLUE over the @rozie/core public API (compile / parse / lowerToIR /
 * createDefaultRegistry). NO compiler/emitter/IR change. If a compile() call
 * emits an error-severity diagnostic this script THROWS (SCOPE FENCE: do NOT
 * edit any emitter — that would be its own phase).
 *
 * BUILD-ORDER CONTRACT: writes each leaf src/<Name>.*, so it MUST run before the
 * bundled-leaf tsdown builds (turbo run build --force).
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const BT = String.fromCharCode(96);
// The family slug (docs path, lit element prefix). The PRIMARY component owns it.
const SLUG = "captcha";
const STYLED = false;
const ENGINE = null;
const ENGINE_VERSION = null;

// The components this family ships. The FIRST entry is the PRIMARY component —
// it owns the package default export and the README/docs framing.
const COMPONENTS = [
  { name: 'Captcha', slug: 'captcha' },
  { name: 'RecaptchaV3', slug: 'recaptcha-v3' },
];

const ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(ROOT, '..', '..', '..');

/** Vendor src/internal/ → leaf src/internal/ (excluding *.test.ts), if present. */
function copyInternal(leafSrc) {
  const src = resolve(ROOT, 'src/internal');
  if (!existsSync(src)) return;
  cpSync(src, resolve(leafSrc, 'internal'), {
    recursive: true,
    filter: (from) => !from.endsWith('.test.ts'),
  });
}

const VUE_EXTERNALS = ENGINE ? ['vue', ENGINE, /^vue\//] : ['vue', /^vue\//];
const VUE_ENGINE_DEV_DEPS = ENGINE ? { [ENGINE]: ENGINE_VERSION } : {};

// Per-component file extension by target.
const EXT = {
  react: 'tsx',
  vue: 'vue',
  svelte: 'svelte',
  angular: 'ts',
  solid: 'tsx',
  lit: 'ts',
};

const TARGETS = {
  react: { dir: 'react', build: 'tsdown' },
  vue: {
    dir: 'vue',
    build: 'source',
    externals: VUE_EXTERNALS,
    engineDevDeps: VUE_ENGINE_DEV_DEPS,
  },
  svelte: { dir: 'svelte', build: 'source' },
  angular: { dir: 'angular', build: 'source' },
  solid: { dir: 'solid', build: 'tsdown' },
  lit: { dir: 'lit', build: 'tsdown' },
};

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf8')).name;
}

const COMMON_VUE_BUILD_DEV_DEPS = {
  '@vitejs/plugin-vue': '^6',
  vite: '^8',
  'vite-plugin-css-injected-by-js': '^5',
  vue: '^3.5',
  'vue-tsc': '^3',
};

// Vue dual-packaging: ship BOTH a compiled drop-in (dist/index.mjs, CSS-inlined +
// dist/index.d.ts) AND the raw SFC (./source). Vue cannot use tsdown, so the build
// is Vite lib mode + @vitejs/plugin-vue + vite-plugin-css-injected-by-js. Patches
// the Vue-leaf files idempotently each run; version is PRESERVED. Called ONCE per
// Vue leaf with the full `components` array — it writes the COMBINED src/index.ts
// (primary = default + named; subsequent = named-only) in this single call.
function emitVueDualPackaging({ leafDir, components, externals, engineDevDeps }) {
  const renderExternal = (e) => (e instanceof RegExp ? e.toString() : "'" + e + "'");
  const externalsLiteral = '[' + externals.map(renderExternal).join(', ') + ']';
  const primary = components[0].name;

  const viteConfig = [
    "import { defineConfig } from 'vite';",
    "import vue from '@vitejs/plugin-vue';",
    "import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';",
    '',
    '// Vue dual-packaging: compile the raw SFC to a drop-in dist/index.mjs via Vite',
    '// lib mode + @vitejs/plugin-vue. vite-plugin-css-injected-by-js inlines any SFC',
    '// scoped style into the JS. The runtime peers are externalized.',
    'export default defineConfig({',
    '  plugins: [vue(), cssInjectedByJsPlugin()],',
    '  build: {',
    "    outDir: 'dist',",
    '    emptyOutDir: true,',
    '    lib: {',
    "      entry: 'src/index.ts',",
    "      formats: ['es'],",
    "      fileName: () => 'index.mjs',",
    '    },',
    '    rollupOptions: {',
    '      external: ' + externalsLiteral + ',',
    '    },',
    '  },',
    '});',
    '',
  ].join('\n');
  writeFileSync(resolve(leafDir, 'vite.config.ts'), viteConfig);

  // Combined barrel: the PRIMARY component is the package default (+ a named
  // alias); every subsequent component is named-only (one default per package).
  const indexLines = components.map((comp, i) =>
    i === 0
      ? "export { default, default as " + comp.name + " } from './" + comp.name + ".vue';"
      : "export { default as " + comp.name + " } from './" + comp.name + ".vue';",
  );
  writeFileSync(resolve(leafDir, 'src', 'index.ts'), indexLines.join('\n') + '\n');

  const vueTsconfig = {
    extends: '../../../../../tsconfig.base.json',
    compilerOptions: {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: 'dist',
      module: 'ESNext',
      target: 'ES2022',
      moduleResolution: 'bundler',
      skipLibCheck: true,
      strictNullChecks: false,
      exactOptionalPropertyTypes: false,
      noImplicitAny: false,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    },
    include: ['src'],
    exclude: ['dist', 'node_modules'],
  };
  writeFileSync(resolve(leafDir, 'tsconfig.json'), JSON.stringify(vueTsconfig, null, 2) + '\n');

  const pkgPath = resolve(leafDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.exports = {
    '.': { types: './dist/index.d.ts', import: './dist/index.mjs', default: './dist/index.mjs' },
    './source': {
      // The raw-source escape hatch points at the PRIMARY SFC.
      vue: './src/' + primary + '.vue',
      default: './src/' + primary + '.vue',
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
  for (const depField of ['dependencies', 'devDependencies']) {
    const deps = pkg[depField];
    if (!deps) continue;
    for (const [n, ver] of Object.entries(deps)) {
      if (n.startsWith('@rozie/runtime-') && ver === 'workspace:*') deps[n] = 'workspace:^';
    }
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function main() {
  // Hoist parse + lower OUTSIDE the TARGETS loop — once per component. The same
  // IR object is reused across all six targets (renderReadme + docs validation
  // get the same IR). Manifest-completeness asserts run here, per component.
  const comps = COMPONENTS.map(({ name, slug }) => {
    const filename = name + '.rozie';
    const source = readFileSync(resolve(ROOT, 'src', filename), 'utf8');
    const { ast } = parse(source, { filename });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

    const evManifest = eventManifest[name];
    if (!evManifest) {
      throw new Error('codegen: no event-manifest entry for component "' + name + '"');
    }
    for (const ev of ir.emits) {
      if (!evManifest[ev]) {
        throw new Error(
          'codegen: event "' + ev + '" is emitted by ' + name +
            ' but has no entry in event-manifest.mjs[' + name + ']',
        );
      }
    }
    const hManifest = handleManifest[name];
    if (!hManifest) {
      throw new Error('codegen: no handle-manifest entry for component "' + name + '"');
    }
    for (const m of ir.expose) {
      if (!hManifest[m.name]) {
        throw new Error(
          'codegen: method "' + m.name + '" is exposed by ' + name +
            ' but has no entry in handle-manifest.mjs[' + name + ']',
        );
      }
    }

    return { name, slug, ir, source, filename };
  });

  for (const [target, cfg] of Object.entries(TARGETS)) {
    const ext = EXT[target];
    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    // Inner loop: emit every component's leaf file (+ react sidecars).
    for (const comp of comps) {
      const r = compile(comp.source, { target, filename: comp.filename });
      const errs = r.diagnostics.filter((d) => d.severity === 'error');
      if (errs.length) {
        throw new Error(
          'codegen ' + target + ' (' + comp.name +
            '): compile emitted error diagnostics (SCOPE FENCE: do NOT edit any emitter — fix the codegen path):\n' +
            errs.map((e) => '  ' + e.code + ': ' + e.message).join('\n'),
        );
      }

      writeFileSync(resolve(leafSrc, comp.name + '.' + ext), r.code);

      if (target === 'react') {
        if (r.css) {
          if (!STYLED) {
            throw new Error(
              'codegen react (' + comp.name + '): the source emitted CSS but this family was scaffolded UNSTYLED. ' +
                'Re-scaffold with --styled (wires the react .css copy + ambient decl) or remove the style block.',
            );
          }
          writeFileSync(resolve(leafSrc, comp.name + '.css'), r.css);
        }
        if (r.types) writeFileSync(resolve(leafSrc, comp.name + '.d.ts'), r.types);
      }
    }

    // Per-leaf ONE-TIME work (after the inner component loop) — exactly once.

    // Vendor src/internal/ (loadCaptchaApi + loadRecaptchaV3) into the leaf so
    // the relative `./internal/...` imports resolve in the compiled output, on
    // every target. Copying the whole dir once covers BOTH components.
    copyInternal(leafSrc);

    if (target === 'vue') {
      emitVueDualPackaging({
        leafDir: resolve(ROOT, 'packages', cfg.dir),
        components: COMPONENTS,
        externals: cfg.externals,
        engineDevDeps: cfg.engineDevDeps,
      });
    }

    if (cfg.build === 'tsdown') {
      // Combined barrel: PRIMARY = default + named; subsequent = named-only.
      // The emitted leaf default-exports its component (verified), so a
      // subsequent component re-exports the default under its named binding.
      const barrelLines = [];
      comps.forEach((comp, i) => {
        if (i === 0) {
          barrelLines.push("export { default as " + comp.name + " } from './" + comp.name + "';");
          barrelLines.push("export { default } from './" + comp.name + "';");
        } else {
          barrelLines.push("export { default as " + comp.name + " } from './" + comp.name + "';");
        }
      });
      // react/solid additionally re-export each exposing component's Handle type.
      // Lit does NOT (the element IS the handle).
      if (target === 'react' || target === 'solid') {
        for (const comp of comps) {
          if (comp.ir.expose.length > 0) {
            barrelLines.push('');
            barrelLines.push(
              '/** The ' + BT + '$expose' + BT + ' imperative handle for ' + comp.name +
                ' received via ' + BT + 'ref' + BT + ' — { ' +
                comp.ir.expose.map((m) => m.name).join(', ') + ' }. */',
            );
            barrelLines.push("export type { " + comp.name + "Handle } from './" + comp.name + "';");
          }
        }
      }
      writeFileSync(resolve(leafSrc, 'index.ts'), barrelLines.join('\n') + '\n');
    }

    const pkgName = leafPkgName(cfg.dir);
    const readmeComponents = comps.map((c) => ({ name: c.name, ir: c.ir }));
    const readme = renderReadme(target, readmeComponents, eventManifest, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const names = comps.map((c) => c.name).join(' + ');
    console.log('codegen: ' + target.padEnd(8) + ' -> ' + cfg.dir + '/src/  (' + names + ')  OK');
  }

  // Docs props-table validation. Task A keeps the single 2-arg Captcha call;
  // Task B adds opts.heading + the second RecaptchaV3 validation.
  const captcha = comps.find((c) => c.name === 'Captcha');
  const guidePath = resolve(REPO_ROOT, 'docs/components/' + SLUG + '.md');
  if (existsSync(guidePath)) {
    const docs = readFileSync(guidePath, 'utf8');
    const result = validateDocsPropsTable(captcha.ir, docs);
    if (!result.ok) {
      throw new Error(
        'codegen: docs props-table validation DRIFT in ' +
          guidePath +
          ':\n' +
          result.errors.map((e) => '  - ' + e).join('\n'),
      );
    }
    console.log('codegen: docs props-table validation PASS — ' + result.checkedRows + ' rows match Captcha ir.props');
  } else {
    console.log('codegen: docs props-table validation SKIPPED — no docs/components/' + SLUG + '.md');
  }

  console.log(
    'codegen: done — 6 targets × ' + COMPONENTS.length + ' components emitted, 6 READMEs rendered.',
  );
}

main();
