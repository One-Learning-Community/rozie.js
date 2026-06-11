/**
 * codegen.mjs — the single parse-once → emit-6 → render-READMEs engine for
 * @rozie-ui/cropper.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive the @rozie-ui/maplibre codegen
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as the maplibre codegen + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * Like @rozie-ui/maplibre, Cropper.rozie imports `cropperjs` directly, so the
 * leaves carry no colocated bridge and there is NO internal-helper copy step.
 *
 * Cropper.rozie's 6 emits compile strict-tsc-clean as-authored (verified across
 * all leaves), so there is NO per-leaf type-aid `code.replace(...)` patch. If a
 * future emit shape needs one, ADD it as a fail-loud token-anchored replace — do
 * NOT edit the emitter (SCOPE FENCE).
 *
 * BUILD-ORDER CONTRACT: this script writes each leaf's src/Cropper.*, so it MUST
 * run before the bundled-leaf tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/Cropper.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write Cropper.css [+ Cropper.global.css if present] + Cropper.d.ts)
 *   4. render each leaf README from the IR + the hand-kept handle manifest
 *   5. ENFORCE validateDocsPropsTable against docs/components/cropper.md
 *      (THROWS if the guide is absent AND on drift of the IR-derivable structural
 *      columns — prop name, type, default. Never rewrites the hand-authored prose.
 *      ROZIE_CROPPER_SKIP_GUIDE=1 relaxes the absent-guide throw to a skip so the
 *      leaves can be emitted before the guide lands.)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/cropper
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/Cropper.rozie');
const FILENAME = 'Cropper.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'Cropper.tsx', build: 'tsdown' },
  vue: { dir: 'vue', file: 'Cropper.vue', build: 'source' },
  svelte: { dir: 'svelte', file: 'Cropper.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'Cropper.ts', build: 'source' },
  solid: { dir: 'solid', file: 'Cropper.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'Cropper.ts', build: 'tsdown' },
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

    // React leaf type-aid (token-anchored, fail-loud — the CodeMirror/codegen
    // pattern, NOT an emitter edit; SCOPE FENCE). The React emitter types an
    // element `ref` from a tag→type map that covers `div` (HTMLDivElement) but
    // falls back to `HTMLElement` for `img` — so the `imageEl` ref is
    // `useRef<HTMLElement | null>`, which is not assignable to an `<img ref=…>`
    // (wants `Ref<HTMLImageElement>`) under strict tsc. Retype the imageEl ref to
    // HTMLImageElement. If a future React emit no longer produces this exact
    // token, the throw flags it (so the aid never silently rots).
    let code = r.code;
    if (target === 'react') {
      const NEEDLE = 'const imageEl = useRef<HTMLElement | null>(null);';
      if (!code.includes(NEEDLE)) {
        throw new Error(
          'codegen react: imageEl ref type-aid anchor not found — the React emit shape changed. ' +
            `Expected to retype:\n  ${NEEDLE}\n` +
            'Re-confirm the emitted React imageEl ref typing and update (or remove) this aid.',
        );
      }
      code = code.replace(NEEDLE, 'const imageEl = useRef<HTMLImageElement | null>(null);');
    }
    writeFileSync(resolve(leafSrc, cfg.file), code);

    // Bundled leaves (tsdown) entry on src/index.ts. The emitted component is a
    // DEFAULT export, so the barrel re-exports the default under the named
    // `Cropper` consumers import (an `export *` would NOT forward a default).
    if (cfg.build === 'tsdown') {
      // React AND Solid: re-export the named `CropperHandle` type directly from
      // the component module (the emitters emit `export interface CropperHandle`
      // in the .tsx). Lit gets no named type: its handle is the custom element.
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as Cropper } from './Cropper';\n` +
            `export { default } from './Cropper';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { CropperHandle } from './Cropper';\n`
          : `export { default as Cropper } from './Cropper';\nexport { default } from './Cropper';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'Cropper.css'), r.css);
      // Keep the global-css sidecar in lockstep with the emit: write it when the
      // React emitter routes nested-`:root` engine rules into r.globalCss (+ emits
      // a sibling `import './Cropper.global.css';`); remove a stale one otherwise.
      // Cropper.rozie ships NO nested-:root engine rules today, so r.globalCss is
      // null and no sidecar is written.
      const globalCssPath = resolve(leafSrc, 'Cropper.global.css');
      if (r.globalCss) {
        writeFileSync(globalCssPath, r.globalCss);
      } else if (existsSync(globalCssPath)) {
        rmSync(globalCssPath);
      }
      if (r.types) writeFileSync(resolve(leafSrc, 'Cropper.d.ts'), r.types);
    }

    // (4) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // Vendor the repo LICENSE into each published leaf so the tarball carries its
    // own MIT license text (the root LICENSE does not propagate into per-package
    // tarballs).
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓`);
  }

  // (5) ENFORCE docs props-table validation against docs/components/cropper.md.
  const guideRelPath = 'docs/components/cropper.md';
  const guideExists = existsSync(resolve(REPO_ROOT, guideRelPath));
  const skipGuide = process.env.ROZIE_CROPPER_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). Author it; to emit the leaves before then, ` +
        `run with ROZIE_CROPPER_SKIP_GUIDE=1.`,
    );
  }
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  if (!guideExists) {
    console.log(
      'codegen: docs props-table validation SKIPPED — docs/components/cropper.md not yet authored ' +
        '(ROZIE_CROPPER_SKIP_GUIDE=1; author the guide and re-run WITHOUT the flag).',
    );
  } else {
    const docs = readFileSync(guidePath, 'utf8');
    const result = validateDocsPropsTable(ir, docs);
    if (!result.ok) {
      throw new Error(
        `codegen: docs props-table validation DRIFT — the IR-derivable structural columns in ${guidePath} ` +
          `do not match ir.props. Fix ONLY the structural columns in the docs table (preserve the ` +
          `Runtime-updatable? + Description prose); do NOT weaken this validator:\n` +
          result.errors.map((e) => `  - ${e}`).join('\n'),
      );
    }
    console.log(
      `codegen: docs props-table validation PASS — ${result.checkedRows} rows match ir.props (ENFORCING; throws on drift)`,
    );
  }

  console.log('codegen: done — 6 targets emitted, 6 READMEs rendered, 6 LICENSEs vendored.');
}

main();
