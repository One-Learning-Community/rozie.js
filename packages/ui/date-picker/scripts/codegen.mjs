/**
 * codegen.mjs — the single parse-once → emit-6 → copy-internal+themes →
 * render-READMEs engine for @rozie-ui/date-picker.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive docs/.vitepress/rozie-codegen.ts
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as rozie-codegen.ts + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * NOTE: the date-picker's `focus` $expose verb DELIBERATELY overrides the
 * inherited `HTMLElement.focus` on the Lit custom element, so each target emits
 * exactly one ROZ137 WARNING. ROZ137 is warn-only — the severity filter below
 * keeps only `error`-severity diagnostics, so the deliberate `focus` override
 * does NOT throw codegen (the otp/slider precedent).
 *
 * This is a pure-Rozie family with NO third-party vanilla engine. The branchy
 * calendar-grid algorithm lives in `src/internal/buildMonthGrid.ts`, imported by
 * the `.rozie` `<script>` and vendored (via copyInternal, excluding `*.test.ts`)
 * into every leaf so the relative `./internal/buildMonthGrid` specifier resolves
 * verbatim. It ALSO vendors the `src/themes/` design-token presets (base /
 * shadcn / material / bootstrap) into each leaf so consumers can
 * `import '@rozie-ui/date-picker-<fw>/themes/X.css'`.
 *
 * Steps:
 *   1. read src/DatePicker.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write DatePicker.css + DatePicker.d.ts)
 *   4. copy src/internal/ + src/themes/ → each leaf src/
 *   5. render each leaf README from the IR + the hand-kept event/handle manifests
 *   6. ENFORCE validateDocsPropsTable against docs/components/date-picker-api.md
 *      (its `## Props` is a `rozie-props DatePicker` fence regenerated at the
 *      docs build, so the validator short-circuits to a pass; the structural
 *      throw-on-drift path stays available for a hand-authored table)
 *
 * The Vue leaf is dual-packaged (compiled dist/index.mjs + raw ./source) via a
 * committed vite.config.ts / tsconfig.json / src/index.ts; codegen only writes
 * its src/DatePicker.vue + internal + themes + README (it never cleans the leaf
 * src, so the committed barrel survives).
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/date-picker
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/DatePicker.rozie');
const FILENAME = 'DatePicker.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'DatePicker.tsx', build: 'tsdown' },
  vue: { dir: 'vue', file: 'DatePicker.vue', build: 'source' },
  svelte: { dir: 'svelte', file: 'DatePicker.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'DatePicker.ts', build: 'source' },
  solid: { dir: 'solid', file: 'DatePicker.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'DatePicker.ts', build: 'tsdown' },
};

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

/** Copy src/internal/ → leaf src/internal/, excluding any *.test.ts. */
function copyInternal(leafSrc) {
  const src = resolve(ROOT, 'src/internal');
  if (!existsSync(src)) throw new Error('codegen: src/internal/ not found (the calendar-grid algorithm must exist)');
  cpSync(src, resolve(leafSrc, 'internal'), {
    recursive: true,
    filter: (from) => !from.endsWith('.test.ts'),
  });
}

function main() {
  const source = readFileSync(SRC, 'utf8');

  // (2) parse + lower ONCE for the doc tables.
  const { ast } = parse(source, { filename: FILENAME });
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

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

  // (3)(4)(5) per-target emit + vendor internal+themes + README.
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

    // Bundled leaves (tsdown) entry on src/index.ts. The emitted component is a
    // DEFAULT export, so the barrel re-exports the default under the named
    // `DatePicker` the READMEs/consumers import (`export *` would NOT forward a
    // default). React/Solid also emit a named `DatePickerHandle` interface (the
    // `$expose` handle), forwarded verbatim; Lit's handle IS the element.
    if (cfg.build === 'tsdown') {
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as DatePicker } from './DatePicker';\n` +
            `export { default } from './DatePicker';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { DatePickerHandle } from './DatePicker';\n`
          : `export { default as DatePicker } from './DatePicker';\nexport { default } from './DatePicker';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'DatePicker.css'), r.css);
      if (r.types) writeFileSync(resolve(leafSrc, 'DatePicker.d.ts'), r.types);
    }

    // (4) vendor the algorithm + the design-token presets.
    copyInternal(leafSrc);
    copyThemes(leafSrc);

    // (5) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, eventManifest, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // (5b) Vendor the repo LICENSE into each published leaf.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓ (+ internal/ + themes/)`);
  }

  // (6) ENFORCE docs props-table validation against the API reference page. Its
  // `## Props` is a `rozie-props DatePicker` fence (regenerated from the SAME ir
  // at the docs build), so validateDocsPropsTable short-circuits to a pass — no
  // hand-authored table to keep in sync, no resolver entry duplicated here.
  const docsPath = resolve(REPO_ROOT, 'docs/components/date-picker-api.md');
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

  console.log('codegen: done — 6 targets emitted, internal + themes vendored, 6 READMEs rendered.');
}

main();
