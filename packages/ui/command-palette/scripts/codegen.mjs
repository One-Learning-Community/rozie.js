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
 *   - src/internal/ (scoreCommands.ts — the fuzzy scoring/ranking + highlighting
 *     core; *.test.ts excluded)
 * into each leaf so consumers can `import '@rozie-ui/command-palette-<fw>/themes/X.css'`
 * and the compiled component's relative `./internal/scoreCommands` import resolves.
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
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse, ProducerResolver } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/command-palette
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const FILENAME = 'CommandPalette.rozie';

// Phase 75 (Option A — published-package composition, D-05/D-06/D-07):
// command-palette composes the shipped @rozie-ui/combobox primitive by
// resolving the authored STABLE package-style `<components>` specifier
// `@rozie-ui/combobox/Combobox.rozie` to the PUBLISHED per-target
// `@rozie-ui/combobox-<target>` package's compiled manifest, via @rozie/core's
// compiler-level resolver (resolveManifestProducer, Plan 02) — found through
// command-palette's own installed devDependency on that package (Plan 05).
// There is no vendored `.rozie` sibling and no in-memory specifier remap:
// CommandPalette is the ONLY component this codegen compiles. The published
// combobox package resolves at compile-time for scoped-slot type threading +
// r-model two-way validation, and is a runtime peerDependency of every
// command-palette leaf (Task 3, D-11/D-12).
const PARENT = 'CommandPalette';
const COMPONENTS = [PARENT];

/** Per-target leaf dir + emitted file extension (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', ext: 'tsx', build: 'tsdown' },
  vue: { dir: 'vue', ext: 'vue', build: 'source' },
  svelte: { dir: 'svelte', ext: 'svelte', build: 'source' },
  angular: { dir: 'angular', ext: 'ts', build: 'source' },
  solid: { dir: 'solid', ext: 'tsx', build: 'tsdown' },
  lit: { dir: 'lit', ext: 'ts', build: 'tsdown' },
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

/**
 * Vendor src/internal/ → leaf src/internal/ (excluding *.test.ts).
 *
 * The destination is removed first so a rename in src/internal/ (e.g.
 * filterCommands.ts → scoreCommands.ts) doesn't leave the OLD, no-longer-
 * imported file behind as stale generated output — cpSync merges into an
 * existing directory rather than mirroring it, so without this the leaf
 * would silently accumulate orphaned modules across regens.
 */
function copyInternal(leafSrc) {
  const src = resolve(ROOT, 'src/internal');
  if (!existsSync(src)) return;
  const dest = resolve(leafSrc, 'internal');
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (from) => !from.endsWith('.test.ts'),
  });
}

function main() {
  // Read the (single) component source. CommandPalette is the only component
  // this codegen compiles under Option A — no vendored sibling to read.
  const sources = Object.fromEntries(
    COMPONENTS.map((name) => [name, readFileSync(resolve(ROOT, 'src', `${name}.rozie`), 'utf8')]),
  );

  // Phase 75 (Option A): a per-compiler-instance resolver, rooted at this
  // package (ROOT), reused across the doc-table lowerToIR() call and every
  // per-target compile() below — the established `resolverRoot`/`resolver`
  // option shape (packages/ui/headless-core/scripts/compile-headless-core-check.mjs,
  // packages/ui/data-table/scripts/probe-48-00.mjs). `resolverRoot`/
  // `ResolverOptions.root` feeds ONLY the tsconfig-paths matcher — the
  // published `@rozie-ui/combobox-<target>` package itself is found by
  // walking node_modules upward from dirname(fromFile) (command-palette/src),
  // which resolves because Plan 05 declared it as a devDependency of this
  // package's ROOT, so pnpm symlinks it into command-palette/node_modules.
  const resolver = new ProducerResolver({ root: ROOT });

  // (1) parse + lower the PARENT ONCE for the doc tables + manifests. The
  // RAW authored source (no specifier remap) — the stable
  // `@rozie-ui/combobox/Combobox.rozie` specifier now resolves to the
  // published per-target manifest via Plan 02's resolveManifestProducer.
  const { ast } = parse(sources[PARENT], { filename: resolve(ROOT, 'src', `${PARENT}.rozie`) });
  const { ir } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
    filename: resolve(ROOT, 'src', `${PARENT}.rozie`),
    resolver,
  });

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

  // (2)(3)(4) per-target emit + vendor themes/internal + README.
  for (const [target, cfg] of Object.entries(TARGETS)) {
    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    // Compile CommandPalette (the only component this codegen compiles under
    // Option A) into this leaf. The SCOPE FENCE throw is applied to the
    // compile. The published `@rozie-ui/combobox-<target>` package resolves
    // via the same `resolver` instance's node_modules walk (D-10) — no
    // vendored sibling, no in-memory specifier remap.
    for (const componentName of COMPONENTS) {
      const filename = resolve(ROOT, 'src', `${componentName}.rozie`);
      const r = compile(sources[componentName], { target, filename, resolverRoot: ROOT, resolver });
      const errs = r.diagnostics.filter((d) => d.severity === 'error');
      if (errs.length) {
        throw new Error(
          `codegen ${target} ${componentName}: compile emitted error diagnostics (SCOPE FENCE: do NOT edit any emitter — fix the codegen path):\n` +
            errs.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
        );
      }

      writeFileSync(resolve(leafSrc, `${componentName}.${cfg.ext}`), r.code);

      // React-only sidecars, PER COMPONENT (data-table:199-208 shape). Both
      // CommandPalette.css/.d.ts AND Combobox.css/.d.ts are emitted.
      if (target === 'react') {
        if (r.css) writeFileSync(resolve(leafSrc, `${componentName}.css`), r.css);
        const globalCssPath = resolve(leafSrc, `${componentName}.global.css`);
        if (r.globalCss) {
          writeFileSync(globalCssPath, r.globalCss);
        } else if (existsSync(globalCssPath)) {
          rmSync(globalCssPath);
        }
        if (r.types) writeFileSync(resolve(leafSrc, `${componentName}.d.ts`), r.types);
      }
    }

    // Bundled leaves (tsdown) entry on src/index.ts. CommandPalette is the ONLY
    // default/named export — the published Combobox primitive is composed via
    // the runtime peerDependency (Task 3) and is NOT re-exported (consumers use
    // @rozie-ui/combobox-<target> directly). React/Solid also emit a named
    // `CommandPaletteHandle` interface (the `$expose` handle), forwarded verbatim.
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
    const files = COMPONENTS.map((n) => `${n}.${cfg.ext}`).join(', ');
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/{${files}}${sidecars}  ✓ (+ themes/ + internal/)`);
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
