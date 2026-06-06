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
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

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
  react: { dir: 'react', file: 'Chart.tsx', vfile: (n) => `${n}.tsx`, build: 'tsdown', ext: '', exportStyle: 'default', handle: true },
  vue: { dir: 'vue', file: 'Chart.vue', vfile: (n) => `${n}.vue`, build: 'source', ext: '.vue', exportStyle: 'default', handle: false },
  svelte: { dir: 'svelte', file: 'Chart.svelte', vfile: (n) => `${n}.svelte`, build: 'source', ext: '.svelte', exportStyle: 'default', handle: false },
  angular: { dir: 'angular', file: 'Chart.ts', vfile: (n) => `${n}.ts`, build: 'source', ext: '', exportStyle: 'named', handle: false },
  solid: { dir: 'solid', file: 'Chart.tsx', vfile: (n) => `${n}.tsx`, build: 'tsdown', ext: '', exportStyle: 'default', handle: true },
  lit: { dir: 'lit', file: 'Chart.ts', vfile: (n) => `${n}.ts`, build: 'tsdown', ext: '', exportStyle: 'default', handle: false },
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
  { name: 'Line', type: 'line', reg: ['LineController', 'LineElement', 'PointElement', 'LinearScale', 'CategoryScale', 'Filler'] },
  { name: 'Bar', type: 'bar', reg: ['BarController', 'BarElement', 'LinearScale', 'CategoryScale'] },
  { name: 'Pie', type: 'pie', reg: ['PieController', 'ArcElement'] },
  { name: 'Doughnut', type: 'doughnut', reg: ['DoughnutController', 'ArcElement'] },
  { name: 'PolarArea', type: 'polarArea', reg: ['PolarAreaController', 'ArcElement', 'RadialLinearScale'] },
  { name: 'Radar', type: 'radar', reg: ['RadarController', 'LineElement', 'PointElement', 'RadialLinearScale', 'Filler'] },
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
    if (!cond) throw new Error(`codegen variant ${variant.name}: transform guard failed — ${msg} (Chart.rozie source shape changed; re-derive the transform)`);
  };
  let s = src;

  // (a) rename the component
  guard(s.includes('<rozie name="Chart"'), 'no `<rozie name="Chart"`');
  s = s.replace('<rozie name="Chart"', `<rozie name="${variant.name}"`);

  // (b) remove the `type` prop declaration
  const typePropRe = /\n\s*type:\s*\{ type: String,\s*default: 'line' \},/;
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
      throw new Error(`codegen: method "${m.name}" is exposed by the source but has no entry in handle-manifest.mjs`);
    }
  }

  // Pre-build the variant sources once (target-independent).
  const variantSources = VARIANTS.map((v) => ({ ...v, source: makeVariantSource(source, v) }));

  for (const [target, cfg] of Object.entries(TARGETS)) {
    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    // ── generic Chart ────────────────────────────────────────────────────────
    const r = compileClean(source, target, FILENAME);
    writeFileSync(resolve(leafSrc, cfg.file), r.code);
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'Chart.css'), r.css);
      if (r.types) writeFileSync(resolve(leafSrc, 'Chart.d.ts'), r.types);
    }

    // ── 8 per-type variants ──────────────────────────────────────────────────
    for (const v of variantSources) {
      const vr = compileClean(v.source, target, `${v.name}.rozie`);
      let code = vr.code;
      // React: every variant emits `import "./<Name>.css"`; rewrite to the single
      // shared `Chart.css` (the styles are identical) so we ship one stylesheet,
      // not nine. The tsdown css-external + copy handles `Chart.css` already.
      if (target === 'react') {
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
    const readme = renderReadme(target, ir, pkgName, handleManifest, VARIANTS.map((v) => v.name));
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → Chart + ${VARIANTS.length} variants + barrel + auto${sidecars}  ✓`);
  }

  // ENFORCE docs props-table validation (VALIDATE-NOT-OVERWRITE).
  const guideRelPath = 'docs/guide/chartjs.md';
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
    console.log(`codegen: docs props-table validation PASS — ${result.checkedRows} rows match ir.props (ENFORCING)`);
  }

  console.log(`codegen: done — 6 leaves × (Chart + ${VARIANTS.length} variants), 6 barrels, 6 /auto entries, 6 READMEs, 6 LICENSEs.`);
}

main();
