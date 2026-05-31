/**
 * codegen.mjs — the single parse-once → emit-6 → copy-internal → render-READMEs
 * engine for @rozie-ui/sortable-list.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive docs/.vitepress/rozie-codegen.ts
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as rozie-codegen.ts + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * BUILD-ORDER CONTRACT (from 20-01): this script writes each leaf's
 * src/SortableList.* + src/internal/, so it MUST run before the bundled-leaf
 * tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/SortableList.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write SortableList.module.css + SortableList.d.ts)
 *   4. copy src/internal/ → each leaf src/internal/ (excluding *.test.ts)
 *   5. render each leaf README from the IR + the hand-kept event manifest
 *   6. ENFORCE validateDocsPropsTable against docs/guide/sortable-list.md
 *      (THROWS on drift of the IR-derivable structural columns — prop name,
 *      type, default — but NEVER rewrites the hand-authored prose; Plan 20-04)
 */
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/sortable-list
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/SortableList.rozie');
const FILENAME = 'SortableList.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'SortableList.tsx', build: 'tsdown' },
  vue: { dir: 'vue', file: 'SortableList.vue', build: 'source' },
  svelte: { dir: 'svelte', file: 'SortableList.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'SortableList.ts', build: 'source' },
  solid: { dir: 'solid', file: 'SortableList.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'SortableList.ts', build: 'tsdown' },
};

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.name;
}

/** Copy src/internal/ → leaf src/internal/, excluding any *.test.ts. */
function copyInternal(leafSrc) {
  const src = resolve(ROOT, 'src/internal');
  const dest = resolve(leafSrc, 'internal');
  cpSync(src, dest, {
    recursive: true,
    filter: (from) => !from.endsWith('.test.ts'),
  });
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

  // (3)(4)(5) per-target emit + vendor + README.
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

    // Bundled leaves (tsdown) entry on src/index.ts. The emitted component is
    // a DEFAULT export (`export default function|class SortableList`), so the
    // barrel must re-export the default under the named `SortableList` the
    // READMEs/consumers import. `export *` would NOT forward a default — that
    // is why the 20-01 stub barrel produced an empty bundle. Regenerating the
    // barrel here keeps it in lockstep with the emitted export shape.
    if (cfg.build === 'tsdown') {
      writeFileSync(
        resolve(leafSrc, 'index.ts'),
        `export { default as SortableList } from './SortableList';\nexport { default } from './SortableList';\n`,
      );
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'SortableList.module.css'), r.css);
      if (r.types) writeFileSync(resolve(leafSrc, 'SortableList.d.ts'), r.types);
    }

    // (4) vendor the helper (relative ./internal/useSortableJS resolves verbatim).
    copyInternal(leafSrc);

    // (5) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, eventManifest, pkgName);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    const sidecars = target === 'react' ? ' (+ .module.css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓`);
  }

  // (6) ENFORCE docs props-table validation (Plan 20-04): the IR-derivable
  // structural columns (prop name + type + default) in docs/guide/sortable-list.md
  // MUST match ir.props or this script THROWS. It does NOT overwrite the
  // hand-authored prose (the Runtime-updatable? column + Descriptions stay) —
  // VALIDATE-NOT-OVERWRITE (OQ2). The docs file is the single-source-of-truth
  // surface for the structural columns; reconcile the table (not the validator)
  // if it drifts.
  const docsPath = resolve(REPO_ROOT, 'docs/guide/sortable-list.md');
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

  console.log('codegen: done — 6 targets emitted, internal/ vendored, 6 READMEs rendered.');
}

main();
