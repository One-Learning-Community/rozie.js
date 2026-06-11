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
  vue: { dir: 'vue', file: 'Flatpickr.vue', build: 'source' },
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
    writeFileSync(resolve(leafSrc, cfg.file), r.code);

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
