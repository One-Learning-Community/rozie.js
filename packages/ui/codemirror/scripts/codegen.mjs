/**
 * codegen.mjs — the single parse-once → emit-6 → render-READMEs engine for
 * @rozie-ui/codemirror.
 *
 * Pure GLUE over the `@rozie/core` public API (compile / parse / lowerToIR /
 * createDefaultRegistry) — the exact primitive docs/.vitepress/rozie-codegen.ts
 * uses. NO compiler/emitter/IR change. If a compile() call emits an
 * error-severity diagnostic this script THROWS (the same diagnostics-filter
 * contract as rozie-codegen.ts + the in-compile ROZ977 guard); per the scope
 * fence, an error means a mis-wired codegen path, never an emitter edit.
 *
 * Like @rozie-ui/fullcalendar (and UNLIKE @rozie-ui/sortable-list) there is NO
 * `src/internal/` helper to vendor: CodeMirror.rozie imports the `@codemirror/*`
 * engine packages directly, so the leaves carry no colocated bridge and there is
 * NO internal-helper copy step (unlike sortable-list).
 *
 * Divergences from the FullCalendar codegen analog:
 *   - NO event manifest (D-08): CodeMirror emits no events — the
 *     `updateListener` → `$model.value` two-way path IS the change channel — so
 *     there is no event-table import, no `ir.emits` lockstep, and no events
 *     README heading.
 *   - NO options-literal widening hack: CodeMirror's `buildState` returns
 *     `EditorState.create({...})` directly with no later-mutated options object,
 *     so FC's options-literal `code.replace(...)` widening would find no token
 *     and THROW. It is omitted entirely.
 *
 * BUILD-ORDER CONTRACT: this script writes each leaf's src/CodeMirror.*, so it
 * MUST run before the bundled-leaf tsdown builds (`turbo run build --force`).
 *
 * Steps:
 *   1. read src/CodeMirror.rozie
 *   2. parse() + lowerToIR() ONCE → ir (props/slots/emits/expose) for docs tables
 *   3. for each of the 6 targets: compile() → write leaf src/<file>
 *        (React only: also write CodeMirror.css + CodeMirror.d.ts)
 *   4. render each leaf README from the IR + the hand-kept handle manifest
 *   5. ENFORCE validateDocsPropsTable against docs/guide/codemirror.md
 *      (THROWS if the guide is absent AND on drift of the IR-derivable
 *      structural columns — prop name, type, default. Never rewrites the
 *      hand-authored prose. Plan 29-03 ships the guide; until then the
 *      ROZIE_CODEMIRROR_SKIP_GUIDE escape hatch relaxes the throw to a skip
 *      — see the step-(5) block.)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { handleManifest } from './handle-manifest.mjs';
import { renderReadme, validateDocsPropsTable } from './readme.mjs';

const ROOT = resolve(import.meta.dirname, '..'); // packages/ui/codemirror
const REPO_ROOT = resolve(ROOT, '..', '..', '..'); // monorepo root
const SRC = resolve(ROOT, 'src/CodeMirror.rozie');
const FILENAME = 'CodeMirror.rozie';

/** Per-target leaf dir + emitted filename (build mode is informational). */
const TARGETS = {
  react: { dir: 'react', file: 'CodeMirror.tsx', build: 'tsdown' },
  vue: { dir: 'vue', file: 'CodeMirror.vue', build: 'source' },
  svelte: { dir: 'svelte', file: 'CodeMirror.svelte', build: 'source' },
  angular: { dir: 'angular', file: 'CodeMirror.ts', build: 'source' },
  solid: { dir: 'solid', file: 'CodeMirror.tsx', build: 'tsdown' },
  lit: { dir: 'lit', file: 'CodeMirror.ts', build: 'tsdown' },
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

    // CodeMirror's `buildState` passes the extensions array straight into
    // `EditorState.create({...})` with no intervening mutated options object, so
    // the FullCalendar options-literal → `Record<string, any>` widening hack does
    // NOT apply here (it would find no token and throw). Emit the compiled code
    // (with the one sanctioned per-leaf type aid below for Lit).
    let code = r.code;

    // ─── Lit-only type aid: annotate the `*Ext` extension helpers ───────────
    // The Lit emitter lowers the top-level `langExt`/`themeExt`/`phExt` const
    // arrows to class-field arrow properties (`langExt = () => …;`). tsdown's
    // isolated `.d.ts` emit then tries to NAME each one's inferred return type:
    // `langExt`'s `javascript()` returns `LanguageSupport`, whose declaration
    // lives in `@codemirror/language` — a TRANSITIVE dep of
    // `@codemirror/lang-javascript`, NOT one of the five declared peers — so the
    // dts emit fails with TS2742 ("inferred type cannot be named without a
    // reference to '@codemirror/language' … a type annotation is necessary").
    // The proper home for a return annotation is the emitter, which is OUT OF
    // SCOPE (SCOPE FENCE). As the sanctioned in-scope per-leaf type aid (the CM
    // analog of FullCalendar's `const opts` widening), annotate the three helper
    // arrows with an explicit `: any` return here in codegen GLUE — durable
    // across regeneration, a pure type annotation (zero runtime change), and
    // scoped to the Lit leaf (react/solid emit these helpers in a form that does
    // not trip TS2742; vue/svelte/angular are type-neutral and never see it).
    // Tracked as an emitter follow-up (annotate hoisted engine-typed helpers).
    if (cfg.dir === 'lit') {
      let aided = 0;
      for (const name of ['langExt', 'themeExt', 'phExt']) {
        const token = `${name} = () =>`;
        const annotated = `${name} = (): any =>`;
        if (code.includes(token)) {
          code = code.replace(token, annotated);
          aided += 1;
        }
      }
      if (aided === 0) {
        // Fail loud if the Lit emit shape drifts so this aid never silently
        // no-ops and leaves the dts gate red.
        throw new Error(
          `codegen lit: expected to annotate the engine-extension helper arrows ` +
            `(\`langExt/themeExt/phExt = () =>\`) for the bundled-leaf dts gate, but none of the ` +
            `tokens were found — the Lit emit shape changed. Re-derive the type-gate aid ` +
            `(SCOPE FENCE: do NOT edit the emitter).`,
        );
      }
    }

    // ─── React/Solid-only type aid: annotate `themeExt`'s return as `any` ────
    // G3 widened the `theme` prop to accept a string OR a CM `Extension`, so its
    // emitted prop type is `unknown` (the most permissive `<props>` form). The
    // strict-tsc React/Solid leaves then infer `themeExt()`'s passthrough branch
    // (`return t`) as `unknown`, which `Compartment.of`/`reconfigure` reject
    // (TS2345: `unknown` is not assignable to `Extension`). The runtime value IS
    // an Extension by that branch. The proper fix is an emitter-level return
    // annotation, which is OUT OF SCOPE (SCOPE FENCE); as the sanctioned in-scope
    // per-leaf aid (the analog of the Lit `*Ext` annotation above), annotate
    // `themeExt`'s return `: any` here — a pure type annotation, zero runtime
    // change. Vue/Svelte/Angular are type-neutral and never see it; Lit is
    // already covered by the `themeExt = (): any =>` aid above.
    if (cfg.dir === 'react' || cfg.dir === 'solid') {
      const themeToken = cfg.dir === 'react' ? 'const themeExt = useCallback(() =>' : 'function themeExt()';
      const themeAnnotated =
        cfg.dir === 'react' ? 'const themeExt = useCallback((): any =>' : 'function themeExt(): any';
      if (!code.includes(themeToken)) {
        throw new Error(
          `codegen ${cfg.dir}: expected to annotate \`themeExt\`'s return \`: any\` (G3 widened-theme ` +
            `passthrough returns \`unknown\` under strict tsc) but the token \`${themeToken}\` was not found ` +
            `— the ${cfg.dir} emit shape changed. Re-derive the type-gate aid (SCOPE FENCE: do NOT edit the emitter).`,
        );
      }
      code = code.replace(themeToken, themeAnnotated);
    }

    writeFileSync(resolve(leafSrc, cfg.file), code);

    // Bundled leaves (tsdown) entry on src/index.ts. The emitted component is a
    // DEFAULT export, so the barrel re-exports the default under the named
    // `CodeMirror` the READMEs/consumers import (an `export *` would NOT forward
    // a default).
    if (cfg.build === 'tsdown') {
      // React AND Solid: re-export the named `CodeMirrorHandle` type directly
      // from the component module. The React/Solid emitters emit the synthesized
      // handle interface as `export interface CodeMirrorHandle` in the .tsx
      // itself (Phase 21 REQ-10 follow-up), so consumers can
      // `import type { CodeMirrorHandle }` and the barrel forwards it verbatim
      // — no ComponentRef derivation, no module-private caveat. Lit gets no
      // named type: its handle is the custom element itself, so the plain barrel
      // is correct there.
      const barrel =
        (target === 'react' || target === 'solid') && ir.expose.length > 0
          ? `export { default as CodeMirror } from './CodeMirror';\n` +
            `export { default } from './CodeMirror';\n\n` +
            `/** The \`$expose\` imperative handle received via \`ref\` — { ${ir.expose
              .map((m) => m.name)
              .join(', ')} }. */\n` +
            `export type { CodeMirrorHandle } from './CodeMirror';\n`
          : `export { default as CodeMirror } from './CodeMirror';\nexport { default } from './CodeMirror';\n`;
      writeFileSync(resolve(leafSrc, 'index.ts'), barrel);
    }

    // React-only sidecars.
    if (target === 'react') {
      if (r.css) writeFileSync(resolve(leafSrc, 'CodeMirror.css'), r.css);
      // The React emitter routes nested-`:root` engine rules (the `.cm-*`
      // escape-hatch styles, Phase 34) into `r.globalCss` and emits a sibling
      // `import './CodeMirror.global.css';` side effect in the `.tsx`. Write the
      // sidecar whenever it is present so that import resolves; without it the
      // regenerated leaf imports a non-existent file (the cm-* engine rules went
      // dead→live in Phase 34-03, so this path activated for the first time).
      // WR-03 — keep the sidecar in lockstep with the emit. If a future
      // .rozie edit removes all nested-:root engine rules, r.globalCss becomes
      // null and the emitted .tsx drops its `import './CodeMirror.global.css'`.
      // Without this cleanup the previously-written (committed) sidecar would
      // linger on disk — a stale, unreferenced CSS file shipped in the tarball.
      const globalCssPath = resolve(leafSrc, 'CodeMirror.global.css');
      if (r.globalCss) {
        writeFileSync(globalCssPath, r.globalCss);
      } else if (existsSync(globalCssPath)) {
        rmSync(globalCssPath);
      }
      if (r.types) writeFileSync(resolve(leafSrc, 'CodeMirror.d.ts'), r.types);
    }

    // (4) README from the single IR parse.
    const pkgName = leafPkgName(cfg.dir);
    const readme = renderReadme(target, ir, pkgName, handleManifest);
    writeFileSync(resolve(ROOT, 'packages', cfg.dir, 'README.md'), readme);

    // Vendor the repo LICENSE into each published leaf so the tarball carries
    // its own MIT license text (the root LICENSE does not propagate into
    // per-package tarballs). Copy-from-root keeps the 6 copies from drifting.
    cpSync(resolve(REPO_ROOT, 'LICENSE'), resolve(ROOT, 'packages', cfg.dir, 'LICENSE'));

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars}  ✓`);
  }

  // (5) ENFORCE docs props-table validation: the IR-derivable structural columns
  // (prop name + type + default) in docs/guide/codemirror.md MUST match ir.props
  // or this script THROWS. It does NOT overwrite the hand-authored prose
  // (Runtime-updatable? column + Descriptions stay) — VALIDATE-NOT-OVERWRITE. The
  // docs file is the single-source-of-truth surface for the structural columns;
  // reconcile the table (not the validator) if it drifts. (Same ENFORCING shape
  // as @rozie-ui/fullcalendar.)
  //
  // Plan 29-03 authors docs/guide/codemirror.md. Until it lands, the
  // ROZIE_CODEMIRROR_SKIP_GUIDE env escape hatch relaxes the absent-guide throw
  // to a skip so Plan 29-02 can emit the leaves first. Plan 29-03 runs codegen
  // WITHOUT the flag, flipping validation back to ENFORCING-passing.
  const guideRelPath = 'docs/guide/codemirror.md';
  const guideExists = existsSync(resolve(REPO_ROOT, guideRelPath));
  const skipGuide = process.env.ROZIE_CODEMIRROR_SKIP_GUIDE === '1';
  if (!guideExists && !skipGuide) {
    // ENFORCING: an absent guidePath is a HARD failure (the docs page ships a
    // real props table). throw here so codegen cannot silently emit leaves
    // without the single-source-of-truth docs surface.
    throw new Error(
      `codegen: docs props-table validation FAILED — ${guideRelPath} not found (the docs page is the ` +
        `single-source-of-truth surface and must exist). Plan 29-03 authors it; to emit the leaves ` +
        `before then, run with ROZIE_CODEMIRROR_SKIP_GUIDE=1.`,
    );
  }
  const guidePath = resolve(REPO_ROOT, guideRelPath);
  if (!guideExists) {
    console.log(
      'codegen: docs props-table validation SKIPPED — docs/guide/codemirror.md not yet authored ' +
        '(ROZIE_CODEMIRROR_SKIP_GUIDE=1; Plan 29-03 authors the guide and re-runs WITHOUT the flag).',
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
