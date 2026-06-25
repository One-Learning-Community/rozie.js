/**
 * codegen.mjs — the single parse-once → emit-6 → copy-themes → vendor-internal →
 * render-READMEs engine for @rozie-ui/command-palette.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry). NO compiler/emitter/IR change. If a compile() call
 * emits an error-severity diagnostic this script THROWS (the scope fence: an
 * error means a mis-wired codegen path, never an emitter edit).
 *
 * NOTE: the `focus` $expose verb DELIBERATELY overrides the inherited
 * `HTMLElement.focus` on the Lit custom element, so each target emits one
 * ROZ137 WARNING. ROZ137 is warn-only — the severity filter below keeps only
 * `error`-severity diagnostics, so it does NOT throw codegen.
 *
 * This pure-Rozie family vendors BOTH:
 *   - src/themes/ (base / shadcn / material / bootstrap design-token presets)
 *   - src/internal/ (filterCommands.ts — the query filter; *.test.ts excluded)
 * into each leaf so consumers can `import '@rozie-ui/command-palette-<fw>/themes/X.css'`
 * and the compiled component's relative `./internal/filterCommands` import resolves.
 *
 * Steps:
 *   1. read src/CommandPalette.rozie
 *   2. parse() + lowerToIR() ONCE → ir for docs tables + manifest cross-checks
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write CommandPalette.css + CommandPalette.d.ts)
 *   4. copy src/themes/ + src/internal/ → each leaf src/
 *   5. render each leaf README from the IR + the hand-kept event/handle manifests
 *   6. ENFORCE validateDocsPropsTable against docs/components/command-palette.md
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/command-palette
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/CommandPalette.rozie');
const FILENAME = 'CommandPalette.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'CommandPalette.tsx', build: 'tsdown' },
  vue: { dir: 'vue', file: 'CommandPalette.vue', build: 'source' },
  svelte: { dir: 'svelte', file: 'CommandPalette.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'CommandPalette.ts', build: 'source' },
  solid: { dir: 'solid', file: 'CommandPalette.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'CommandPalette.ts', build: 'tsdown' },
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

/** Vendor src/internal/ → leaf src/internal/ (excluding *.test.ts). */
function copyInternal(leafSrc) {
  const src = resolve(ROOT, 'src/internal');
  if (!existsSync(src)) return;
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

  // (3)(4)(5) per-target emit + vendor themes/internal + README.
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
    // `CommandPalette`. React/Solid also emit a named `CommandPaletteHandle`
    // interface (the `$expose` handle), forwarded verbatim.
    if (cfg.build === 'tsdown') {
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as CommandPalette } from './CommandPalette';\n` +
            `export { default } from './CommandPalette';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { CommandPaletteHandle } from './CommandPalette';\n`
          : `export { default as CommandPalette } from './CommandPalette';\nexport { default } from './CommandPalette';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'CommandPalette.css'), r.css);
      if (r.types) writeFileSync(resolve(leafSrc, 'CommandPalette.d.ts'), r.types);
    }

    // (4) vendor the design-token presets + the internal filter helper.
    copyThemes(leafSrc);
    copyInternal(leafSrc);

    // (5) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, eventManifest, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // (5b) Vendor the repo LICENSE into each published leaf.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓ (+ themes/ + internal/)`);
  }

  // (6) ENFORCE docs props-table validation against the API reference page
  // (command-palette-api.md carries the `rozie-props CommandPalette` fence — the
  // single-source-of-truth props table, regenerated from this same ir at the
  // vitepress build; the validator short-circuits to a pass on the fence).
  const docsPath = resolve(REPO_ROOT, 'docs/components/command-palette-api.md');
  if (!existsSync(docsPath)) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${docsPath} not found (the API docs page is the single-source-of-truth surface and must exist)`,
    );
  }
  const docs = readFileSync(docsPath, 'utf8');
  const result = validateDocsPropsTable(ir, docs);
  if (!result.ok) {
    throw new Error(
      `codegen: docs props-table validation DRIFT — the IR-derivable structural columns in ${docsPath} ` +
        `do not match ir.props. Fix ONLY the structural columns in the docs table (preserve the ` +
        `Two-way + Description prose); do NOT weaken this validator:\n` +
        result.errors.map((e) => `  - ${e}`).join('\n'),
    );
  }
  console.log(
    `codegen: docs props-table validation PASS — ${result.checkedRows} rows match ir.props (ENFORCING; throws on drift)`,
  );

  console.log('codegen: done — 6 targets emitted, themes + internal vendored, 6 READMEs rendered.');
}

main();
