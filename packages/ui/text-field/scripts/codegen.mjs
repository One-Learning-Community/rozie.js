/**
 * codegen.mjs — the single parse-once → emit-6 → copy-themes → render-READMEs
 * engine for @rozie-ui/text-field.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive docs/.vitepress/rozie-codegen.ts
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as rozie-codegen.ts + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * NOTE: the `focus` $expose verb DELIBERATELY overrides the inherited
 * `HTMLElement.focus` on the Lit custom element, so the Lit target emits one
 * ROZ137 WARNING. ROZ137 is warn-only — the severity filter below keeps only
 * `error`-severity diagnostics (the otp / number-field precedent).
 *
 * This is a pure-Rozie family with NO third-party engine. The textarea autosize
 * measurement lives in `src/internal/autosize.ts` (unit-tested; vendored into
 * every leaf, excluding `*.test.ts`), and the `src/themes/` design-token presets
 * are vendored so consumers can `import '@rozie-ui/text-field-<fw>/themes/X.css'`.
 *
 * Steps:
 *   1. read src/TextField.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write TextField.css + TextField.d.ts)
 *   4. copy src/internal/ → each leaf src/internal/ (excluding *.test.ts)
 *   5. copy src/themes/ → each leaf src/themes/
 *   6. render each leaf README from the IR + the hand-kept event/handle manifests
 *   7. ENFORCE validateDocsPropsTable against docs/components/text-field.md
 *      (THROWS on drift of the IR-derivable structural columns — prop name,
 *      type, default — but NEVER rewrites the hand-authored prose)
 *   8. ENFORCE validateDocsSurfaceNames — every emitted event / exposed handle
 *      name must appear backticked in the docs page(s) (../../docs-surface-guard.mjs)
 *
 * The Vue leaf is dual-packaged (compiled dist/index.mjs + raw ./source) via a
 * committed vite.config.ts / tsconfig.json / src/index.ts; codegen only writes
 * its src/TextField.vue + themes + README (it never cleans the leaf src, so the
 * committed barrel survives).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { validateDocsSurfaceNames } from '../../docs-surface-guard.mjs';
import { typedSurfaceBarrelLines } from '../../typed-surface-barrel.mjs';
import { eventManifest } from './event-manifest.mjs';
import { handleManifest } from './handle-manifest.mjs';
import { buildCustomElementsManifest } from './cem.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';
import { buildWebTypes } from './web-types.mjs';

// JetBrains web-types (Vue leaf) + Custom Elements Manifest (Lit leaf) sidecar
// prose (D-05, ported from the wavesurfer precedent). PhpStorm/WebStorm read
// `web-types` — NOT vue-tsc's `__VLS_` .d.ts (WEB-57769) — for prop/event/model
// completion; VS Code (lit-plugin) AND JetBrains both read the CEM for
// `<rozie-text-field>` completion.
const IDE_SIDECAR_DESCRIPTION =
  'Accessible text field and textarea: label, description and error wired through `for` / `aria-describedby` / `aria-invalid`, a two-way `modelValue` binding (Angular ControlValueAccessor), a character counter and opt-in autosize.';
const IDE_SIDECAR_DOC_URL = 'https://github.com/One-Learning-Community/rozie.js#readme';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/text-field
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/TextField.rozie');
const FILENAME = 'TextField.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'TextField.tsx', build: 'tsdown' },
  vue: { dir: 'vue', file: 'TextField.vue', build: 'source' },
  svelte: { dir: 'svelte', file: 'TextField.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'TextField.ts', build: 'source' },
  solid: { dir: 'solid', file: 'TextField.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'TextField.ts', build: 'tsdown' },
};

function leafPkgName(dir) {
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.name;
}

/** Copy src/internal/ → leaf src/internal/, excluding any *.test.ts. */
function copyInternal(leafSrc) {
  const src = resolve(ROOT, 'src/internal');
  if (!existsSync(src))
    throw new Error('codegen: src/internal/ not found (the autosize helper must exist)');
  cpSync(src, resolve(leafSrc, 'internal'), {
    recursive: true,
    filter: (from) => !from.endsWith('.test.ts'),
  });
}

/** Copy src/themes/ → leaf src/themes/ (the design-token presets). */
function copyThemes(leafSrc, pkgName) {
  const src = resolve(ROOT, 'src/themes');
  if (!existsSync(src))
    throw new Error('codegen: src/themes/ not found (token presets must exist)');
  const dest = resolve(leafSrc, 'themes');
  cpSync(src, dest, { recursive: true });
  // The canonical theme-bridge doc comments hardcode a `-react` example import
  // (only the react leaf's copy happens to be byte-correct). Rewrite that one
  // reference per leaf so every OTHER target's copy names its OWN package
  // instead of silently claiming to be `${family}-react`.
  for (const file of readdirSync(dest)) {
    if (!file.endsWith('.css')) continue;
    const filePath = resolve(dest, file);
    const content = readFileSync(filePath, 'utf8');
    const patched = content.replace(/@rozie-ui\/[\w-]+-react\/themes\//g, `${pkgName}/themes/`);
    if (patched !== content) writeFileSync(filePath, patched);
  }
}

function main() {
  const source = readFileSync(SRC, 'utf8');

  // (2) parse + lower ONCE for the doc tables.
  const { ast } = parse(source, { filename: FILENAME });
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

  // Keep the hand-kept manifests in lockstep with the IR.
  for (const ev of ir.emits) {
    if (!eventManifest[ev]) {
      throw new Error(
        `codegen: event "${ev}" is emitted by the source but has no entry in event-manifest.mjs`,
      );
    }
  }
  for (const m of ir.expose) {
    if (!handleManifest[m.name]) {
      throw new Error(
        `codegen: method "${m.name}" is exposed by the source but has no entry in handle-manifest.mjs`,
      );
    }
  }

  // (3)(4)(5) per-target emit + vendor themes + README.
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
    // `TextField` the READMEs/consumers import (`export *` would NOT forward a
    // default). React/Solid also emit a named `TextFieldHandle` interface (the
    // `$expose` handle), forwarded verbatim; Lit's handle IS the element.
    if (cfg.build === 'tsdown') {
      const barrel =
        ((target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as TextField } from './TextField';\n` +
            `export { default } from './TextField';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { TextFieldHandle } from './TextField';\n`
          : `export { default as TextField } from './TextField';\nexport { default } from './TextField';\n`) +
        // `<types>` names (TextFieldValuePayload) + Lit's
        // RozieTextFieldEventMap via the shared helper (the popover precedent).
        typedSurfaceBarrelLines(target, ir, 'TextField');
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'TextField.css'), r.css);
      if (r.types) writeFileSync(resolve(leafSrc, 'TextField.d.ts'), r.types);
    }

    // (4) vendor the unit-tested internal helper.
    copyInternal(leafSrc);

    // (5) vendor the design-token presets.
    copyThemes(leafSrc, leafPkgName(cfg.dir));

    // (6) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, eventManifest, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // JetBrains web-types sidecar for the Vue leaf (D-05) — emitted from the
    // SAME IR the README uses so it never drifts. PhpStorm/WebStorm read this
    // (NOT vue-tsc's `__VLS_` .d.ts, WEB-57769) for prop/event/model
    // completion. The version is read from the leaf package.json AT
    // GENERATION TIME, so a version bump must be followed by a regen —
    // tests/sidecars.test.ts turns the stale-sidecar failure mode into a red
    // test instead of a silently re-dirtying build. The Vue codegen does not
    // otherwise rewrite the leaf package.json, so wire the `web-types` field +
    // `files` entry idempotently.
    if (target === 'vue') {
      const leafDir = resolve(ROOT, 'packages', cfg.dir);
      const vuePkgPath = resolve(leafDir, 'package.json');
      const vuePkg = JSON.parse(readFileSync(vuePkgPath, 'utf8'));
      const webTypesDoc = buildWebTypes({
        ir,
        pkgName: vuePkg.name,
        version: vuePkg.version,
        componentName: 'TextField',
        description: IDE_SIDECAR_DESCRIPTION,
        docUrl: IDE_SIDECAR_DOC_URL,
        eventManifest,
      });
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
    // from the SAME IR + wire the leaf package.json (`customElements` field +
    // files entry). Both VS Code (lit-plugin) and JetBrains read it for
    // `<rozie-text-field>` attribute/property/event completion. Wired
    // idempotently — the Lit codegen does not otherwise rewrite this manifest.
    if (target === 'lit') {
      const leafDir = resolve(ROOT, 'packages', cfg.dir);
      const litPkgPath = resolve(leafDir, 'package.json');
      const litPkg = JSON.parse(readFileSync(litPkgPath, 'utf8'));
      const cemDoc = buildCustomElementsManifest({
        ir,
        componentName: 'TextField',
        description: IDE_SIDECAR_DESCRIPTION,
        eventManifest,
        handleManifest,
      });
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


    // (6b) Vendor the repo LICENSE into each published leaf.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(
      `codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓ (+ internal/ + themes/)`,
    );
  }

  // (7) ENFORCE docs props-table validation.
  const docsPath = resolve(REPO_ROOT, 'docs/components/text-field.md');
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

  // (8) ENFORCE docs events/handle name-presence (see ../../docs-surface-guard.mjs).
  validateDocsSurfaceNames(ir, 'text-field', REPO_ROOT);

  console.log('codegen: done — 6 targets emitted, internal + themes vendored, 6 READMEs rendered.');
}

main();
