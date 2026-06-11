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
 *   5. ENFORCE validateDocsPropsTable against docs/components/codemirror.md
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

// ─────────────────────────────────────────────────────────────────────────────
// G2 — language preset constants via the `/languages` subpath.
//
// This module is FRAMEWORK-AGNOSTIC pure CM6 — identical bytes across all 6
// leaves — so codegen emits the SAME `languages.ts` into every leaf's src/. It
// is a PURELY ADDITIVE sibling of the emitted `CodeMirror.*` component: the base
// component + the `language` prop are UNCHANGED. A consumer opts in by spreading
// a preset into the component's `:extensions`.
//
// TREE-SHAKING CONTRACT (the whole point): every CM language constructor
// (`html()`, `css()`, `javascript()`, …) is PURE — no global registration
// (unlike Chart.js's `register()`) — so the eager `export const web = [html()]`
// presets are side-effect-free top-level exports. Paired with `sideEffects`
// scoped to exclude this module (see `langPackaging` below), a consumer importing
// only `{ web }` pulls ONLY `@codemirror/lang-html`; `python`/`sql`/`yaml`/… are
// dropped by the bundler. Proven empirically in Plan G2 (esbuild bundle of a
// single-preset entry contains lang-html, not lang-python/lang-sql/lang-yaml).
//
// The raw lang constructors are re-exported under a `lang` namespace object
// (`lang.html()`, `lang.css()`, …) for power users who compose their own
// extension arrays. A namespace object avoids the name collisions that a flat
// re-export would hit (the preset `css`/`vue`/`json`/… already own those names),
// and stays tree-shakable: a consumer that never references `lang` drops it
// whole.
//
// API SHAPES verified against the installed `.d.ts` (do NOT guess):
//   - `@codemirror/lang-sass` option is `indented?: boolean` (NOT
//     `indentedSyntax`): SCSS = `sass({ indented: false })`, indented Sass =
//     `sass({ indented: true })`.
//   - `@codemirror/lang-vue` (young, 0.1.x) exports `vue(config?)`.
//   - `@codemirror/lang-javascript` `javascript({ jsx?, typescript? })`.
const LANGUAGES_TS = `// AUTO-GENERATED by packages/ui/codemirror/scripts/codegen.mjs — DO NOT EDIT.
//
// Curated, importable CodeMirror 6 language presets for @rozie-ui/codemirror-<fw>.
// Each preset is a ready-to-spread \`Extension[]\` you drop into the component's
// \`:extensions\` for a robust syntax-highlighting starting point — with ZERO
// bloat to the base \`CodeMirror\` import. CM language constructors are pure (no
// global registration), so these eager exports tree-shake: importing one preset
// pulls only its own \`@codemirror/lang-*\` package, never the others.
//
//   import { CodeMirror } from '@rozie-ui/codemirror-<fw>';
//   import { web } from '@rozie-ui/codemirror-<fw>/languages';
//   // <CodeMirror :extensions={web} />   // HTML + embedded CSS/JS
//
// This module is FRAMEWORK-AGNOSTIC (identical across all 6 leaves) and PURELY
// ADDITIVE — the base component + its \`language\` prop are unchanged.
import type { Extension } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sass } from '@codemirror/lang-sass';
import { vue } from '@codemirror/lang-vue';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';

// Each constructor call is annotated \`/*#__PURE__*/\` so that bundlers treat the
// eager preset construction as side-effect-free and DROP any preset a consumer
// does not import. Without this annotation a bundler conservatively keeps every
// \`<lang>()\` call (a top-level call it cannot prove pure), pulling EVERY
// \`@codemirror/lang-*\` into the consumer bundle — defeating the whole design.
// (Proven empirically: importing only \`web\` drops lang-python/lang-sql/lang-yaml.)

// ─── Markup / web ────────────────────────────────────────────────────────────
/** HTML with auto-embedded CSS + JavaScript highlighting (the common web case). */
export const web: Extension[] = [/*#__PURE__*/ html()];
/** Alias of {@link web} — HTML + embedded CSS/JS. */
export const html_: Extension[] = web;
export { html_ as html };
/** Plain CSS. */
export const css_: Extension[] = [/*#__PURE__*/ css()];
export { css_ as css };
/** SCSS (\`sass({ indented: false })\`). */
export const scss: Extension[] = [/*#__PURE__*/ sass({ indented: false })];
/** Indented Sass syntax (\`sass({ indented: true })\`). */
export const sass_: Extension[] = [/*#__PURE__*/ sass({ indented: true })];
export { sass_ as sass };
/** Vue SFC + SCSS for \`<style lang="scss">\` blocks. */
export const vue_: Extension[] = [/*#__PURE__*/ vue(), /*#__PURE__*/ sass({ indented: false })];
export { vue_ as vue };

// ─── JS family ───────────────────────────────────────────────────────────────
/** JavaScript. */
export const javascript_: Extension[] = [/*#__PURE__*/ javascript()];
export { javascript_ as javascript };
/** TypeScript. */
export const typescript: Extension[] = [/*#__PURE__*/ javascript({ typescript: true })];
/** JSX (JavaScript + JSX). */
export const jsx: Extension[] = [/*#__PURE__*/ javascript({ jsx: true })];
/** TSX (TypeScript + JSX). */
export const tsx: Extension[] = [/*#__PURE__*/ javascript({ jsx: true, typescript: true })];

// ─── Data / config / prose ───────────────────────────────────────────────────
/** JSON. */
export const json_: Extension[] = [/*#__PURE__*/ json()];
export { json_ as json };
/** Markdown. */
export const markdown_: Extension[] = [/*#__PURE__*/ markdown()];
export { markdown_ as markdown };
/** YAML. */
export const yaml_: Extension[] = [/*#__PURE__*/ yaml()];
export { yaml_ as yaml };
/** XML. */
export const xml_: Extension[] = [/*#__PURE__*/ xml()];
export { xml_ as xml };
/** Python. */
export const python_: Extension[] = [/*#__PURE__*/ python()];
export { python_ as python };
/** SQL. */
export const sql_: Extension[] = [/*#__PURE__*/ sql()];
export { sql_ as sql };

// ─── Raw constructors (power users) ──────────────────────────────────────────
/**
 * The raw \`@codemirror/lang-*\` constructors, for composing your own extension
 * arrays (e.g. \`[...lang.html(), myExtension]\`). Namespaced to avoid colliding
 * with the same-named presets above. Tree-shakable: never reference \`lang\` and
 * the whole object is dropped.
 */
export const lang = {
  html,
  css,
  sass,
  vue,
  javascript,
  json,
  markdown,
  yaml,
  xml,
  python,
  sql,
} as const;
`;

/**
 * BUNDLED-LEAF `@codemirror/lang-*` externals (react/solid/lit). The languages
 * module imports the lang packages; like the existing engine peers they must be
 * marked external so tsdown leaves the bare specifiers in the bundle (resolved
 * by the consumer's own bundler) — otherwise tsdown would inline + the
 * tree-shaking guarantee would move to the consumer build anyway. Keep in lockstep
 * with the leaf `peerDependencies` lang set.
 */
const LANG_EXTERNALS = [
  '@codemirror/lang-html',
  '@codemirror/lang-css',
  '@codemirror/lang-sass',
  '@codemirror/lang-vue',
  '@codemirror/lang-json',
  '@codemirror/lang-markdown',
  '@codemirror/lang-yaml',
  '@codemirror/lang-xml',
  '@codemirror/lang-python',
  '@codemirror/lang-sql',
];

/**
 * G2 packaging patch — wire the `/languages` subpath into a leaf's committed
 * `package.json` (and, for bundled leaves, `tsdown.config.ts`). Surgical +
 * fail-loud on anchor drift; the rest of each config stays author-owned.
 *
 *   - `exports["./languages"]`: bundled (react/solid/lit) → `dist/languages.*`;
 *     source-shipped (vue/svelte/angular) → `src/languages.ts`.
 *   - `sideEffects`: scope so the languages module (and component code) stay
 *     tree-shakable WHILE genuine side-effect CSS imports survive. The React
 *     leaf has `import './CodeMirror.css'` + `'./CodeMirror.global.css'` side
 *     effects → ALLOWLIST form `["*.css", "**\/*.css"]`. Solid/Lit and the three
 *     source leaves have NO side-effect imports → plain `false`. (Per-leaf,
 *     justified — see commit.)
 *   - bundled-leaf `tsdown.config.ts`: add `src/languages.ts` to `entry` and the
 *     lang packages to `external`.
 */
function patchLeafLangPackaging(dir, cfg) {
  // ── package.json ──────────────────────────────────────────────────────────
  const pkgPath = resolve(ROOT, 'packages', dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  if (!pkg.exports || !pkg.exports['.']) {
    throw new Error(`codegen ${dir}: package.json has no \`exports["."]\` to anchor the \`./languages\` subpath (config shape changed)`);
  }
  if (cfg.build === 'tsdown') {
    pkg.exports['./languages'] = {
      types: './dist/languages.d.mts',
      import: './dist/languages.mjs',
      require: './dist/languages.cjs',
    };
    // The React leaf ships genuine side-effect CSS imports; keep them alive via
    // an allowlist while the languages module + component stay tree-shakable.
    // Solid/Lit have no side-effect imports → plain false.
    pkg.sideEffects = dir === 'react' ? ['*.css', '**/*.css'] : false;
  } else {
    // Source-shipped leaves (vue/svelte/angular): the subpath resolves straight
    // to the committed source module. The three source leaves carry no
    // side-effect imports, so `false` is safe and lets a consumer bundler drop
    // unused presets.
    pkg.exports['./languages'] = {
      types: './src/languages.ts',
      import: './src/languages.ts',
      default: './src/languages.ts',
    };
    pkg.sideEffects = false;
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // ── tsdown.config.ts (bundled leaves only) ────────────────────────────────
  if (cfg.build !== 'tsdown') return;
  const tsdownPath = resolve(ROOT, 'packages', dir, 'tsdown.config.ts');
  let tsdown = readFileSync(tsdownPath, 'utf8');

  // (a) entry: add 'src/languages.ts' if absent.
  const entryRe = /entry:\s*\[([^\]]*)\],/;
  const m = entryRe.exec(tsdown);
  if (!m) {
    throw new Error(`codegen ${dir}: tsdown.config.ts has no \`entry: [...]\` array to patch (config shape changed)`);
  }
  if (!m[1].includes('languages')) {
    const items = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    items.push("'src/languages.ts'");
    tsdown = tsdown.replace(entryRe, `entry: [${items.join(', ')}],`);
  }

  // (b) external: add the lang packages if absent. The committed `external:` array
  // already lists the engine peers; insert the lang specifiers before the
  // trailing `/\.css$/` regex (which is not a string literal). Idempotent.
  for (const spec of LANG_EXTERNALS) {
    if (!tsdown.includes(`'${spec}'`)) {
      // Anchor on the existing lang-javascript peer external — every leaf lists it.
      const anchor = "'@codemirror/lang-javascript',";
      if (!tsdown.includes(anchor)) {
        throw new Error(`codegen ${dir}: tsdown.config.ts external array missing the \`${anchor}\` anchor for lang-package insertion (config shape changed)`);
      }
      tsdown = tsdown.replace(anchor, `${anchor}\n    '${spec}',`);
    }
  }
  writeFileSync(tsdownPath, tsdown);
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

    // ─── Bundled-leaf type aid (react/solid/lit): annotate `buildMarkers`'s ──
    // return `: any` for the `gutter` slot (G5 wave 2). The custom-gutter
    // `markers` callback must return `RangeSet<GutterMarker>`, but `buildMarkers`
    // builds the set from a `ranges` array of anonymous-`GutterMarker`-subclass
    // ranges that the strict-tsc leaves infer as `RangeSet<RangeValue>` (the
    // `noImplicitAny:false` `ranges: any[]` widens the marker element type), so
    // `gutterExt({ markers })` rejects it (TS2322). The runtime value IS a
    // `RangeSet<GutterMarker>`. The proper fix is an emitter-level annotation
    // (OUT OF SCOPE — SCOPE FENCE); as the sanctioned in-scope per-leaf aid (the
    // analog of the `themeExt`/`*Ext` annotations above), annotate `buildMarkers`'s
    // return `: any` here — a pure type annotation, zero runtime change. The emit
    // shape is identical across the three bundled leaves; vue/svelte/angular are
    // type-neutral and never see it. Only present when the `gutter` slot wires the
    // marker builder, so this aid is gated on the token's presence.
    if (cfg.dir === 'react' || cfg.dir === 'solid' || cfg.dir === 'lit') {
      const markersToken = 'const buildMarkers = (mView: any) =>';
      const markersAnnotated = 'const buildMarkers = (mView: any): any =>';
      if (!code.includes(markersToken)) {
        throw new Error(
          `codegen ${cfg.dir}: expected to annotate \`buildMarkers\`'s return \`: any\` (the gutter slot's ` +
            `\`markers\` callback returns a RangeSet of anonymous GutterMarker subclasses that strict tsc ` +
            `widens to RangeSet<RangeValue>, TS2322) but the token \`${markersToken}\` was not found — the ` +
            `${cfg.dir} emit shape changed. Re-derive the type-gate aid (SCOPE FENCE: do NOT edit the emitter).`,
        );
      }
      code = code.replace(markersToken, markersAnnotated);
    }

    writeFileSync(resolve(leafSrc, cfg.file), code);

    // ─── G2: emit the framework-agnostic language-preset module ─────────────
    // Identical bytes in every leaf (pure CM6); a purely additive sibling of the
    // component, reached via the `/languages` subpath wired by
    // `patchLeafLangPackaging` below.
    writeFileSync(resolve(leafSrc, 'languages.ts'), LANGUAGES_TS);

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

    // ─── G2: wire the `/languages` subpath + sideEffects (+ tsdown entry/external)
    patchLeafLangPackaging(cfg.dir, cfg);

    const sidecars = target === 'react' ? ' (+ .css + .d.ts)' : '';
    console.log(`codegen: ${target.padEnd(8)} → ${cfg.dir}/src/${cfg.file}${sidecars} + languages.ts  ✓`);
  }

  // (5) ENFORCE docs props-table validation: the IR-derivable structural columns
  // (prop name + type + default) in docs/components/codemirror.md MUST match ir.props
  // or this script THROWS. It does NOT overwrite the hand-authored prose
  // (Runtime-updatable? column + Descriptions stay) — VALIDATE-NOT-OVERWRITE. The
  // docs file is the single-source-of-truth surface for the structural columns;
  // reconcile the table (not the validator) if it drifts. (Same ENFORCING shape
  // as @rozie-ui/fullcalendar.)
  //
  // Plan 29-03 authors docs/components/codemirror.md. Until it lands, the
  // ROZIE_CODEMIRROR_SKIP_GUIDE env escape hatch relaxes the absent-guide throw
  // to a skip so Plan 29-02 can emit the leaves first. Plan 29-03 runs codegen
  // WITHOUT the flag, flipping validation back to ENFORCING-passing.
  const guideRelPath = 'docs/components/codemirror.md';
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
      'codegen: docs props-table validation SKIPPED — docs/components/codemirror.md not yet authored ' +
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
