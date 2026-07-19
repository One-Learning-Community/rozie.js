/**
 * codegen.mjs — parse-once -> emit-5 -> render-READMEs for @rozie-ui/lexical.
 *
 * AUTO-DISCOVERY multi-component engine. Unlike captcha's hardcoded COMPONENTS
 * array, this globs every `src/*.rozie` source, so the later waves (plugins,
 * toolbar, @mention decorator) drop new sources in without editing codegen. Loop
 * shape is OUTER-targets, INNER-components: parse+lower each discovered component
 * ONCE up front, then for each of the 5 v1.0 targets
 * (react / vue / svelte / angular / solid — NO Lit, deferred to v1.1 per D-10)
 * emit every component's leaf file + do the per-leaf one-time work exactly once.
 *
 * The PRIMARY component is `LexicalEditor` (the editor shell) — it owns each
 * package's default export and the docs slug `lexical`. It is ordered first
 * regardless of directory-glob order.
 *
 * LEAF-OPTIONAL GUARD: the per-framework leaf packages (packages/<fw>/) land in
 * the distribution wave. Until then this script still writes the emitted
 * `src/<Name>.<ext>` (mkdirSync recursive) and a README, synthesizing the leaf
 * package name; it only patches an existing leaf package.json (Vue dual-packaging)
 * when that package.json is present.
 *
 * Pure GLUE over the @rozie/core public API (compile / parse / lowerToIR /
 * createDefaultRegistry). NO compiler/emitter/IR change. If a compile() call
 * emits an error-severity diagnostic this script THROWS (SCOPE FENCE: do NOT edit
 * any emitter — fix the codegen path).
 *
 * BUILD-ORDER CONTRACT: writes each leaf src/<Name>.*, so it MUST run before any
 * bundled-leaf tsdown builds (turbo run build --force).
 */
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const BT = String.fromCharCode(96);
// The family slug (docs path). The PRIMARY component owns it.
const SLUG = 'lexical';
const SCOPE = '@rozie-ui';
// The editor shell — the FIRST-ordered PRIMARY component (default export + docs).
const PRIMARY_NAME = 'LexicalEditor';
const STYLED = true;

const ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(ROOT, '..', '..', '..');

// Per-component file extension by target. NO lit (v1.0 = 5 targets, D-01/D-10).
const EXT = {
  react: 'tsx',
  vue: 'vue',
  svelte: 'svelte',
  angular: 'ts',
  solid: 'tsx',
};

const TARGETS = {
  react: { dir: 'react', build: 'tsdown' },
  vue: {
    dir: 'vue',
    build: 'source',
    // D-08 externals (the vue-leaf external-drift precedent lives in this list):
    // enumerate every peer explicitly AND keep the `/^@lexical\//` + `/^vue\//`
    // regex backstops so a missed @lexical/* subpackage cannot silently inline a
    // second Lexical instance into dist.
    externals: [
      'vue',
      /^vue\//,
      'lexical',
      '@lexical/rich-text',
      '@lexical/history',
      '@lexical/list',
      '@lexical/link',
      '@lexical/utils',
      /^@lexical\//,
    ],
  },
  svelte: { dir: 'svelte', build: 'source' },
  angular: { dir: 'angular', build: 'source' },
  solid: { dir: 'solid', build: 'tsdown' },
};

// slug = 'lexical' for the primary; kebab-case for any secondary component.
function componentSlug(name) {
  if (name === PRIMARY_NAME) return SLUG;
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * EMITTER-BACKLOG WORKAROUND (codegen-path, NOT an emitter edit — SCOPE FENCE).
 *
 * A behavior-only, PROP-LESS Solid component (the D-02 plugins + the Toolbar, whose
 * props all carry `<data>`/defaults but no bare declared prop) emits
 * `splitProps(_props, [])` against an empty `interface <Name>Props {}`. Solid's typed
 * `splitProps<T, K extends [readonly (keyof T)[], ...]>` signature infers the empty
 * array literal `[]` as `undefined[]` (not `never[]`) in that rest-tuple position, so
 * the leaf `tsc` rejects it (TS2345: `undefined[]` not assignable to `readonly never[]`)
 * — and NO tsconfig relaxation clears it (it is an argument-assignability error, not a
 * strict-mode check). No shipped @rozie-ui Solid leaf hit this before because none had
 * a prop-less component; the lexical plugins are the first.
 *
 * Surgical fix: cast the empty key-array to the empty TUPLE `[]` (`[] as []`), which
 * IS assignable to `readonly never[]`. Matches ONLY the empty-key form (`, [])`), so a
 * real keyed split like `splitProps(_merged, ['delay'])` is untouched. Solid-only.
 *
 * This is a documented emitter gap owed a red-first fix in @rozie/core (the Solid
 * emitter should emit the prop-less split in a `tsc`-clean form). Until then this
 * codegen post-process keeps the plugins genuinely prop-less (no phantom API prop).
 */
function patchSolidEmptySplitProps(target, code) {
  if (target !== 'solid') return code;
  return code.replace(/splitProps\((\w+), \[\]\)/g, 'splitProps($1, [] as [])');
}

/** Discover every src/*.rozie, PRIMARY first, then the rest alphabetically. */
function discoverComponents() {
  const srcDir = resolve(ROOT, 'src');
  if (!existsSync(srcDir)) return [];
  const names = readdirSync(srcDir)
    .filter((f) => f.endsWith('.rozie'))
    .map((f) => f.slice(0, -'.rozie'.length));
  names.sort((a, b) => {
    if (a === PRIMARY_NAME) return -1;
    if (b === PRIMARY_NAME) return 1;
    return a.localeCompare(b);
  });
  return names.map((name) => ({ name, slug: componentSlug(name), filename: name + '.rozie' }));
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

/**
 * Vendor the decorator escape hatch (D-06/D-07/REQ-39) into a leaf's src/:
 *   - src/MentionNode.ts            -> <leaf>/src/MentionNode.ts     (shared, neutral)
 *   - src/bridges/mountDecorators.<target>.ts -> <leaf>/src/mountDecorators.ts
 *   - (svelte only) src/bridges/MentionChip.svelte -> <leaf>/src/MentionChip.svelte
 * Copied VERBATIM — NEVER routed through compile() (hand-written per D-06/REQ-39).
 */
function vendorDecoratorBridge(leafSrc, target) {
  const mentionNode = resolve(ROOT, 'src/MentionNode.ts');
  if (existsSync(mentionNode)) cpSync(mentionNode, resolve(leafSrc, 'MentionNode.ts'));

  const bridge = resolve(ROOT, 'src/bridges/mountDecorators.' + target + '.ts');
  if (existsSync(bridge)) cpSync(bridge, resolve(leafSrc, 'mountDecorators.ts'));

  if (target === 'svelte') {
    const chip = resolve(ROOT, 'src/bridges/MentionChip.svelte');
    if (existsSync(chip)) cpSync(chip, resolve(leafSrc, 'MentionChip.svelte'));
  }
}

/** The leaf package name — read from an existing leaf package.json, else synthesized. */
function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  if (existsSync(pkgPath)) return JSON.parse(readFileSync(pkgPath, 'utf8')).name;
  return SCOPE + '/' + SLUG + '-' + dir;
}

const COMMON_VUE_BUILD_DEV_DEPS = {
  '@vitejs/plugin-vue': '^6',
  vite: '^8',
  'vite-plugin-css-injected-by-js': '^5',
  vue: '^3.5',
  'vue-tsc': '^3',
};

// Vue dual-packaging — patches the Vue leaf package.json + config idempotently.
// Called ONCE per Vue leaf with the full `components` array (primary = default +
// named; subsequent = named-only). Only invoked when the leaf package.json exists
// (distribution wave); until then Vue just gets its emitted SFC + a barrel.
function emitVueDualPackaging({ leafDir, components, externals }) {
  const renderExternal = (e) => (e instanceof RegExp ? e.toString() : "'" + e + "'");
  const externalsLiteral = '[' + externals.map(renderExternal).join(', ') + ']';
  const primary = components[0].name;

  const viteConfig = [
    "import { defineConfig } from 'vite';",
    "import vue from '@vitejs/plugin-vue';",
    "import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';",
    '',
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
  const mergedDevDeps = { ...(pkg.devDependencies ?? {}), ...COMMON_VUE_BUILD_DEV_DEPS };
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
  const discovered = discoverComponents();
  if (discovered.length === 0) {
    console.log('codegen: no src/*.rozie sources discovered yet — nothing to emit.');
    return;
  }

  // Hoist parse + lower OUTSIDE the TARGETS loop — once per component. The same
  // IR object is reused across all targets (renderReadme + docs validation get
  // the same IR). Manifest-completeness asserts run here, per component.
  const comps = discovered.map(({ name, slug, filename }) => {
    const source = readFileSync(resolve(ROOT, 'src', filename), 'utf8');
    const { ast } = parse(source, { filename });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

    // Descriptions are OPTIONAL per component (a source with no emits/expose needs
    // no manifest entry), but if a component DOES emit/expose, every name must be
    // documented — assert that here (auto-discovery-safe: missing key defaults {}).
    const evManifest = eventManifest[name] ?? {};
    for (const ev of ir.emits) {
      if (!evManifest[ev]) {
        throw new Error(
          'codegen: event "' + ev + '" is emitted by ' + name +
            ' but has no entry in event-manifest.mjs[' + name + ']',
        );
      }
    }
    const hManifest = handleManifest[name] ?? {};
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
    const leafDir = resolve(ROOT, 'packages', cfg.dir);
    const leafSrc = resolve(leafDir, 'src');
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

      writeFileSync(resolve(leafSrc, comp.name + '.' + ext), patchSolidEmptySplitProps(target, r.code));

      if (target === 'react') {
        if (r.css) {
          if (!STYLED) {
            throw new Error(
              'codegen react (' + comp.name + '): the source emitted CSS but this family was scaffolded UNSTYLED.',
            );
          }
          writeFileSync(resolve(leafSrc, comp.name + '.css'), r.css);
        }
        // React-only: the emitter hoists `:root`-scoped rules (the global escape
        // hatch) into `r.globalCss` and emits a sibling `import './<Name>.global.css';`
        // side effect in the `.tsx`. Write it so that import resolves + the leaf's
        // tsdown copy can ship it to dist. When a future emit drops all :root rules
        // r.globalCss goes null — delete a stale sibling in lockstep (sidecar hygiene).
        const globalCssPath = resolve(leafSrc, comp.name + '.global.css');
        if (r.globalCss) {
          writeFileSync(globalCssPath, r.globalCss);
        } else if (existsSync(globalCssPath)) {
          rmSync(globalCssPath);
        }
        if (r.types) writeFileSync(resolve(leafSrc, comp.name + '.d.ts'), r.types);
      }
    }

    // Per-leaf ONE-TIME work (after the inner component loop) — exactly once.
    copyInternal(leafSrc);

    // Vendor the decorator escape hatch (D-06/D-07/REQ-39) into this leaf:
    //   (1) the SHARED framework-neutral MentionNode (same file in every leaf), and
    //   (2) the target-MATCHED hand-written mount bridge, renamed to the stable
    //       `mountDecorators.ts` the shell imports (`./mountDecorators`).
    // These are HAND-WRITTEN escape hatches — copied VERBATIM, NEVER routed through
    // compile() (D-06/REQ-39, same principle as portal slots). Svelte's bridge
    // additionally needs its `MentionChip.svelte` sidecar (Svelte 5 `mount()`
    // requires a compiled component). WR-03 sidecar-hygiene: if a future emit drops
    // the shell's bridge import, delete these vendored files in lockstep.
    vendorDecoratorBridge(leafSrc, target);

    // Combined barrel (primary = default + named; subsequent = named-only).
    if (cfg.build === 'tsdown') {
      const barrelLines = [];
      comps.forEach((comp, i) => {
        if (i === 0) {
          barrelLines.push("export { default as " + comp.name + " } from './" + comp.name + "';");
          barrelLines.push("export { default } from './" + comp.name + "';");
        } else {
          barrelLines.push("export { default as " + comp.name + " } from './" + comp.name + "';");
        }
      });
      if (target === 'react' || target === 'solid') {
        for (const comp of comps) {
          if (comp.ir.expose.length > 0) {
            barrelLines.push('');
            barrelLines.push(
              '/** The ' + BT + '$expose' + BT + ' imperative handle for ' + comp.name +
                ' received via ' + BT + 'ref' + BT + '. */',
            );
            barrelLines.push("export type { " + comp.name + "Handle } from './" + comp.name + "';");
          }
        }
      }
      writeFileSync(resolve(leafSrc, 'index.ts'), barrelLines.join('\n') + '\n');
    }

    if (target === 'vue') {
      // Always write the combined barrel; only patch package.json/configs when the
      // leaf package.json exists (distribution wave).
      const indexLines = comps.map((comp, i) =>
        i === 0
          ? "export { default, default as " + comp.name + " } from './" + comp.name + ".vue';"
          : "export { default as " + comp.name + " } from './" + comp.name + ".vue';",
      );
      writeFileSync(resolve(leafSrc, 'index.ts'), indexLines.join('\n') + '\n');

      if (existsSync(resolve(leafDir, 'package.json'))) {
        emitVueDualPackaging({ leafDir, components: comps, externals: cfg.externals });
      }
    }

    const pkgName = leafPkgName(cfg.dir);
    const readmeComponents = comps.map((c) => ({ name: c.name, ir: c.ir }));
    const readme = renderReadme(target, readmeComponents, eventManifest, pkgName, handleManifest);
    writeFileSync(resolve(leafDir, 'README.md'), readme);

    if (existsSync(resolve(REPO_ROOT, 'LICENSE'))) {
      cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(leafDir, 'LICENSE'));
    }

    const names = comps.map((c) => c.name).join(' + ');
    console.log('codegen: ' + target.padEnd(8) + ' -> ' + cfg.dir + '/src/  (' + names + ')  OK');
  }

  // Docs props-table validation — per component, only when the guide exists.
  const guidePath = resolve(REPO_ROOT, 'docs/components/' + SLUG + '.md');
  if (existsSync(guidePath)) {
    const docs = readFileSync(guidePath, 'utf8');
    const primary = comps[0];
    const result = validateDocsPropsTable(primary.ir, docs, { heading: '### Props' });
    if (!result.ok) {
      throw new Error(
        'codegen: docs props-table validation DRIFT in ' + guidePath + ':\n' +
          result.errors.map((e) => '  - ' + e).join('\n'),
      );
    }
    console.log(
      'codegen: docs props-table validation PASS — ' + result.checkedRows +
        ' rows match ' + primary.name + ' ir.props',
    );
  } else {
    console.log('codegen: docs props-table validation SKIPPED — no docs/components/' + SLUG + '.md');
  }

  console.log(
    'codegen: done — 5 targets × ' + comps.length + ' component' + (comps.length > 1 ? 's' : '') +
      ' emitted, 5 READMEs rendered.',
  );
}

main();
