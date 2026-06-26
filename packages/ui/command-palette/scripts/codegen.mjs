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
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/command-palette
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const LISTBOX_ROOT = resolve(REPO_ROOT, 'packages/ui/listbox'); // canonical primitive home (D-01)
const FILENAME = 'CommandPalette.rozie';

// MULTI-COMPONENT (the data-table precedent, Phase 999.4): command-palette
// composes the shipped <Listbox> primitive by VENDORING its `.rozie` source into
// this family's src/ (D-03) and compiling it as a per-leaf sibling alongside the
// parent. CommandPalette MUST be FIRST — it owns the handle-manifest +
// docs-table validation gates. The vendored Listbox is an INTERNAL implementation
// detail (NOT publicly re-exported — consumers use @rozie-ui/listbox directly).
const PARENT = 'CommandPalette';
const COMPONENTS = [PARENT, 'Listbox'];

// D-07 (LOAD-BEARING): the authored CommandPalette.rozie writes a STABLE
// package-style `<components>` specifier `@rozie-ui/listbox/Listbox.rozie`. Under
// Option B (vendored) the codegen rewrites that specifier to the local sibling
// `./Listbox.rozie` BEFORE compile() so threadParamTypes resolves the vendored
// copy on disk; the existing rewriteRozieImport then swaps `.rozie`→per-target
// ext. The authored file is NEVER edited — only this in-memory string is — so it
// stays byte-identical between B and a future Option A (only this remap + the
// D-04 drift guard are B-specific, the deletable plumbing).
const STABLE_LISTBOX_SPECIFIER = '@rozie-ui/listbox/Listbox.rozie';
const LOCAL_LISTBOX_SPECIFIER = './Listbox.rozie';

// D-03: the GENERATED banner prepended to the vendored copy. It sits OUTSIDE the
// `<rozie>` envelope (a leading HTML comment is tolerated — CommandPalette.rozie
// itself opens with one), so the D-04 drift guard hashes only the
// `<rozie>…</rozie>` envelope span and ignores this banner.
const BANNER =
  `<!-- GENERATED — do not edit. Vendored from @rozie-ui/listbox by codegen.\n` +
  `     Re-run \`pnpm --filter @rozie-ui/command-palette codegen\` to refresh.\n` +
  `     Drift between this copy and the canonical source FAILS CI (D-04 guard). -->\n`;

/**
 * D-03 / D-01 / D-07 — vendor the canonical listbox primitive `.rozie` into this
 * composite's src/ as a GENERATED, committed, overwrite-on-codegen sibling.
 *
 * ORDERING HAZARD (RESEARCH Pitfall 2): this MUST run in main() BEFORE any source
 * is read and BEFORE the compile loop. The vendored `./Listbox.rozie` is a compile
 * INPUT — threadParamTypes' producer resolution reads it on disk for slot-type
 * threading and degrades to `null` SILENTLY (untyped slot params, green-but-wrong
 * codegen) if the file is missing at compile time. Contrast copyThemes/copyInternal
 * which run AFTER write because they are leaf assets, not compile inputs.
 */
function vendorPrimitives() {
  const canonical = resolve(LISTBOX_ROOT, 'src/Listbox.rozie');
  const dest = resolve(ROOT, 'src/Listbox.rozie');
  writeFileSync(dest, BANNER + readFileSync(canonical, 'utf8'));
}

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
  // (1) D-03/D-07 ORDERING HAZARD: vendor the canonical Listbox primitive into
  // this composite's src/ FIRST — before any source is read, before parse/lower,
  // before the compile loop. The vendored `./Listbox.rozie` is a compile INPUT
  // (RESEARCH Pitfall 2).
  vendorPrimitives();

  // Read every component source once, keyed by component name (data-table shape).
  const sources = Object.fromEntries(
    COMPONENTS.map((name) => [name, readFileSync(resolve(ROOT, 'src', `${name}.rozie`), 'utf8')]),
  );

  // D-07: pre-compile remap of the CommandPalette source's stable `<components>`
  // specifier → the local vendored sibling, so threadParamTypes resolves the copy
  // on disk. The authored file is untouched; only this in-memory string changes.
  const composedSource = sources[PARENT].replaceAll(STABLE_LISTBOX_SPECIFIER, LOCAL_LISTBOX_SPECIFIER);

  // (2) parse + lower the PARENT ONCE for the doc tables + manifests. Use the
  // composed (remapped) source so the IR's <components> resolves the local sibling.
  const { ast } = parse(composedSource, { filename: resolve(ROOT, 'src', `${PARENT}.rozie`) });
  const { ir } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
    filename: resolve(ROOT, 'src', `${PARENT}.rozie`),
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

  // (3)(4)(5) per-target emit + vendor themes/internal + README.
  for (const [target, cfg] of Object.entries(TARGETS)) {
    const leafSrc = resolve(ROOT, 'packages', cfg.dir, 'src');
    mkdirSync(leafSrc, { recursive: true });

    // Compile each sibling component into this leaf. The SCOPE FENCE throw is
    // applied to EACH compile. The CommandPalette parent compiles from the D-07
    // composed (specifier-remapped) source; the vendored Listbox sibling compiles
    // from its verbatim vendored source. The ABSOLUTE host path keeps the two
    // .rozie collision-safe via scopeHash basename-keying.
    for (const componentName of COMPONENTS) {
      const filename = resolve(ROOT, 'src', `${componentName}.rozie`);
      const componentSource = componentName === PARENT ? composedSource : sources[componentName];
      const r = compile(componentSource, { target, filename });
      const errs = r.diagnostics.filter((d) => d.severity === 'error');
      if (errs.length) {
        throw new Error(
          `codegen ${target} ${componentName}: compile emitted error diagnostics (SCOPE FENCE: do NOT edit any emitter — fix the codegen path):\n` +
            errs.map((e) => `  ${e.code}: ${e.message}`).join('\n'),
        );
      }

      // D-07 (Option B, codegen-local plumbing — NOT an emitter edit): the Lit
      // emitter emits a vendored-sibling composition import as a verbatim
      // side-effect `import './Listbox.rozie';` (it registers the @customElement;
      // resolved by the rozie unplugin in the consumer-coexist flow). A
      // pre-compiled leaf package, however, is bundled standalone by tsdown
      // (entry src/index.ts, bundler resolution) with no unplugin and no
      // `.rozie` on disk — only the compiled sibling `Listbox.ts` — so the raw
      // `.rozie` specifier is UNRESOLVED. Rewrite it to the extensionless sibling
      // form (`./Listbox`), exactly what rewriteRozieImport(·,'lit') yields and
      // what the react/solid/angular leaves already import. Lit-only; the bare
      // side-effect form is unique to Lit composition, so this never touches
      // binding imports or the canonical/consumer `.rozie` contract.
      const code =
        target === 'lit'
          ? r.code.replace(/import '\.\/([A-Za-z0-9_]+)\.rozie';/g, "import './$1';")
          : r.code;

      writeFileSync(resolve(leafSrc, `${componentName}.${cfg.ext}`), code);

      // React-only sidecars, PER COMPONENT (data-table:199-208 shape). Both
      // CommandPalette.css/.d.ts AND Listbox.css/.d.ts are emitted.
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
    // default/named export — the vendored Listbox is an INTERNAL implementation
    // detail and is NOT re-exported (consumers use @rozie-ui/listbox directly;
    // RESEARCH Pattern 1 / Anti-Patterns). React/Solid also emit a named
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
