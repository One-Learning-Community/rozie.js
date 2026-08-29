/**
 * codegen.mjs — parse-once → emit (generic Chart + 8 per-type variants) → 6
 * leaves → READMEs for @rozie-ui/chartjs.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry). NO compiler/emitter/IR change. A compile() error
 * diagnostic THROWS (scope-fence: an error means a mis-wired codegen path, never
 * an emitter edit).
 *
 * Phase 31 generalization: from "1 source → 6 leaves" to "1 source + N variant
 * specs → 6 leaves, each exporting the generic `Chart` PLUS 8 per-type
 * components (Line/Bar/Pie/Doughnut/PolarArea/Radar/Scatter/Bubble)". Each
 * variant is produced from Chart.rozie by a bounded, fail-loud source transform
 * (remove the `type` prop + its $watch, pin `type`, narrow + add the
 * registration), so every typed component is a COMPLETE native chart carrying
 * the full surface (props−type / 3 events / 8-verb handle / tooltip+fallback
 * slots) with zero cross-framework forwarding ceremony.
 *
 * Registration model (Phase 31): the generic `Chart` no longer auto-registers
 * (tree-shakable — the consumer registers what they use). Each per-type variant
 * registers its OWN controller/element/scale set, so importing one is
 * tree-shakable by construction on the source leaves (vue/svelte/angular ship
 * separate files). A per-leaf `/auto` entry (`@rozie-ui/chartjs-<fw>/auto`)
 * registers `...registerables` then re-exports the barrel — the kitchen-sink
 * convenience.
 *
 * BUILD-ORDER CONTRACT: this writes each leaf's src/*, so it MUST run before the
 * bundled-leaf tsdown builds.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { validateDocsSurfaceNames } from '../../docs-surface-guard.mjs';
import { buildCustomElementsManifest } from './cem.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';
import { buildWebTypes } from './web-types.mjs';

// JetBrains web-types (Vue leaf) + Custom Elements Manifest (Lit leaf) prose
// (D-05). PhpStorm/WebStorm read `web-types` — NOT vue-tsc's `__VLS_` .d.ts
// (WEB-57769) — for prop/event/slot completion; VS Code (lit-plugin) AND
// JetBrains both read the CEM for `<rozie-chart>`/`<rozie-line>`/…
// completion. Both sidecars cover all NINE components (generic Chart + 8
// per-type variants) — see the MULTI-COMPONENT notes in web-types.mjs / cem.mjs.
const IDE_SIDECAR_DOC_URL = 'https://github.com/One-Learning-Community/rozie.js#readme';
const IDE_SIDECAR_DESCRIPTION_GENERIC =
  "Rozie's cross-framework port of Chart.js — the generic chart, whose `type` " +
  'prop switches the chart kind across the whole Chart.js controller set.';
/** Per-variant description: "The Bar chart — Chart.rozie pinned to type: 'bar'." */
function variantDescription(variant) {
  return (
    `The ${variant.name} chart — Rozie's cross-framework port of Chart.js, pinned to ` +
    `\`type: '${variant.type}'\` and registering only its own Chart.js controller set.`
  );
}

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/chartjs
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/Chart.rozie');
const FILENAME = 'Chart.rozie';

/**
 * Per-target leaf config.
 *   ext        — component-module path suffix used in the barrel re-exports
 *   exportStyle — 'default' (SFC/JSX default export) | 'named' (Angular class)
 *   handle     — whether the emitter exports a named `<Name>Handle` type
 */
const TARGETS = {
  react: {
    dir: 'react',
    file: 'Chart.tsx',
    vfile: (n) => `${n}.tsx`,
    build: 'tsdown',
    ext: '',
    exportStyle: 'default',
    handle: true,
  },
  vue: {
    dir: 'vue',
    file: 'Chart.vue',
    vfile: (n) => `${n}.vue`,
    build: 'source',
    ext: '.vue',
    exportStyle: 'default',
    handle: false,
  },
  svelte: {
    dir: 'svelte',
    file: 'Chart.svelte',
    vfile: (n) => `${n}.svelte`,
    build: 'source',
    ext: '.svelte',
    exportStyle: 'default',
    handle: false,
  },
  angular: {
    dir: 'angular',
    file: 'Chart.ts',
    vfile: (n) => `${n}.ts`,
    build: 'source',
    ext: '',
    exportStyle: 'named',
    handle: false,
  },
  solid: {
    dir: 'solid',
    file: 'Chart.tsx',
    vfile: (n) => `${n}.tsx`,
    build: 'tsdown',
    ext: '',
    exportStyle: 'default',
    handle: true,
  },
  lit: {
    dir: 'lit',
    file: 'Chart.ts',
    vfile: (n) => `${n}.ts`,
    build: 'tsdown',
    ext: '',
    exportStyle: 'default',
    handle: false,
  },
};

// Common registerables every variant needs (legend + tooltip are enabled by the
// wrapper's defaults; Colors is a convenience auto-color plugin).
const COMMON_REG = ['Legend', 'Tooltip', 'Colors'];

/**
 * Per-type variant specs. `reg` is the type-specific Chart.js registerable set
 * (controller + its elements + scales); COMMON_REG is appended. Order matters
 * only for readability.
 */
const VARIANTS = [
  {
    name: 'Line',
    type: 'line',
    reg: [
      'LineController',
      'LineElement',
      'PointElement',
      'LinearScale',
      'CategoryScale',
      'Filler',
    ],
  },
  {
    name: 'Bar',
    type: 'bar',
    reg: ['BarController', 'BarElement', 'LinearScale', 'CategoryScale'],
  },
  { name: 'Pie', type: 'pie', reg: ['PieController', 'ArcElement'] },
  { name: 'Doughnut', type: 'doughnut', reg: ['DoughnutController', 'ArcElement'] },
  {
    name: 'PolarArea',
    type: 'polarArea',
    reg: ['PolarAreaController', 'ArcElement', 'RadialLinearScale'],
  },
  {
    name: 'Radar',
    type: 'radar',
    reg: ['RadarController', 'LineElement', 'PointElement', 'RadialLinearScale', 'Filler'],
  },
  { name: 'Scatter', type: 'scatter', reg: ['ScatterController', 'PointElement', 'LinearScale'] },
  { name: 'Bubble', type: 'bubble', reg: ['BubbleController', 'PointElement', 'LinearScale'] },
];

/**
 * Transform the generic Chart.rozie source into a per-type variant source.
 * Bounded + fail-loud: every edit asserts its anchor token exists so a future
 * source-shape drift fails the build loudly instead of silently emitting a
 * broken variant.
 */
function makeVariantSource(src, variant) {
  const reg = [...variant.reg, ...COMMON_REG];
  const guard = (cond, msg) => {
    if (!cond)
      throw new Error(
        `codegen variant ${variant.name}: transform guard failed — ${msg} (Chart.rozie source shape changed; re-derive the transform)`,
      );
  };
  let s = src;

  // (a) rename the component
  guard(s.includes('<rozie name="Chart"'), 'no `<rozie name="Chart"`');
  s = s.replace('<rozie name="Chart"', `<rozie name="${variant.name}"`);

  // (b) remove the `type` prop declaration. The prop may carry a multi-line
  //     `docs: { description }` block (Phase 58 self-documenting props), so match
  //     from the 2-space `type: {` opener lazily through its matching 2-space
  //     `},` close — the nested `docs: {` closes at 4-space indent and is skipped.
  //     The `type: String` / `default: 'line'` anchors keep this fail-loud if the
  //     core prop shape changes.
  const typePropRe = /\n {2}type: \{\n {4}type: String,\n {4}default: 'line',[\s\S]*?\n {2}\},/;
  guard(typePropRe.test(s), 'no `type` prop line');
  s = s.replace(typePropRe, '');

  // (c) pin the type in buildConfig
  guard(s.includes('type: $props.type,'), 'no `type: $props.type` in buildConfig');
  s = s.replace('type: $props.type,', `type: '${variant.type}',`);

  // (d) remove the type $watch (no `type` prop to watch)
  guard(s.includes('$watch(() => $props.type, () => recreate())'), 'no type $watch');
  s = s.replace('\n$watch(() => $props.type, () => recreate())', '');

  // (e) narrow + ADD the registration (the generic Chart imports only the class;
  //     the variant registers its own controller set so it works standalone and
  //     is tree-shakable).
  guard(s.includes("import { Chart as ChartJS } from 'chart.js'"), 'no chart.js class import');
  s = s.replace(
    "import { Chart as ChartJS } from 'chart.js'",
    `import { Chart as ChartJS, ${reg.join(', ')} } from 'chart.js'\n` +
      `// ${variant.name} registers only its own Chart.js controller/element/scale set\n` +
      `// (tree-shakable — importing this component does not pull every controller).\n` +
      `ChartJS.register(${reg.join(', ')})`,
  );

  guard(s !== src, 'no-op transform');
  return s;
}

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.name;
}

/** PascalCase variant name → kebab-case subpath token (PolarArea → polar-area). */
function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * React/Solid/Vue/Angular-only type aid: annotate `buildConfig`'s return type
 * as `any`.
 *
 * `buildConfig` builds the `ChartConfiguration` object handed to `new
 * ChartJS(...)`; its `type` field is a plain string literal (`'line'`, the
 * generic `$props.type`, etc.). Before quick 260829-gbs, `buildConfig` was
 * assigned inside `$onMount` to a pre-declared module-scope `let buildConfig =
 * null` — the project's own null-let -> `any` typeNeutralize idiom — so
 * `buildConfig`'s inferred type (and therefore its return type) was `any` on
 * every bundled leaf, and `new ChartJS(canvasEl, buildConfig())` never hit
 * chart.js's strict `ChartConfiguration<keyof ChartTypeRegistry, ...>` check.
 * 260829-gbs hoisted `buildConfig` to a real top-level declaration (removing
 * the $portals mount-scope bridge the null-let was ALSO incidentally
 * providing $portals for) — TypeScript now infers its return type
 * structurally, which widens the `type: 'line'` (or `type: $props.type`)
 * literal property to `string`, tripping `TS2345` on react/solid/vue/angular
 * (lit is unaffected — its `noImplicitAny: false` tsconfig does not surface
 * this one). The runtime value IS a valid `ChartConfiguration` — chart.js's
 * generic constraint is stricter than the plain-JS `.rozie` source can express
 * without emitter-level return-type synthesis (OUT OF SCOPE, SCOPE FENCE); as
 * the sanctioned in-scope per-leaf aid (the CodeMirror `themeExt(): any`
 * analog), annotate `buildConfig`'s return `: any` here — a pure type
 * annotation, zero runtime change. Applied to BOTH the generic Chart output
 * and all 8 per-type variants (each carries its own `buildConfig`).
 */
function applyBuildConfigTypeAid(code, target) {
  const TOKENS = {
    react: ['buildConfig = useCallback(() => {', 'buildConfig = useCallback((): any => {'],
    solid: ['function buildConfig() {', 'function buildConfig(): any {'],
    vue: ['const buildConfig = () => {', 'const buildConfig = (): any => {'],
    angular: ['buildConfig = () => {', 'buildConfig = (): any => {'],
  };
  const pair = TOKENS[target];
  if (!pair) return code; // lit/svelte: no aid needed today
  const [token, annotated] = pair;
  if (!code.includes(token)) {
    throw new Error(
      `codegen ${target}: expected to annotate \`buildConfig\`'s return \`: any\` (chart.js's ` +
        `ChartConfiguration<keyof ChartTypeRegistry, ...> rejects the widened \`type: string\` a ` +
        `plain-JS return infers) but the token \`${token}\` was not found — the ${target} emit shape ` +
        `changed. Re-derive the type-gate aid (SCOPE FENCE: do NOT edit the emitter).`,
    );
  }
  return code.replace(token, annotated);
}

/**
 * BUNDLED-LEAF PACKAGING (react/solid/lit only): keep `tsdown.config.ts`
 * `entry` and `package.json` `exports` in lockstep with the VARIANTS list so a
 * consumer can `import Line from '@rozie-ui/chartjs-<fw>/line'` and pull ONLY
 * Line's controller registration. Source-shipped leaves (vue/svelte/angular)
 * already tree-shake per-file and are NOT touched.
 *
 * These two config files are committed (not fully codegen-owned), so we PATCH
 * the two generated regions surgically and fail loud if their anchors drift —
 * the per-leaf `external`/deps stay author-owned.
 *
 * `sideEffects` is deliberately left UNDEFINED (status quo). Each variant
 * module has a real side effect (`ChartJS.register(...)`) and the react/solid
 * variants also `import './Chart.css'` / `'./Chart.global.css'`; the robust,
 * bundler-agnostic isolation guarantee is the per-variant SUBPATH (a consumer
 * importing `/line` only ever loads Line's chunk), not tree-shaking heuristics.
 */
function patchBundledLeafPackaging(dir) {
  const variantNames = VARIANTS.map((v) => v.name);
  const entryNames = ['Chart', ...variantNames]; // generic Chart + 8 typed variants

  // ── tsdown.config.ts: rewrite the `entry: [...]` array ────────────────────
  const tsdownPath = resolve(ROOT, 'packages', dir, 'tsdown.config.ts');
  const tsdown = readFileSync(tsdownPath, 'utf8');
  const ext = dir === 'lit' ? '.ts' : '.tsx'; // react/solid emit .tsx, lit .ts
  const entryRe = /entry:\s*\[[^\]]*\],/;
  if (!entryRe.test(tsdown)) {
    throw new Error(
      `codegen bundled-leaf ${dir}: tsdown.config.ts has no \`entry: [...]\` array to patch (config shape changed)`,
    );
  }
  // Per-variant + Chart files emit as their own chunks; barrel (index) + auto
  // stay entries so `.` and `/auto` keep working unchanged.
  const entryItems = [
    "'src/index.ts'",
    "'src/auto.ts'",
    ...entryNames.map((n) => `'src/${n}${ext}'`),
  ];
  const newTsdown = tsdown.replace(entryRe, `entry: [${entryItems.join(', ')}],`);
  if (newTsdown !== tsdown) writeFileSync(tsdownPath, newTsdown);

  // ── package.json: rebuild the `exports` map (., ./auto, + per-variant) ─────
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const exp = {
    '.': {
      types: './dist/index.d.mts',
      import: './dist/index.mjs',
      require: './dist/index.cjs',
    },
    './auto': {
      types: './dist/auto.d.mts',
      import: './dist/auto.mjs',
      require: './dist/auto.cjs',
    },
  };
  for (const name of variantNames) {
    exp[`./${kebab(name)}`] = {
      types: `./dist/${name}.d.mts`,
      import: `./dist/${name}.mjs`,
      require: `./dist/${name}.cjs`,
    };
  }
  pkg.exports = exp;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

/** One barrel line re-exporting a component (generic Chart or a variant). */
function barrelLine(name, cfg) {
  const path = `./${name}${cfg.ext}`;
  if (cfg.exportStyle === 'named') return `export { ${name} } from '${path}';`;
  let l = `export { default as ${name} } from '${path}';`;
  if (cfg.handle) l += `\nexport type { ${name}Handle } from '${path}';`;
  return l;
}

function compileClean(source, target, filename) {
  const r = compile(source, { target, filename });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) {
    throw new Error(
      `codegen ${target} (${filename}): compile emitted error diagnostics (SCOPE FENCE: do NOT edit any emitter — fix the codegen path):\n` +
        errs.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
    );
  }
  return r;
}

function main() {
  const source = readFileSync(SRC, 'utf8');

  // parse + lower ONCE for the doc tables.
  const { ast } = parse(source, { filename: FILENAME });
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

  // handle manifest lockstep with ir.expose (Phase 21).
  for (const m of ir.expose) {
    if (!handleManifest[m.name]) {
      throw new Error(
        `codegen: method "${m.name}" is exposed by the source but has no entry in handle-manifest.mjs`,
      );
    }
  }

  // Pre-build the variant sources once (target-independent).
  const variantSources = VARIANTS.map((v) => ({ ...v, source: makeVariantSource(source, v) }));

  // Materialize the per-type variant sources on disk as real `.rozie` files
  // (quick-task 260811-9qe). Until now `makeVariantSource` only built these
  // strings in memory — the six leaves' COMPILED per-target output
  // (Bar.tsx/Bar.vue/…) landed on disk, but the SOURCE never did, so nothing
  // could mount a per-type variant at runtime: no `.rozie` file existed for a
  // VR demo to import via `<components>`. Writing them here closes that gap —
  // the VR host can now compose `Bar`/`Doughnut`/etc. from
  // `src/variants/<Name>.rozie`, and because that file IS the exact string
  // `makeVariantSource` produces, mounting it is mounting what every leaf
  // compiles from — a runtime pass on the materialized variant is a runtime
  // pass on what ships.
  //
  // Write VERBATIM: no banner comment, no reformatting, no trailing-newline
  // normalization. Byte-identity is load-bearing twice over — (1) the demo-rig
  // guarantee above only holds if nothing diverges between the written file
  // and the `source` string codegen builds every leaf from, and (2) a leading
  // comment above the `<rozie>` element shifts source byte offsets, a known
  // emitter hazard (feedback_rozie_leading_comments) — so prepending a
  // generated-file banner here would force a leaf regeneration this task is
  // forbidden to make.
  //
  // These files are GENERATED — never hand-edit them.
  // `tests/generated-entries.test.ts` enforces the byte-identity against
  // `makeVariantSource` output, so a hand edit or accidental reformat goes red
  // immediately. The BUILD-ORDER CONTRACT in this file's header ("this writes
  // each leaf's src/*, so it MUST run before the bundled-leaf tsdown builds")
  // covers these files too.
  const variantsSrcDir = resolve(ROOT, 'src', 'variants');
  mkdirSync(variantsSrcDir, { recursive: true });
  for (const v of variantSources) {
    writeFileSync(resolve(variantsSrcDir, `${v.name}.rozie`), v.source);
  }

  // Lower each variant's IR once too (target-independent) — the IDE sidecars
  // (web-types.json / custom-elements.json) need per-component prop/emit/slot/
  // expose data for all 9 components, not just the generic Chart's `ir` above.
  const variantIRs = new Map(
    variantSources.map((v) => {
      const { ast: vAst } = parse(v.source, { filename: `${v.name}.rozie` });
      const { ir: vIr } = lowerToIR(vAst, { modifierRegistry: createDefaultRegistry() });
      return [v.name, vIr];
    }),
  );

  for (const [target, cfg] of Object.entries(TARGETS)) {
    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    // ── generic Chart ────────────────────────────────────────────────────────
    const r = compileClean(source, target, FILENAME);
    r.code = applyBuildConfigTypeAid(r.code, target);
    writeFileSync(resolve(leafSrc, cfg.file), r.code);
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'Chart.css'), r.css);
      // Chart.rozie's `:root { .rozie-chart .rozie-chart-tooltip { ... } }`
      // engine block (Phase 34 escape hatch) routes to r.globalCss and the
      // emitted .tsx carries an `import './Chart.global.css'` side effect. Write
      // the single shared sidecar whenever present so that import resolves; when
      // absent, rmSync any stale copy (the WR-03 sidecar-drift guard). The 8
      // per-type variants share the same style block, so they all rewrite their
      // own `<Name>.global.css` import to this one shared file below.
      const globalCssPath = resolve(leafSrc, 'Chart.global.css');
      if (r.globalCss) {
        writeFileSync(globalCssPath, r.globalCss);
      } else if (existsSync(globalCssPath)) {
        rmSync(globalCssPath);
      }
      if (r.types) writeFileSync(resolve(leafSrc, 'Chart.d.ts'), r.types);
    }

    // ── 8 per-type variants ──────────────────────────────────────────────────
    for (const v of variantSources) {
      const vr = compileClean(v.source, target, `${v.name}.rozie`);
      let code = applyBuildConfigTypeAid(vr.code, target);
      // React: every variant emits `import "./<Name>.css"`; rewrite to the single
      // shared `Chart.css` (the styles are identical) so we ship one stylesheet,
      // not nine. The tsdown css-external + copy handles `Chart.css` already.
      if (target === 'react') {
        // Rewrite both the scoped `<Name>.css` and the engine-DOM
        // `<Name>.global.css` (Phase 34 escape hatch) sidecar imports to the
        // single shared `Chart.css` / `Chart.global.css`. The `.global.css`
        // rewrite runs first so the more specific token is consumed before the
        // generic `.css` pass (the two forms don't overlap as substrings, but
        // keeping the specific-first order is the robust convention).
        code = code.replaceAll(`${v.name}.global.css`, 'Chart.global.css');
        code = code.replaceAll(`${v.name}.css`, 'Chart.css');
      }
      writeFileSync(resolve(leafSrc, cfg.vfile(v.name)), code);
    }

    // ── barrel (all 6 leaves now have one; source leaves gained it in 31-03) ──
    const lines = [];
    lines.push(barrelLine('Chart', cfg));
    if (cfg.exportStyle !== 'named') lines.push(`export { default } from './Chart${cfg.ext}';`);
    for (const v of variantSources) lines.push(barrelLine(v.name, cfg));
    writeFileSync(resolve(leafSrc, 'index.ts'), lines.join('\n') + '\n');

    // ── /auto entry: register the kitchen sink, then re-export the barrel ─────
    const auto =
      `import { Chart as ChartJS, registerables } from 'chart.js';\n` +
      `ChartJS.register(...registerables);\n` +
      `export * from './index';\n` +
      (cfg.exportStyle === 'named' ? '' : `export { default } from './index';\n`);
    writeFileSync(resolve(leafSrc, 'auto.ts'), auto);

    // README from the single IR parse (+ a per-type components note rendered by
    // readme.mjs from the VARIANTS list passed through).
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(
      target,
      ir,
      pkgName,
      handleManifest,
      VARIANTS.map((v) => v.name),
    );
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // JetBrains web-types sidecar for the Vue leaf (D-05) — emitted from the
    // SAME lowered IRs the READMEs use so it never drifts. PhpStorm/WebStorm
    // read this (NOT vue-tsc's `__VLS_` .d.ts, WEB-57769) for prop/event/slot
    // completion. The version is read from the leaf package.json AT
    // GENERATION TIME, so a version bump must be followed by a regen — see
    // tests/sidecars.test.ts, which turns the stale-sidecar failure mode
    // (commit 4a095fdd) into a red test instead of a silently re-dirtying
    // build. The Vue codegen does not otherwise rewrite the leaf
    // package.json, so wire the `web-types` field + `files` entry idempotently.
    //
    // MULTI-COMPONENT MERGE (see web-types.mjs header): buildWebTypes is
    // single-component by construction — call it once per component (Chart +
    // 8 variants, in VARIANTS order) and splice the nine `vue-components[0]`
    // entries into ONE document, keeping Chart's document as the base.
    if (target === 'vue') {
      const leafDir = resolve(ROOT, 'packages', cfg.dir);
      const vuePkgPath = resolve(leafDir, 'package.json');
      const vuePkg = JSON.parse(readFileSync(vuePkgPath, 'utf8'));
      const perComponent = [
        buildWebTypes({
          ir,
          pkgName: vuePkg.name,
          version: vuePkg.version,
          componentName: 'Chart',
          description: IDE_SIDECAR_DESCRIPTION_GENERIC,
          docUrl: IDE_SIDECAR_DOC_URL,
        }),
        ...VARIANTS.map((v) =>
          buildWebTypes({
            ir: variantIRs.get(v.name),
            pkgName: vuePkg.name,
            version: vuePkg.version,
            componentName: v.name,
            description: variantDescription(v),
            docUrl: IDE_SIDECAR_DOC_URL,
          }),
        ),
      ];
      const webTypesDoc = perComponent[0];
      webTypesDoc.contributions.html['vue-components'] = perComponent.map(
        (d) => d.contributions.html['vue-components'][0],
      );
      writeFileSync(
        resolve(leafDir, 'web-types.json'),
        `${JSON.stringify(webTypesDoc, null, 2)}\n`,
      );
      vuePkg['web-types'] = './web-types.json';
      if (!vuePkg.files.includes('web-types.json')) {
        vuePkg.files = [...vuePkg.files, 'web-types.json'];
      }
      writeFileSync(vuePkgPath, `${JSON.stringify(vuePkg, null, 2)}\n`);
    }

    // Lit leaf: emit a Custom Elements Manifest (`custom-elements.json`, D-05)
    // from the SAME lowered IRs + wire the leaf package.json (`customElements`
    // field + files entry). Both VS Code (lit-plugin) and JetBrains read it
    // for `<rozie-chart>`/`<rozie-line>`/…/`<rozie-bubble>`
    // attribute/property/event/slot completion. Wired idempotently — the Lit
    // codegen does not otherwise rewrite this manifest.
    //
    // MULTI-COMPONENT MODULE TOPOLOGY (see cem.mjs header): unlike rete's
    // merge-into-one-module shape, chartjs's tsdown build genuinely emits each
    // component as its own chunk (dist/Chart.mjs, dist/Line.mjs, …), so this
    // concatenates the nine single-module documents' `modules[]` arrays
    // instead of forcing them into one module.
    if (target === 'lit') {
      const leafDir = resolve(ROOT, 'packages', cfg.dir);
      const litPkgPath = resolve(leafDir, 'package.json');
      const litPkg = JSON.parse(readFileSync(litPkgPath, 'utf8'));
      const perComponent = [
        buildCustomElementsManifest({
          ir,
          componentName: 'Chart',
          description: IDE_SIDECAR_DESCRIPTION_GENERIC,
          modulePath: 'dist/Chart.mjs',
          handleManifest,
        }),
        ...VARIANTS.map((v) =>
          buildCustomElementsManifest({
            ir: variantIRs.get(v.name),
            componentName: v.name,
            description: variantDescription(v),
            modulePath: `dist/${v.name}.mjs`,
            handleManifest,
          }),
        ),
      ];
      const cemDoc = {
        schemaVersion: perComponent[0].schemaVersion,
        readme: '',
        modules: perComponent.flatMap((d) => d.modules),
      };
      writeFileSync(
        resolve(leafDir, 'custom-elements.json'),
        `${JSON.stringify(cemDoc, null, 2)}\n`,
      );
      litPkg.customElements = 'custom-elements.json';
      if (!litPkg.files.includes('custom-elements.json')) {
        litPkg.files = [...litPkg.files, 'custom-elements.json'];
      }
      writeFileSync(litPkgPath, `${JSON.stringify(litPkg, null, 2)}\n`);
    }

    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    // BUNDLED leaves (tsdown → dist/) get multi-entry chunking + per-variant
    // subpath exports so each typed component is an isolated, selectively-
    // importable chunk. Source-shipped leaves already tree-shake per-file.
    if (cfg.build === 'tsdown') patchBundledLeafPackaging(cfg.dir);

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(
      `codegen: ${target.padEnd(8)} → Chart + ${VARIANTS.length} variants + barrel + auto${sidecars}  ✓`,
    );
  }

  // ENFORCE docs props-table validation (VALIDATE-NOT-OVERWRITE).
  const guideRelPath = 'docs/components/chartjs.md';
  const guideExists = existsSync(resolve(REPO_ROOT, guideRelPath));
  const skipGuide = process.env.ROZIE_CHARTJS_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found. To emit before authoring it, run with ROZIE_CHARTJS_SKIP_GUIDE=1.`,
    );
  }
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  if (!guideExists) {
    console.log('codegen: docs props-table validation SKIPPED (ROZIE_CHARTJS_SKIP_GUIDE=1).');
  } else {
    const docs = readFileSync(guidePath, 'utf8');
    const result = validateDocsPropsTable(ir, docs);
    if (!result.ok) {
      throw new Error(
        `codegen: docs props-table validation DRIFT — fix ONLY the structural columns in ${guidePath} (preserve prose); do NOT weaken the validator:\n` +
          result.errors.map((e) => `  - ${e}`).join('\n'),
      );
    }
    console.log(
      `codegen: docs props-table validation PASS — ${result.checkedRows} rows match ir.props (ENFORCING)`,
    );
  }

  // ENFORCE docs events/handle name-presence (see ../../docs-surface-guard.mjs).
  validateDocsSurfaceNames(ir, 'chartjs', REPO_ROOT);

  console.log(
    `codegen: done — 6 leaves × (Chart + ${VARIANTS.length} variants), 6 barrels, 6 /auto entries, 6 READMEs, 6 LICENSEs.`,
  );
}

// Guarded entry point: `main()` writes files as a side effect, so it must only
// run when this script is EXECUTED (`node scripts/codegen.mjs`), never when it
// is IMPORTED — `tests/surface.test.ts` imports `VARIANTS`/`makeVariantSource`
// below to build the per-type variant IR the same way codegen does, and a bare
// `main()` call at module scope would make importing this file for that purpose
// silently regenerate every leaf as a test side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Exported for tests/surface.test.ts (the per-type variant transform + list is
// otherwise only reachable by re-deriving it — this is the SAME source codegen
// uses for the barrels, the deep-import subpaths, and the IDE sidecars, so the
// test can never drift from what actually ships).
export { VARIANTS, TARGETS, makeVariantSource };
