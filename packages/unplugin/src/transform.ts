/**
 * @rozie/unplugin transform / load / resolveId hooks.
 *
 * Per D-25 amendment (Plan 03-06 Wave 0 spike): we use the path-virtual chain.
 *   - resolveId: rewrites `Foo.rozie` → `<abs>/Foo.rozie.{vue,tsx}` (synthetic
 *     suffix per target).
 *   - load: reads the underlying `.rozie`, runs parse → lowerToIR → emit{Vue,React},
 *     returns the synthesized source so the downstream framework plugin's
 *     transformInclude (default `/\.vue$/` for vite-plugin-vue, `/\.[jt]sx?$/`
 *     for vite-plugin-react) matches the synthetic id and processes it
 *     naturally.
 *   - The `transform` hook is exported for direct use (tests + symmetry with
 *     Plan 02-04 ScriptInjection split), but production wiring uses load.
 *
 * Plan 04-05 Task 2 — React branch (D-58); Phase 25 de-CSS-Modules:
 *   - Suffix `.rozie.tsx` for the JSX shell.
 *   - Sibling `Foo.rozie.css` (plain scoped CSS) and `Foo.rozie.global.css`
 *     virtual ids handled by separate load branches that run emitStyle and
 *     return only the CSS body (no map). The bundler treats the plain `.css`
 *     as a GLOBAL stylesheet — NO CSS-Modules hashing. Class isolation is the
 *     `[data-rozie-s-HASH]` attribute selector that scopeCss appends to every
 *     rule; CSS Modules was a redundant second isolation layer and is removed.
 *   - The compiled `.tsx` body emits a plain side-effect `import './Foo.css'`
 *     (NOT `./Foo.rozie.css`) so the consumer's import path stays
 *     human-friendly. resolveId rewrites the `Foo.css` request back to the
 *     `Foo.rozie.css` virtual id when a sibling `.rozie` file exists at the
 *     importer's path (excluding `.global.css`, which routes separately).
 *
 * Errors throw Vite-shaped objects with `loc`, `frame`, `plugin`, `code` per
 * D-28 — Vite's dev-overlay renders them with the offending .rozie line
 * highlighted. Non-fatal warnings call `this.warn(...)`.
 *
 * @experimental — shape may change before v1.0
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { isAbsolute, resolve as pathResolve, dirname, join as pathJoin, relative as pathRelative } from 'node:path';
import { parse } from '../../core/src/parse.js';
import { lowerToIR } from '../../core/src/ir/lower.js';
// Phase 54 (Plan 04) — `.rzts`/`.rzjs` script-partial negative-routing predicate.
// A partial import is a COMPILE-TIME inline (spliced into the host at lowerToIR),
// NEVER a module: it must produce NO virtual id and NO sidecar. We consult this
// shared predicate in resolveId + transformInclude so the negative-route
// guarantee is explicit and durable against future catch-all branches, rather
// than relying on the incidental fact that `.rzts`/`.rzjs` don't `endsWith` any
// existing `.rozie*` suffix.
import { isPartialExtension } from '../../core/src/ir/inlineScriptPartials.js';
import { splitBlocks } from '../../core/src/splitter/splitBlocks.js';
import type { BlockMap } from '../../core/src/ast/types.js';
// Phase 07.2 Plan 03 — thread producer paramTypes onto consumer SlotFillerDecl.
// Without this step, unplugin's per-target output would diverge from compile()'s
// output for the consumer-scoped-fill case (compile() runs threadParamTypes
// step 2.5; unplugin's pipelines previously skipped it). dist-parity Leg 4
// would then fail on every consumer-scoped-fill cell.
import { threadParamTypes } from '../../core/src/ir/threadParamTypes.js';
import { validateTwoWayBindings } from '../../core/src/ir/validateTwoWayBindings.js';
// Phase 38 — ROZ088 portal-scoped-style Lit diagnostic. `@rozie/unplugin` does
// NOT call `compile()`; each per-target pipeline threads + validates inline, so
// this pass must be invoked at every pipeline site (mirrors how compile.ts wires
// it after threadParamTypes — see compile.ts:312). Missing a site means the
// warning fires in compile()/CLI/tests but NOT in a real Vite/Rollup build. The
// pass reads only the already-threaded `filler.isPortal`, so it needs no
// IRCache/ProducerResolver of its own — call it directly with `(ir, acc)`.
import { validatePortalScopedStyle } from '../../core/src/ir/validatePortalScopedStyle.js';
// Phase 10 Plan 04 — splice compiled SCSS-to-CSS into the emitter source string.
// `@rozie/unplugin` does NOT call `compile()`; each per-target pipeline parses
// and emits independently, so every parse-then-emit site must call this helper
// (mirrors `compile.ts` step 3). For a `<style lang="scss">` component the six
// emitStyle.ts files slice rule bodies at offsets indexing the COMPILED CSS;
// the helper substitutes that compiled CSS into the style-block body span. The
// dist-parity 4-entrypoint byte gate is the proof a pipeline was missed
// (SPEC-REQ-2 / SPEC-REQ-7). No-op (byte-identical) for plain CSS (SPEC-REQ-8).
import { substituteCompiledStyle } from '../../core/src/codegen/substituteCompiledStyle.js';
import { IRCache } from '../../core/src/ir/cache.js';
import { ProducerResolver } from '../../core/src/resolver/index.js';
import type { ModifierRegistry } from '@rozie/core';
import { emitVue, type EmitVueResult } from '../../targets/vue/src/emitVue.js';
import { emitReact, type EmitReactResult } from '../../targets/react/src/emitReact.js';
import { emitSvelte, type EmitSvelteResult } from '../../targets/svelte/src/emitSvelte.js';
import { emitAngular, type EmitAngularResult } from '../../targets/angular/src/emitAngular.js';
import { emitSolid, type EmitSolidResult } from '../../targets/solid/src/emitSolid.js';
import { emitLit, type EmitLitResult } from '../../targets/lit/src/emitLit.js';
import type { Diagnostic } from '../../core/src/diagnostics/Diagnostic.js';
import { stampMissingFilename } from '../../core/src/diagnostics/stampFilename.js';
import type { TargetValue } from './options.js';
import { formatViteError, formatLoc } from './diagnostics.js';

/**
 * Synthetic suffix appended by Vue's resolveId. The downstream load hook
 * strips `.vue` to recover the underlying `.rozie` path.
 */
const VIRTUAL_SUFFIX_VUE = '.rozie.vue';

/**
 * React-target synthetic suffixes. The `.tsx` carries the JSX shell;
 * `.css` and `.global.css` carry the styles produced by emitStyle.
 *
 * Phase 25 — the scoped-CSS sibling is a PLAIN `.css` (not `.module.css`).
 * React no longer routes scoped `<style>` through CSS Modules: class names are
 * un-hashed and `[data-rozie-s-HASH]` attribute scoping (applied by scopeCss)
 * is the sole isolation layer. The bundler treats `.css` as a global stylesheet
 * (no CSS-Modules hashing / pure-selector rejection), which is exactly what we
 * want — it fixes the Next.js/webpack `button[data-rozie-s-…]` build break.
 */
const VIRTUAL_SUFFIX_REACT = '.rozie.tsx';
const VIRTUAL_SUFFIX_REACT_CSS = '.rozie.css';
const VIRTUAL_SUFFIX_REACT_GLOBAL_CSS = '.rozie.global.css';

/**
 * Svelte-target synthetic suffix (Plan 05-02b). The `.svelte` carries the
 * full SFC (script + template + style); @sveltejs/vite-plugin-svelte's
 * default `transformInclude` matches `/\.svelte$/` and processes the
 * synthesized id naturally.
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO sibling `.module.css` virtual ids —
 * Svelte's compiler handles `<style>` block scoping internally. The
 * `:root { ... }` escape hatch is wrapped as `:global(:root) { ... }` by
 * the Svelte emitter, so a single .svelte virtual id covers everything.
 */
const VIRTUAL_SUFFIX_SVELTE = '.rozie.svelte';

/**
 * Angular-target synthetic suffix (Plan 05-04b). The `.ts` carries the full
 * standalone Angular component (class with inline template + styles array);
 * @analogjs/vite-plugin-angular's TS_EXT_REGEX (`/\.[cm]?ts(?![a-z])/`) matches
 * the synthesized id and feeds it through Angular's Ivy compiler — Path A
 * per Plan 05-03 SPIKE.md (CONFIRMED — analogjs 2.5.0 transform handler
 * consumes the upstream `code` parameter rather than reading from disk).
 *
 * Per RESEARCH OQ A8/A9 RESOLVED + Plan 05-04a: NO sibling style virtual
 * ids — Angular emits styles inside the `@Component({ styles: [...] })`
 * decorator, so a single `.ts` virtual id covers everything. The `:root`
 * escape hatch is wrapped as `::ng-deep :root { ... }` by emitStyle (OQ A4
 * v1; Plan 05-05 Modal CSS-vars Playwright validates necessity).
 */
const VIRTUAL_SUFFIX_ANGULAR = '.rozie.ts';

/**
 * Solid-target synthetic suffix (Phase 06.3 — D-139).
 *
 * `.rozie.tsx` — same as React because vite-plugin-solid uses Babel +
 * babel-preset-solid which transforms `.tsx` files. The suffix is identical
 * to VIRTUAL_SUFFIX_REACT, but the resolveId routing is target-specific
 * (createResolveIdHook checks `target === 'solid'` vs `target === 'react'`
 * before dispatching).
 *
 * Per RESEARCH Pitfall 3: NO sibling .module.css / .global.css virtual ids —
 * Solid emits styles inline. A single .rozie.tsx virtual id covers everything
 * (mirrors Svelte's approach, not React's).
 */
const VIRTUAL_SUFFIX_SOLID = '.rozie.tsx';

/**
 * Lit-target synthetic suffix (Phase 06.4 — D-LIT-20).
 *
 * `.rozie.ts` — the Rozie Lit emitter produces a plain TS module whose
 * `customElements.define()` call at module load registers the custom
 * element. The suffix string IS THE SAME as VIRTUAL_SUFFIX_ANGULAR (both
 * `.rozie.ts`), but runtime dispatch is on the closure-captured `target`
 * value at resolveId/load construction time, so the collision is benign —
 * only one target can be active per `Rozie({ target: ... })` config
 * instance.
 *
 * Per RESEARCH Pitfall 3: NO sibling .module.css / .global.css virtual ids —
 * Lit emits styles via `static styles = css\`...\`` inside the class body
 * (shadow-DOM-scoped automatically). The :root escape hatch lands via the
 * runtime helper `injectGlobalStyles(id, css)` (D-LIT-15), not a separate
 * CSS module.
 */
const VIRTUAL_SUFFIX_LIT = '.rozie.ts';

/**
 * Phase 4 escape-hatch: query-suffix forms (`?style=module` / `?style=global`)
 * accepted as alternative routing for consumers whose pipelines clash with
 * the file-extension form. Path 1 fallback per 04-05-SPIKE.md.
 */
const QUERY_STYLE_MODULE = '?style=module';
const QUERY_STYLE_GLOBAL = '?style=global';

/**
 * transformInclude predicate — matches synthetic .rozie.* ids only. Bare
 * `.rozie` ids are intercepted by resolveId; vite-plugin-vue handles `.vue`
 * and vite-plugin-react handles `.tsx`.
 */
export function transformIncludeRozie(id: string): boolean {
  // Phase 54 negative route: a `.rzts`/`.rzjs` script partial is inlined into
  // its host at lowerToIR — it is never transformed as its own module. Exclude
  // it explicitly so no future synthetic-suffix addition can accidentally route
  // a partial through the per-target transform pipeline (which would mis-handle
  // a template-less partial as a component → ROZ977).
  if (isPartialExtension(id)) return false;
  return (
    id.endsWith(VIRTUAL_SUFFIX_VUE) ||
    id.endsWith(VIRTUAL_SUFFIX_REACT) || // VIRTUAL_SUFFIX_REACT === VIRTUAL_SUFFIX_SOLID by construction; both targets share the .rozie.tsx suffix.
    // Phase 25 — `.rozie.css` plain scoped-CSS virtual id. Guard ordering: a
    // `.rozie.global.css` id does NOT end with `.rozie.css` (tail is
    // `global.css`), so the two endsWith checks are mutually exclusive.
    id.endsWith(VIRTUAL_SUFFIX_REACT_CSS) ||
    id.endsWith(VIRTUAL_SUFFIX_REACT_GLOBAL_CSS) ||
    id.includes(VIRTUAL_SUFFIX_REACT + QUERY_STYLE_MODULE) ||
    id.includes(VIRTUAL_SUFFIX_REACT + QUERY_STYLE_GLOBAL) ||
    id.endsWith(VIRTUAL_SUFFIX_SVELTE) ||
    // isAngularVirtualId checks `.rozie.ts` — that suffix is shared with
    // VIRTUAL_SUFFIX_LIT (D-LIT-20). Runtime dispatch in createResolveIdHook
    // and createLoadHook keys on the closure-captured `target` value, so the
    // suffix collision is benign — only one target can be active at a time.
    // WR-07: use the explicit isLitVirtualId predicate to document the
    // deliberate Lit/Angular suffix collision.
    isAngularVirtualId(id) ||
    isLitVirtualId(id)
  );
}

/**
 * `.rozie.ts` predicate that distinguishes Rozie's synthetic id from
 * consumer-authored `.ts` modules. We check the FULL `.rozie.ts` suffix
 * to avoid matching plain `.ts` files (which the user may import directly
 * — `transformInclude` running on those would route them through the Rozie
 * pipeline incorrectly).
 */
function isAngularVirtualId(id: string): boolean {
  return id.endsWith(VIRTUAL_SUFFIX_ANGULAR);
}

/**
 * WR-07: Explicit Lit virtual-id predicate.
 *
 * VIRTUAL_SUFFIX_LIT === VIRTUAL_SUFFIX_ANGULAR (both `.rozie.ts`). The
 * shared suffix is intentional — only one target can be active per
 * `Rozie({ target: '...' })` instance, so there is no runtime ambiguity.
 * However, naming this predicate explicitly (rather than calling
 * `isAngularVirtualId`) documents the deliberate collision and provides a
 * clear extension point if the suffixes ever diverge.
 */
export function isLitVirtualId(id: string): boolean {
  return id.endsWith(VIRTUAL_SUFFIX_LIT);
}

/**
 * Subset of unplugin/Vite's plugin-context shape we use. The real types are
 * `UnpluginBuildContext & UnpluginContext` from unplugin which is more
 * specific than we need; we accept any context that exposes `.warn(msg)`.
 */
// biome-ignore lint/suspicious/noExplicitAny: unplugin/Vite plugin-context shape varies; we only call .warn().
type AnyContext = any;

/**
 * resolveId hook (path-virtual). The returned id is what later hooks see in
 * `load` and `transform`.
 *
 * @param target  — RozieOptions.target. Vue path uses `.rozie.vue` suffix;
 *   React path uses `.rozie.tsx` plus sibling `.rozie.css` (plain scoped CSS) /
 *   `.rozie.global.css` rewrites (Phase 25 — no `.module.css` route survives).
 */
export function createResolveIdHook(
  target: TargetValue = 'vue',
): (id: string, importer: string | undefined) => string | null {
  if (target === 'angular') {
    return function resolveIdAngular(id: string, importer: string | undefined): string | null {
      // Phase 54 negative route: never resolve a `.rzts`/`.rzjs` partial to a
      // virtual/synthetic id — it inlines into the host at lowerToIR.
      if (isPartialExtension(id)) return null;
      // D-70 disk-cache: `.rozie.ts` files are now real files on disk
      // (written by `prebuildAngularRozieFiles` during Vite's
      // configResolved hook). Returning the absolute path lets Vite read
      // the file via the standard filesystem path, which means analogjs's
      // TS Program (built from `tsconfig.app.json`'s `include` patterns)
      // picks up the file naturally — addressing the gap where Path A's
      // synthetic-id approach broke down because analogjs's `fileEmitter`
      // walks the TS Program rather than consuming the upstream `code`
      // parameter for AOT builds.
      if (id.endsWith(VIRTUAL_SUFFIX_ANGULAR)) {
        const abs = absolutize(id, importer);
        return existsSync(abs) ? abs : null;
      }
      // Bare `.rozie` import → `<abs>/Foo.rozie.ts`. analogjs's TS_EXT_REGEX
      // (/\.[cm]?ts(?![a-z])/) matches the trailing `.ts`. The on-disk file
      // is written by prebuildAngularRozieFiles before any transform hook
      // runs.
      if (id.endsWith('.rozie')) {
        const abs = absolutize(id, importer);
        return abs + '.ts';
      }
      // Phase 06.2 D-118 cross-rozie composition: per-target emitters rewrite
      // a `<components>{ Foo }</components>` import as `import Foo from './Foo'`
      // (extensionless for Angular per rewriteRozieImport). When a sibling
      // `Foo.rozie` exists on disk, route the request to its disk-cache
      // companion `Foo.rozie.ts` so the prebuild output is found.
      if (isExtensionlessRelative(id)) {
        const abs = absolutize(id, importer);
        if (existsSync(abs + '.rozie')) {
          const cached = abs + VIRTUAL_SUFFIX_ANGULAR;
          return existsSync(cached) ? cached : null;
        }
      }
      return null;
    };
  }
  if (target === 'svelte') {
    return function resolveIdSvelte(id: string, importer: string | undefined): string | null {
      // Phase 54 negative route: a `.rzts`/`.rzjs` partial is inlined at
      // lowerToIR, never resolved to a synthetic id.
      if (isPartialExtension(id)) return null;
      // Pass-through for the synthetic id itself (load handles it).
      if (id.endsWith(VIRTUAL_SUFFIX_SVELTE)) return id;
      // Bare `.rozie` import → `<abs>/Foo.rozie.svelte`.
      if (id.endsWith('.rozie')) {
        const abs = absolutize(id, importer);
        return abs + '.svelte';
      }
      // Phase 06.2 D-118 cross-rozie composition: emitted Svelte SFCs use
      // `import Foo from './Foo.svelte'` (rewriteRozieImport) AND the D-117
      // self-import idiom does the same for recursion. When a sibling
      // `Foo.rozie` exists, rewrite to the synthetic `Foo.rozie.svelte`.
      if (id.endsWith('.svelte')) {
        const abs = absolutize(id, importer);
        const base = abs.slice(0, -'.svelte'.length);
        if (existsSync(base + '.rozie')) {
          return base + VIRTUAL_SUFFIX_SVELTE;
        }
      }
      return null;
    };
  }
  if (target === 'solid') {
    return function resolveIdSolid(id: string, importer: string | undefined): string | null {
      // Phase 54 negative route: a `.rzts`/`.rzjs` partial is inlined at
      // lowerToIR, never resolved to a synthetic id.
      if (isPartialExtension(id)) return null;
      // 1) Bare `.rozie` import → `<abs>/Foo.rozie.tsx` (same shape as React).
      if (id.endsWith('.rozie')) {
        const abs = absolutize(id, importer);
        return abs + '.tsx';
      }
      // 2) NO .module.css / .global.css routing — Solid emits styles inline (Pitfall 3).
      // 3) Pass-through for the synthetic id itself.
      if (id.endsWith(VIRTUAL_SUFFIX_SOLID)) return id;
      // 4) Phase 06.2 D-118 cross-rozie composition — extensionless relative imports.
      //    Solid emits `import Foo from './Foo'` (solid: '' in TARGET_EXT_MAP).
      if (isExtensionlessRelative(id)) {
        const abs = absolutize(id, importer);
        if (existsSync(abs + '.rozie')) return abs + VIRTUAL_SUFFIX_SOLID;
      }
      return null;
    };
  }
  if (target === 'lit') {
    return function resolveIdLit(id: string, importer: string | undefined): string | null {
      // Phase 54 negative route: a `.rzts`/`.rzjs` partial is inlined at
      // lowerToIR, never resolved to a synthetic id.
      if (isPartialExtension(id)) return null;
      // 1) Pass-through for the synthetic id itself.
      if (id.endsWith(VIRTUAL_SUFFIX_LIT)) return id;
      // 2) Bare `.rozie` import → `<abs>/Foo.rozie.ts`.
      if (id.endsWith('.rozie')) {
        const abs = absolutize(id, importer);
        return abs + '.ts';
      }
      // 3) D-LIT side-effect composition: emitted Lit modules emit
      //    `import './Foo.rozie';` (no symbol bind — module load registers
      //    the custom element via customElements.define). When a sibling
      //    `Foo.rozie` exists, route the extensionless relative import to
      //    the synthetic `Foo.rozie.ts`. Mirrors Angular's D-118 idiom
      //    (lit: '' in TARGET_EXT_MAP).
      if (isExtensionlessRelative(id)) {
        const abs = absolutize(id, importer);
        if (existsSync(abs + '.rozie')) return abs + VIRTUAL_SUFFIX_LIT;
      }
      return null;
    };
  }
  if (target === 'react') {
    return function resolveIdReact(id: string, importer: string | undefined): string | null {
      // Phase 54 negative route: a `.rzts`/`.rzjs` partial is inlined at
      // lowerToIR, never resolved to a synthetic id.
      if (isPartialExtension(id)) return null;
      // 1) Bare `.rozie` import → `<abs>/Foo.rozie.tsx`.
      if (id.endsWith('.rozie')) {
        const abs = absolutize(id, importer);
        return abs + '.tsx';
      }
      // 2) The `:root` escape hatch sibling `.global.css`. This MUST be matched
      //    BEFORE the plain `.css` branch below — `Foo.global.css` also ends in
      //    `.css`, so the plain-`.css` branch explicitly excludes it (and this
      //    branch runs first as a belt-and-suspenders).
      if (id.endsWith('.global.css') && !id.endsWith(VIRTUAL_SUFFIX_REACT_GLOBAL_CSS)) {
        const abs = absolutize(id, importer);
        const base = abs.slice(0, -'.global.css'.length);
        if (existsSync(base + '.rozie')) {
          return base + VIRTUAL_SUFFIX_REACT_GLOBAL_CSS;
        }
        return null;
      }
      // 3) Phase 25 — the compiled `.tsx` body emits a plain side-effect
      //    `import './Foo.css'`. Rewrite to the synthetic `.rozie.css` id ONLY
      //    when there is a sibling `.rozie` file on disk (so we don't clobber
      //    consumer-authored `.css` imports). CRITICAL guard ordering: exclude
      //    `.global.css` (handled above) and the already-synthetic `.rozie.css`
      //    id, or this branch would hijack the `:root` global-CSS request and
      //    break the escape hatch.
      if (
        id.endsWith('.css') &&
        !id.endsWith('.global.css') &&
        !id.endsWith(VIRTUAL_SUFFIX_REACT_CSS)
      ) {
        const abs = absolutize(id, importer);
        const base = abs.slice(0, -'.css'.length); // <abs>/Foo
        if (existsSync(base + '.rozie')) {
          return base + VIRTUAL_SUFFIX_REACT_CSS;
        }
        return null;
      }
      // 4) Pass-through for the synthetic ids themselves and the query-form
      //    fallbacks — load handles them.
      if (
        id.endsWith(VIRTUAL_SUFFIX_REACT) ||
        id.endsWith(VIRTUAL_SUFFIX_REACT_CSS) ||
        id.endsWith(VIRTUAL_SUFFIX_REACT_GLOBAL_CSS) ||
        id.includes(VIRTUAL_SUFFIX_REACT + QUERY_STYLE_MODULE) ||
        id.includes(VIRTUAL_SUFFIX_REACT + QUERY_STYLE_GLOBAL)
      ) {
        return id;
      }
      // 5) Phase 06.2 D-118 cross-rozie composition: emitted React modules use
      //    `import Foo from './Foo'` (rewriteRozieImport returns '' for React).
      //    When a sibling `Foo.rozie` exists on disk, rewrite to the synthetic
      //    `Foo.rozie.tsx` so load() generates the JSX shell.
      if (isExtensionlessRelative(id)) {
        const abs = absolutize(id, importer);
        if (existsSync(abs + '.rozie')) {
          return abs + VIRTUAL_SUFFIX_REACT;
        }
      }
      return null;
    };
  }
  // Vue (default) — Phase 3 behaviour preserved verbatim.
  return function resolveIdVue(id: string, importer: string | undefined): string | null {
    // Phase 54 negative route: a `.rzts`/`.rzjs` partial is inlined at
    // lowerToIR, never resolved to a synthetic id.
    if (isPartialExtension(id)) return null;
    if (id.endsWith('.rozie')) {
      const abs = absolutize(id, importer);
      return abs + '.vue';
    }
    // Phase 06.2 D-118 cross-rozie composition: emitted Vue SFCs use
    // `import Foo from './Foo.vue'` (rewriteRozieImport). When a sibling
    // `Foo.rozie` exists, rewrite to the synthetic `Foo.rozie.vue`.
    if (id.endsWith('.vue') && !id.endsWith(VIRTUAL_SUFFIX_VUE)) {
      const abs = absolutize(id, importer);
      const base = abs.slice(0, -'.vue'.length);
      if (existsSync(base + '.rozie')) {
        return base + VIRTUAL_SUFFIX_VUE;
      }
    }
    return null;
  };
}

/**
 * D-118 cross-rozie composition helper: matches relative imports without a
 * recognized JS/TS/asset extension. React + Angular emitters omit the
 * extension (`rewriteRozieImport` returns ''); we detect that shape so we
 * can resolve `import Foo from './Foo'` against a sibling `Foo.rozie`
 * without colliding with consumer-authored extensionful imports.
 */
function isExtensionlessRelative(id: string): boolean {
  if (id.includes('?') || id.includes('\0')) return false;
  if (!(id.startsWith('./') || id.startsWith('../') || isAbsolute(id))) return false;
  const lastSlash = id.lastIndexOf('/');
  const basename = lastSlash === -1 ? id : id.slice(lastSlash + 1);
  return basename.length > 0 && !basename.includes('.');
}

function absolutize(id: string, importer: string | undefined): string {
  // Reject null-byte injection in module ids (defense-in-depth — closes
  // T-05-04b-03 + WR-07). Vite's own resolveId pipeline already filters
  // these for VFS ids, but the unplugin layer sees raw `id` strings.
  if (id.includes('\0')) {
    throw new Error(`@rozie/unplugin: refusing to resolve id with null byte: ${JSON.stringify(id)}`);
  }
  // Strip any query string before path resolution; query is re-attached by
  // the caller if needed (the React load hook re-detects the query suffix).
  const queryIdx = id.indexOf('?');
  const bare = queryIdx === -1 ? id : id.slice(0, queryIdx);
  if (isAbsolute(bare)) return bare;
  if (importer) return pathResolve(dirname(importer), bare);
  return pathResolve(bare);
}

/**
 * load hook: reads the underlying `.rozie` file, runs the per-target
 * pipeline, returns `{ code, map }`. Throws Vite-shaped errors on parse /
 * lowering / emission failures; calls `this.warn` on non-fatal warnings.
 */
export function createLoadHook(
  registry: ModifierRegistry,
  target: TargetValue = 'vue',
  // Phase 23 — Angular CVA opt-out forwarded into the Vite-runtime fallback
  // pipeline. Defaults undefined → emitter default-ON (byte-identical when omitted).
  cva?: boolean,
  // Phase 26 (D-11) — GLOBAL safe-interpolation opt-out forwarded into the five
  // non-Vue pipelines' lowerToIR call. Defaults undefined → lowerer default-ON
  // (`?? true`), byte-identical when omitted. No-op for the Vue target (Vue is
  // never wrapped).
  safeInterpolation?: boolean,
) {
  if (target === 'angular') {
    return function loadAngular(
      this: AnyContext,
      id: string,
    ): { code: string; map: EmitAngularResult['map'] } | null {
      if (!id.endsWith(VIRTUAL_SUFFIX_ANGULAR)) return null;
      // D-70 disk-cache: when the .rozie.ts has been pre-written to disk by
      // prebuildAngularRozieFiles, Vite reads the file via the standard
      // filesystem path and analogjs's TS Program picks it up. Returning
      // null here defers to that filesystem read.
      //
      // The fallback path (file NOT yet on disk — e.g. dep-scan cold-start
      // before configResolved completes, or a unit test exercising the load
      // hook directly) materialises the .rozie.ts on demand by running the
      // pipeline and returning the synthesized source. This preserves the
      // pre-D-70 Path A behavior for tests + early scans.
      if (existsSync(id)) {
        return null;
      }
      const filePath = id.slice(0, -'.ts'.length);
      if (!existsSync(filePath)) return null;
      const source = readFileSync(filePath, 'utf8');
      return runAngularPipeline.call(this, source, filePath, registry, cva, safeInterpolation);
    };
  }
  if (target === 'svelte') {
    return function loadSvelte(
      this: AnyContext,
      id: string,
    ): { code: string; map: EmitSvelteResult['map'] } | null {
      if (!id.endsWith(VIRTUAL_SUFFIX_SVELTE)) return null;
      // Strip `.svelte` only — leaves `.rozie`.
      const filePath = id.slice(0, -'.svelte'.length);
      const source = readFileSync(filePath, 'utf8');
      return runSveltePipeline.call(this, source, filePath, registry, safeInterpolation);
    };
  }
  if (target === 'solid') {
    return function loadSolid(
      this: AnyContext,
      id: string,
    ): { code: string; map: EmitSolidResult['map'] } | null {
      if (!id.endsWith(VIRTUAL_SUFFIX_SOLID)) return null;
      // Strip `.tsx` only — leaves `.rozie`.
      const filePath = id.slice(0, -'.tsx'.length);
      const source = readFileSync(filePath, 'utf8');
      return runSolidPipeline.call(this, source, filePath, registry, safeInterpolation);
    };
  }
  if (target === 'lit') {
    return function loadLit(
      this: AnyContext,
      id: string,
    ): { code: string; map: EmitLitResult['map'] } | null {
      if (!id.endsWith(VIRTUAL_SUFFIX_LIT)) return null;
      // Strip `.ts` only — leaves `.rozie`.
      const filePath = id.slice(0, -'.ts'.length);
      const source = readFileSync(filePath, 'utf8');
      return runLitPipeline.call(this, source, filePath, registry, safeInterpolation);
    };
  }
  if (target === 'react') {
    return function loadReact(
      this: AnyContext,
      id: string,
    ): { code: string; map: EmitReactResult['map'] } | null {
      // Strip query suffix for filesystem read; remember which body to return.
      let queryStyle: 'module' | 'global' | null = null;
      let bareId = id;
      if (bareId.endsWith(QUERY_STYLE_MODULE)) {
        queryStyle = 'module';
        bareId = bareId.slice(0, -QUERY_STYLE_MODULE.length);
      } else if (bareId.endsWith(QUERY_STYLE_GLOBAL)) {
        queryStyle = 'global';
        bareId = bareId.slice(0, -QUERY_STYLE_GLOBAL.length);
      }

      // Global CSS path (`.rozie.global.css`). MUST be checked BEFORE the plain
      // scoped-CSS branch below — the two suffix tests are mutually exclusive by
      // `endsWith` (a `.rozie.global.css` id does not end with `.rozie.css`), but
      // global-first keeps the `:root` escape hatch unambiguous.
      if (bareId.endsWith(VIRTUAL_SUFFIX_REACT_GLOBAL_CSS)) {
        const filePath = bareId.slice(0, -VIRTUAL_SUFFIX_REACT_GLOBAL_CSS.length) + '.rozie';
        const source = readFileSync(filePath, 'utf8');
        const result = runReactPipeline.call(this, source, filePath, registry, safeInterpolation);
        // No :root rules → return null so Vite emits no module (empty file
        // would cause an unnecessary import-side-effect noop).
        if (result.globalCss === undefined || result.globalCss === '') return null;
        return { code: result.globalCss, map: null };
      }
      // Phase 25 — plain scoped-CSS path (`.rozie.css`). Serve `result.css` as a
      // plain global stylesheet string (no CSS-Modules signalling needed — the
      // bundler treats a `.css` import as a global stylesheet). Attribute
      // scoping (`[data-rozie-s-HASH]`) inside the CSS is the isolation layer.
      if (bareId.endsWith(VIRTUAL_SUFFIX_REACT_CSS)) {
        const filePath = bareId.slice(0, -VIRTUAL_SUFFIX_REACT_CSS.length) + '.rozie';
        const source = readFileSync(filePath, 'utf8');
        const result = runReactPipeline.call(this, source, filePath, registry, safeInterpolation);
        return { code: result.css, map: null };
      }
      // .tsx shell — also handles ?style=module / ?style=global query forms
      // by routing back through the CSS branches.
      if (bareId.endsWith(VIRTUAL_SUFFIX_REACT)) {
        const filePath = bareId.slice(0, -'.tsx'.length); // strip `.tsx` only — leaves `.rozie`
        const source = readFileSync(filePath, 'utf8');
        const result = runReactPipeline.call(this, source, filePath, registry, safeInterpolation);
        if (queryStyle === 'module') {
          return { code: result.css, map: null };
        }
        if (queryStyle === 'global') {
          if (result.globalCss === undefined || result.globalCss === '') return null;
          return { code: result.globalCss, map: null };
        }
        return { code: result.code, map: result.map };
      }
      return null;
    };
  }
  // Vue (default) — Phase 3 behaviour preserved verbatim.
  return function loadVue(
    this: AnyContext,
    id: string,
  ): { code: string; map: EmitVueResult['map'] } | null {
    if (!id.endsWith(VIRTUAL_SUFFIX_VUE)) return null;
    const filePath = id.slice(0, -'.vue'.length); // strip `.vue` only — leaves `.rozie`
    const source = readFileSync(filePath, 'utf8');

    return runRoziePipeline.call(this, source, filePath, registry);
  };
}

/**
 * transform hook (alternative wiring + direct test surface). Called for
 * `.rozie` source already loaded by Vite's pipeline. Used by transform.test
 * to exercise the parse/lower/emit chain without going through resolveId.
 */
export function createTransformHook(
  registry: ModifierRegistry,
  target: TargetValue = 'vue',
  // Phase 23 — Angular CVA opt-out forwarded into the request-time transform
  // pipeline. Defaults undefined → emitter default-ON (byte-identical when omitted).
  cva?: boolean,
  // Phase 26 (D-11) — GLOBAL safe-interpolation opt-out forwarded into the five
  // non-Vue pipelines' lowerToIR call. Defaults undefined → lowerer default-ON.
  safeInterpolation?: boolean,
) {
  if (target === 'angular') {
    return function transformAngular(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitAngularResult['map'] } | null {
      return runAngularPipeline.call(this, code, id, registry, cva, safeInterpolation);
    };
  }
  if (target === 'svelte') {
    return function transformSvelte(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitSvelteResult['map'] } | null {
      return runSveltePipeline.call(this, code, id, registry, safeInterpolation);
    };
  }
  if (target === 'solid') {
    return function transformSolid(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitSolidResult['map'] } | null {
      return runSolidPipeline.call(this, code, id, registry, safeInterpolation);
    };
  }
  if (target === 'lit') {
    return function transformLit(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitLitResult['map'] } | null {
      return runLitPipeline.call(this, code, id, registry, safeInterpolation);
    };
  }
  if (target === 'react') {
    return function transformReact(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitReactResult['map'] } | null {
      const result = runReactPipeline.call(this, code, id, registry, safeInterpolation);
      return { code: result.code, map: result.map };
    };
  }
  return function transformVue(
    this: AnyContext,
    code: string,
    id: string,
  ): { code: string; map: EmitVueResult['map'] } | null {
    return runRoziePipeline.call(this, code, id, registry);
  };
}

/**
 * Phase 07.2 Plan 03 — thread producer paramTypes onto consumer
 * SlotFillerDecl. Mirrors `compile.ts` step 2.5 — without this, the
 * unplugin per-target pipelines would emit consumer-side scoped fills
 * lacking the producer's paramTypes annotation, breaking dist-parity
 * Leg 4 for every consumer-scoped-fill cell.
 *
 * Each pipeline call gets its own cache + resolver (short-lived; mirrors
 * compile.ts's `opts.irCache ?? new IRCache(...)` pattern). The resolver's
 * root defaults to `dirname(filePath)` — the consumer's directory — so
 * sibling `./producer.rozie` imports resolve correctly. compile() uses
 * `process.cwd()` as default; for unplugin we use the consumer's own
 * directory because Vite's resolveId may invoke the transform from any
 * cwd, and the sibling-file convention is the dominant case.
 */
// ---------------------------------------------------------------------------
// Build-scoped shared producer-resolution state.
//
// Each `.rozie` load used to construct a fresh `IRCache` + `ProducerResolver`
// inside EVERY pipeline helper (2 caches + 3 resolvers per load), so a
// composition (`<components>`) consumer re-read + re-parsed + re-lowered all of
// its producer files on every single load — no amortization across a build.
// On the VR build (6 Vite builds × ~136 fixtures, ~56% composition) that is
// hundreds of redundant producer parse/lower cycles.
//
// We now share resolution state across the whole build. This is exactly the
// amortization `compile.ts`'s `opts.irCache` JSDoc anticipates "(e.g., from
// `@rozie/unplugin`)". It stays byte-identical because:
//   - The `IRCache` is keyed by RESOLVED ABSOLUTE producer path and an
//     `IRComponent` is a pure function of that file's content — a cache hit is
//     byte-identical to a fresh lower, regardless of which consumer filled it
//     (RESEARCH Pitfall 2: cache fill order MUST NEVER drive output — it does
//     not here). One instance is therefore safe to share build-wide.
//   - The `ProducerResolver` DOES depend on its `root` (tsconfig discovery), so
//     we memoize ONE resolver per root. Same root → same resolver, which is a
//     pure function of root and thus byte-identical to constructing it fresh.
//     The resolver intentionally omits `CachedInputFileSystem` (see
//     nodeResolve.ts), so it carries no filesystem cache to go stale — reusing
//     the instance is safe.
//
// Lifetime: module-scoped. `vite build` runs one process per target build, so
// the cache is fresh per build and freed at exit. For `vite dev` the process is
// long-lived, so `handleHotUpdate` MUST call `invalidateSharedIRCache()` on a
// `.rozie` change to drop the stale producer IR (+ its transitive consumers).
// The registry-identity guard rebuilds the cache (and clears the resolver memo)
// if a different plugin instance with a different `ModifierRegistry` appears.
let sharedIRCache: IRCache | null = null;
let sharedCacheRegistry: ModifierRegistry | null = null;
const resolverByRoot = new Map<string, ProducerResolver>();

function getSharedIRCache(registry: ModifierRegistry): IRCache {
  if (sharedIRCache === null || sharedCacheRegistry !== registry) {
    sharedIRCache = new IRCache({ modifierRegistry: registry });
    sharedCacheRegistry = registry;
    // Tie the resolver memo lifetime to the cache so a registry swap starts
    // from a clean, consistent resolution state.
    resolverByRoot.clear();
  }
  return sharedIRCache;
}

function getResolverForRoot(root: string): ProducerResolver {
  let resolver = resolverByRoot.get(root);
  if (resolver === undefined) {
    resolver = new ProducerResolver({ root });
    resolverByRoot.set(root, resolver);
  }
  return resolver;
}

/**
 * HMR hook (dev): drop a changed `.rozie` producer's cached IR plus the
 * transitive set of consumers that touched it, so a stale producer IR cannot
 * survive an edit. Returns the affected path set (empty when no cache exists
 * yet). Wired from `handleHotUpdate` in index.ts. No-op for `vite build`.
 */
export function invalidateSharedIRCache(changedPath: string): Set<string> {
  if (sharedIRCache === null) return new Set();
  return sharedIRCache.invalidate(changedPath);
}

function threadParamTypesForPipeline(
  ir: import('../../core/src/ir/types.js').IRComponent,
  filePath: string,
  registry: ModifierRegistry,
  acc: Diagnostic[],
): void {
  // Shared build-scoped cache + per-root resolver (see block above). The same
  // cache + resolver are reused by `validateTwoWayBindingsForPipeline` below —
  // matching compile.ts, which threads ONE cache through both passes.
  const cache = getSharedIRCache(registry);
  const resolver = getResolverForRoot(dirname(filePath));
  threadParamTypes(ir, filePath, cache, resolver, acc);
}

/**
 * Phase 54 (Plan 04) — build the `LowerOptions` fields that drive
 * `inlineScriptPartials` for one per-target unplugin pipeline.
 *
 * `inlineScriptPartials` runs as the FIRST pass inside `lowerToIR` (the single
 * chokepoint compile()/CLI and all six per-target unplugin pipelines share). To
 * make the `.rzts`/`.rzjs` splice run IDENTICALLY at every build-tool
 * entrypoint, each pipeline must thread the same `resolver` + host `filename`
 * that `compile()` threads. We construct the resolver with the SAME discipline
 * `threadParamTypesForPipeline` already uses — a `ProducerResolver` rooted at
 * the host file's directory — so the inline pass resolves sibling `./expand`
 * → `expand.rzts` requests consistently. Output stays a pure function of inputs
 * (a fresh, short-lived resolver per call — no cross-pipeline cache state),
 * preserving the byte-identical dist-parity invariant (RESEARCH Pitfall 1/2).
 */
function partialInlineLowerOptions(filePath: string): {
  resolver: ProducerResolver;
  filename: string;
} {
  return {
    // Per-root memoized resolver (see the build-scoped state block above) —
    // byte-identical to a fresh `ProducerResolver({ root })`, just shared.
    resolver: getResolverForRoot(dirname(filePath)),
    filename: filePath,
  };
}

// Phase 07.3 Plan 02 — parallel mediation for the consumer-side two-way
// validator. Mirrors threadParamTypesForPipeline so each pipeline call site
// runs ROZ949/ROZ950/ROZ951 against the same per-call cache + resolver as
// the type-threading pass. Silent degrade on producer lookup failure is
// inherited from validateTwoWayBindings itself.
function validateTwoWayBindingsForPipeline(
  ir: import('../../core/src/ir/types.js').IRComponent,
  filePath: string,
  registry: ModifierRegistry,
  acc: Diagnostic[],
): void {
  // Same shared build-scoped cache + per-root resolver as
  // `threadParamTypesForPipeline` — producer IRs fetched during threading are
  // reused here for free, mirroring compile.ts's single-cache-both-passes flow.
  const cache = getSharedIRCache(registry);
  const resolver = getResolverForRoot(dirname(filePath));
  validateTwoWayBindings(ir, filePath, cache, resolver, acc);
}

/**
 * Phase 10 Plan 04 — compute the emit source string + the matching block
 * offsets for the per-target pipelines.
 *
 * `substituteCompiledStyle` splices the compiled SCSS-to-CSS output into the
 * `<style>` body for a `lang="scss"` component. That splice changes the byte
 * length of the source string, which INVALIDATES `ast.blocks` — the BlockMap
 * `parse()` built against the ORIGINAL `.rozie` source. The per-target
 * pipelines pass `blockOffsets: ast.blocks` to the emitters, and an emitter
 * (e.g. solid's `buildShell`) drives `MagicString.overwrite` from those
 * offsets — stale offsets that index past the (shorter) substituted string
 * throw `end is out of bounds`.
 *
 * `compile.ts` is unaffected because it does NOT pass `blockOffsets`; the
 * emitters re-derive them from `opts.source` via `splitBlocks()`. This helper
 * gives the unplugin pipelines the same correctness: when the source was
 * substituted, re-run `splitBlocks` on the substituted string so the offsets
 * match. When no substitution happened (plain CSS — the dominant case), the
 * original `ast.blocks` is returned untouched, byte-identical (SPEC-REQ-8).
 */
function emitSourceAndBlocks(
  source: string,
  ast: import('../../core/src/ast/types.js').RozieAST,
  filePath: string,
): { emitSource: string; blockOffsets: BlockMap } {
  const emitSource = substituteCompiledStyle(source, ast);
  if (emitSource === source) {
    return { emitSource, blockOffsets: ast.blocks };
  }
  // Substitution occurred — re-derive block offsets against the new string so
  // they stay consistent with the source the emitter slices/overwrites.
  const { diagnostics: _ignored, ...blockOffsets } = splitBlocks(emitSource, filePath);
  return { emitSource, blockOffsets };
}

/**
 * Shared parse → lowerToIR → emitVue pipeline. Throws Vite-shaped errors on
 * fatal diagnostics; calls `this.warn` on warnings. Returns `{ code, map }`
 * suitable for Vite's transform/load return shape.
 */
function runRoziePipeline(
  this: AnyContext,
  source: string,
  filePath: string,
  registry: ModifierRegistry,
): { code: string; map: EmitVueResult['map'] } {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR (semantic + IR build)
  // Phase 54 — thread the producer resolver + host filename so the
  // `.rzts`/`.rzjs` inline pass runs identically to compile()/CLI here.
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    ...partialInlineLowerOptions(filePath),
  });
  // Surface parse-time warnings + IR-time warnings together
  const warnings: Diagnostic[] = [...parseDiags.filter((d) => d.severity === 'warning'), ...irDiags.filter((d) => d.severity === 'warning')];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 2.5. Phase 07.2 — thread producer paramTypes onto consumer SlotFillerDecl.
  // Mirrors compile.ts step 2.5. Skipping this would break dist-parity for
  // every consumer-scoped-fill cell × Leg 4 (unplugin). Surface threading
  // errors as warnings — ROZ947 mismatches should still ship the emit
  // (with paramTypes missing → degraded type-flow) rather than blocking
  // the build.
  const threadDiags: Diagnostic[] = [];
  threadParamTypesForPipeline(ir, filePath, registry, threadDiags);
  validateTwoWayBindingsForPipeline(ir, filePath, registry, threadDiags);
  // Phase 38 — ROZ088: flag scoped `<style>` rules whose subject is used only in
  // portal-fill content (silent Lit shadow-DOM regression). Runs after threading
  // so `filler.isPortal` is populated; reads no cache/resolver.
  validatePortalScopedStyle(ir, threadDiags);
  warnings.push(...threadDiags.filter((d) => d.severity === 'warning'));
  const threadErrors = threadDiags.filter((d) => d.severity === 'error');
  if (threadErrors.length > 0) {
    throw formatViteError(threadDiags, filePath, source);
  }

  // 3. emitVue
  // Phase 10 Plan 04 — splice compiled SCSS-to-CSS into the emitter source
  // (no-op for plain CSS) and re-derive block offsets to match. `parse()`
  // above still saw the original `source`.
  const { emitSource, blockOffsets } = emitSourceAndBlocks(source, ast, filePath);
  const result = emitVue(ir, {
    filename: filePath,
    source: emitSource,
    modifierRegistry: registry,
    blockOffsets,
  });
  const emitErrors = result.diagnostics.filter((d) => d.severity === 'error');
  if (emitErrors.length > 0) {
    throw formatViteError(emitErrors, filePath, source);
  }
  warnings.push(...result.diagnostics.filter((d) => d.severity === 'warning'));

  // 4. Surface warnings via this.warn (D-28).
  surfaceWarnings.call(this, warnings, filePath, source);

  return { code: result.code, map: result.map };
}

/**
 * React-target equivalent of runRoziePipeline. Returns the FULL
 * EmitReactResult so callers can branch into `.code`, `.css`, `.globalCss`,
 * or `.map` independently (the load hook needs all four for the four
 * virtual-id forms).
 */
function runReactPipeline(
  this: AnyContext,
  source: string,
  filePath: string,
  registry: ModifierRegistry,
  // Phase 26 (D-11) — the GLOBAL safe-interpolation opt-out. Defaults undefined
  // so the lowerer's effective-flag default (`?? true`) is exercised when
  // omitted (direct callers / tests stay byte-identical). Conditional-spread
  // into lowerToIR — NEVER pass `safeInterpolation: undefined`.
  safeInterpolation?: boolean,
): EmitReactResult {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    // Phase 54 — thread the producer resolver + host filename so the
    // `.rzts`/`.rzjs` inline pass (first step of lowerToIR) runs identically
    // to compile()/CLI at this build-tool entrypoint.
    ...partialInlineLowerOptions(filePath),
    ...(safeInterpolation !== undefined ? { safeInterpolation } : {}),
  });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 2.5. Phase 07.2 — thread producer paramTypes onto consumer SlotFillerDecl.
  // Mirrors compile.ts step 2.5. Skipping this would break dist-parity for
  // every consumer-scoped-fill cell × Leg 4 (unplugin). Surface threading
  // errors as warnings — ROZ947 mismatches should still ship the emit
  // (with paramTypes missing → degraded type-flow) rather than blocking
  // the build.
  const threadDiags: Diagnostic[] = [];
  threadParamTypesForPipeline(ir, filePath, registry, threadDiags);
  validateTwoWayBindingsForPipeline(ir, filePath, registry, threadDiags);
  // Phase 38 — ROZ088: flag scoped `<style>` rules whose subject is used only in
  // portal-fill content (silent Lit shadow-DOM regression). Runs after threading
  // so `filler.isPortal` is populated; reads no cache/resolver.
  validatePortalScopedStyle(ir, threadDiags);
  warnings.push(...threadDiags.filter((d) => d.severity === 'warning'));
  const threadErrors = threadDiags.filter((d) => d.severity === 'error');
  if (threadErrors.length > 0) {
    throw formatViteError(threadDiags, filePath, source);
  }

  // 3. emitReact
  // Phase 10 Plan 04 — splice compiled SCSS-to-CSS into the emitter source
  // (no-op for plain CSS) and re-derive block offsets to match. `parse()`
  // above still saw the original `source`.
  const { emitSource, blockOffsets } = emitSourceAndBlocks(source, ast, filePath);
  const result = emitReact(ir, {
    filename: filePath,
    source: emitSource,
    modifierRegistry: registry,
    blockOffsets,
  });
  const emitErrors = result.diagnostics.filter((d) => d.severity === 'error');
  if (emitErrors.length > 0) {
    throw formatViteError(emitErrors, filePath, source);
  }
  warnings.push(...result.diagnostics.filter((d) => d.severity === 'warning'));

  surfaceWarnings.call(this, warnings, filePath, source);

  return result;
}

/**
 * Svelte-target pipeline: parse → lowerToIR → emitSvelte. Returns
 * `{ code, map }` for the load/transform hooks. Mirrors runRoziePipeline
 * (Vue) — Svelte's emitter has a single output channel (one `.svelte` file
 * containing script + template + style), so no CSS-side branching like
 * React's runReactPipeline.
 */
function runSveltePipeline(
  this: AnyContext,
  source: string,
  filePath: string,
  registry: ModifierRegistry,
  // Phase 26 (D-11) — GLOBAL safe-interpolation opt-out (see runReactPipeline).
  safeInterpolation?: boolean,
): { code: string; map: EmitSvelteResult['map'] } {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    // Phase 54 — thread the producer resolver + host filename so the
    // `.rzts`/`.rzjs` inline pass (first step of lowerToIR) runs identically
    // to compile()/CLI at this build-tool entrypoint.
    ...partialInlineLowerOptions(filePath),
    ...(safeInterpolation !== undefined ? { safeInterpolation } : {}),
  });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 2.5. Phase 07.2 — thread producer paramTypes onto consumer SlotFillerDecl.
  // Mirrors compile.ts step 2.5. Skipping this would break dist-parity for
  // every consumer-scoped-fill cell × Leg 4 (unplugin). Surface threading
  // errors as warnings — ROZ947 mismatches should still ship the emit
  // (with paramTypes missing → degraded type-flow) rather than blocking
  // the build.
  const threadDiags: Diagnostic[] = [];
  threadParamTypesForPipeline(ir, filePath, registry, threadDiags);
  validateTwoWayBindingsForPipeline(ir, filePath, registry, threadDiags);
  // Phase 38 — ROZ088: flag scoped `<style>` rules whose subject is used only in
  // portal-fill content (silent Lit shadow-DOM regression). Runs after threading
  // so `filler.isPortal` is populated; reads no cache/resolver.
  validatePortalScopedStyle(ir, threadDiags);
  warnings.push(...threadDiags.filter((d) => d.severity === 'warning'));
  const threadErrors = threadDiags.filter((d) => d.severity === 'error');
  if (threadErrors.length > 0) {
    throw formatViteError(threadDiags, filePath, source);
  }

  // 3. emitSvelte
  // Phase 10 Plan 04 — splice compiled SCSS-to-CSS into the emitter source
  // (no-op for plain CSS) and re-derive block offsets to match. `parse()`
  // above still saw the original `source`.
  const { emitSource, blockOffsets } = emitSourceAndBlocks(source, ast, filePath);
  const result = emitSvelte(ir, {
    filename: filePath,
    source: emitSource,
    modifierRegistry: registry,
    blockOffsets,
  });
  const emitErrors = result.diagnostics.filter((d) => d.severity === 'error');
  if (emitErrors.length > 0) {
    throw formatViteError(emitErrors, filePath, source);
  }
  warnings.push(...result.diagnostics.filter((d) => d.severity === 'warning'));

  surfaceWarnings.call(this, warnings, filePath, source);

  return { code: result.code, map: result.map };
}

/**
 * Solid-target pipeline: parse → lowerToIR → emitSolid. Returns
 * `{ code, map }` for the load/transform hooks. Mirrors runSveltePipeline
 * (Svelte) — Solid's emitter has a single output channel (one `.tsx` file
 * containing the component function + inline styles), so no CSS-side
 * branching like React's runReactPipeline.
 *
 * Per RESEARCH Pitfall 3: no CSS sibling virtual ids — styles go inline.
 */
function runSolidPipeline(
  this: AnyContext,
  source: string,
  filePath: string,
  registry: ModifierRegistry,
  // Phase 26 (D-11) — GLOBAL safe-interpolation opt-out (see runReactPipeline).
  safeInterpolation?: boolean,
): { code: string; map: EmitSolidResult['map'] } {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    // Phase 54 — thread the producer resolver + host filename so the
    // `.rzts`/`.rzjs` inline pass (first step of lowerToIR) runs identically
    // to compile()/CLI at this build-tool entrypoint.
    ...partialInlineLowerOptions(filePath),
    ...(safeInterpolation !== undefined ? { safeInterpolation } : {}),
  });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 2.5. Phase 07.2 — thread producer paramTypes onto consumer SlotFillerDecl.
  // Mirrors compile.ts step 2.5. Skipping this would break dist-parity for
  // every consumer-scoped-fill cell × Leg 4 (unplugin). Surface threading
  // errors as warnings — ROZ947 mismatches should still ship the emit
  // (with paramTypes missing → degraded type-flow) rather than blocking
  // the build.
  const threadDiags: Diagnostic[] = [];
  threadParamTypesForPipeline(ir, filePath, registry, threadDiags);
  validateTwoWayBindingsForPipeline(ir, filePath, registry, threadDiags);
  // Phase 38 — ROZ088: flag scoped `<style>` rules whose subject is used only in
  // portal-fill content (silent Lit shadow-DOM regression). Runs after threading
  // so `filler.isPortal` is populated; reads no cache/resolver.
  validatePortalScopedStyle(ir, threadDiags);
  warnings.push(...threadDiags.filter((d) => d.severity === 'warning'));
  const threadErrors = threadDiags.filter((d) => d.severity === 'error');
  if (threadErrors.length > 0) {
    throw formatViteError(threadDiags, filePath, source);
  }

  // 3. emitSolid
  // Phase 10 Plan 04 — splice compiled SCSS-to-CSS into the emitter source
  // (no-op for plain CSS) and re-derive block offsets to match. `parse()`
  // above still saw the original `source`.
  const { emitSource, blockOffsets } = emitSourceAndBlocks(source, ast, filePath);
  const result = emitSolid(ir, {
    filename: filePath,
    source: emitSource,
    modifierRegistry: registry,
    blockOffsets,
  });
  const emitErrors = result.diagnostics.filter((d) => d.severity === 'error');
  if (emitErrors.length > 0) {
    throw formatViteError(emitErrors, filePath, source);
  }
  warnings.push(...result.diagnostics.filter((d) => d.severity === 'warning'));

  surfaceWarnings.call(this, warnings, filePath, source);

  return { code: result.code, map: result.map };
}

/**
 * Lit-target pipeline: parse → lowerToIR → emitLit. Returns `{ code, map }`
 * for the load/transform hooks. Mirrors runSolidPipeline (Solid) — Lit's
 * emitter has a single output channel (one `.ts` file containing the class
 * declaration with inline `static styles = css\`...\`` and inline
 * `html\`...\`` render body), so no CSS-side branching like
 * React's runReactPipeline.
 */
function runLitPipeline(
  this: AnyContext,
  source: string,
  filePath: string,
  registry: ModifierRegistry,
  // Phase 26 (D-11) — GLOBAL safe-interpolation opt-out (see runReactPipeline).
  safeInterpolation?: boolean,
): { code: string; map: EmitLitResult['map'] } {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    // Phase 54 — thread the producer resolver + host filename so the
    // `.rzts`/`.rzjs` inline pass (first step of lowerToIR) runs identically
    // to compile()/CLI at this build-tool entrypoint.
    ...partialInlineLowerOptions(filePath),
    ...(safeInterpolation !== undefined ? { safeInterpolation } : {}),
  });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 2.5. Phase 07.2 — thread producer paramTypes onto consumer SlotFillerDecl.
  // Mirrors compile.ts step 2.5. Skipping this would break dist-parity for
  // every consumer-scoped-fill cell × Leg 4 (unplugin). Surface threading
  // errors as warnings — ROZ947 mismatches should still ship the emit
  // (with paramTypes missing → degraded type-flow) rather than blocking
  // the build.
  const threadDiags: Diagnostic[] = [];
  threadParamTypesForPipeline(ir, filePath, registry, threadDiags);
  validateTwoWayBindingsForPipeline(ir, filePath, registry, threadDiags);
  // Phase 38 — ROZ088: flag scoped `<style>` rules whose subject is used only in
  // portal-fill content (silent Lit shadow-DOM regression). Runs after threading
  // so `filler.isPortal` is populated; reads no cache/resolver.
  validatePortalScopedStyle(ir, threadDiags);
  warnings.push(...threadDiags.filter((d) => d.severity === 'warning'));
  const threadErrors = threadDiags.filter((d) => d.severity === 'error');
  if (threadErrors.length > 0) {
    throw formatViteError(threadDiags, filePath, source);
  }

  // 3. emitLit
  // Phase 10 Plan 04 — splice compiled SCSS-to-CSS into the emitter source
  // (no-op for plain CSS) and re-derive block offsets to match. `parse()`
  // above still saw the original `source`.
  const { emitSource, blockOffsets } = emitSourceAndBlocks(source, ast, filePath);
  const result = emitLit(ir, {
    filename: filePath,
    source: emitSource,
    modifierRegistry: registry,
    blockOffsets,
  });
  const emitErrors = result.diagnostics.filter((d) => d.severity === 'error');
  if (emitErrors.length > 0) {
    throw formatViteError(emitErrors, filePath, source);
  }
  warnings.push(...result.diagnostics.filter((d) => d.severity === 'warning'));

  surfaceWarnings.call(this, warnings, filePath, source);

  return { code: result.code, map: result.map };
}

/**
 * Angular-target pipeline: parse → lowerToIR → emitAngular. Returns
 * `{ code, map }` for the load/transform hooks. Mirrors runSveltePipeline
 * (Svelte) — Angular's emitter has a single output channel (one `.ts` file
 * containing the standalone-component class with inline template + styles
 * array), so no CSS-side branching like React's runReactPipeline.
 *
 * Per Plan 05-03 SPIKE Path A: the returned `code` flows directly into
 * @analogjs/vite-plugin-angular's transform handler via Vite's plugin chain
 * (analogjs consumes the upstream `code` parameter rather than reading
 * from disk).
 */
function runAngularPipeline(
  this: AnyContext,
  source: string,
  filePath: string,
  registry: ModifierRegistry,
  // Phase 23 — Angular CVA opt-out. Defaults undefined so the emitter-side
  // `opts.cva ?? true` default-ON path is exercised when omitted (direct
  // callers / tests stay byte-identical). Threaded IDENTICALLY into the
  // disk-prebuild leg (runAngularEmitForDisk) so the two legs cannot diverge
  // (Pitfall 2).
  cva?: boolean,
  // Phase 26 (D-11) — GLOBAL safe-interpolation opt-out (see runReactPipeline).
  // Threaded into lowerToIR; INDEPENDENT of `cva` (which is an emitter option).
  safeInterpolation?: boolean,
): { code: string; map: EmitAngularResult['map'] } {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    // Phase 54 — thread the producer resolver + host filename so the
    // `.rzts`/`.rzjs` inline pass (first step of lowerToIR) runs identically
    // to compile()/CLI at this build-tool entrypoint.
    ...partialInlineLowerOptions(filePath),
    ...(safeInterpolation !== undefined ? { safeInterpolation } : {}),
  });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 2.5. Phase 07.2 — thread producer paramTypes onto consumer SlotFillerDecl.
  // Mirrors compile.ts step 2.5. Skipping this would break dist-parity for
  // every consumer-scoped-fill cell × Leg 4 (unplugin). Surface threading
  // errors as warnings — ROZ947 mismatches should still ship the emit
  // (with paramTypes missing → degraded type-flow) rather than blocking
  // the build.
  const threadDiags: Diagnostic[] = [];
  threadParamTypesForPipeline(ir, filePath, registry, threadDiags);
  validateTwoWayBindingsForPipeline(ir, filePath, registry, threadDiags);
  // Phase 38 — ROZ088: flag scoped `<style>` rules whose subject is used only in
  // portal-fill content (silent Lit shadow-DOM regression). Runs after threading
  // so `filler.isPortal` is populated; reads no cache/resolver.
  validatePortalScopedStyle(ir, threadDiags);
  warnings.push(...threadDiags.filter((d) => d.severity === 'warning'));
  const threadErrors = threadDiags.filter((d) => d.severity === 'error');
  if (threadErrors.length > 0) {
    throw formatViteError(threadDiags, filePath, source);
  }

  // 3. emitAngular
  // Phase 10 Plan 04 — splice compiled SCSS-to-CSS into the emitter source
  // (no-op for plain CSS) and re-derive block offsets to match. `parse()`
  // above still saw the original `source`.
  const { emitSource, blockOffsets } = emitSourceAndBlocks(source, ast, filePath);
  const result = emitAngular(ir, {
    filename: filePath,
    source: emitSource,
    modifierRegistry: registry,
    blockOffsets,
    // Phase 23 — conditional-spread the CVA opt-out (Vite-runtime leg).
    // MUST stay byte-identical to the disk-prebuild leg below.
    ...(cva !== undefined ? { cva } : {}),
  });
  const emitErrors = result.diagnostics.filter((d) => d.severity === 'error');
  if (emitErrors.length > 0) {
    throw formatViteError(emitErrors, filePath, source);
  }
  warnings.push(...result.diagnostics.filter((d) => d.severity === 'warning'));

  surfaceWarnings.call(this, warnings, filePath, source);

  return { code: result.code, map: result.map };
}

/**
 * D-70 disk-cache: eagerly emit each `*.rozie` file under `rootDir` to a
 * sibling `*.rozie.ts` file on disk so analogjs's TS Program (built from
 * `tsconfig.app.json`'s `include` patterns) picks them up.
 *
 * Why this is needed: Plan 05-03 SPIKE confirmed Path A works for analogjs's
 * `transform` hook in isolation (the handler consumes the upstream `code`
 * parameter), but the FULL AOT-emit pipeline calls `fileEmitter(id)` which
 * reads from a `Map<id, content>` populated by `performCompilation` walking
 * the TS Program. Synthetic non-filesystem `.rozie.ts` ids aren't on disk →
 * not in the TS Program → fileEmitter returns empty → consumer-side
 * `import default from './Foo.rozie'` fails at Rollup bind with `'"default"
 * is not exported by "src/Foo.rozie.ts"'`.
 *
 * The fix per D-70: write the synthesized `.rozie.ts` to disk before
 * analogjs's TS Program is constructed. This addresses the AOT-emit gap
 * without changing the resolveId / load chain semantics for non-Angular
 * targets.
 *
 * The on-disk `.rozie.ts` files are gitignored repo-wide so consumers don't
 * have to manage them.
 *
 * Quick task 260515-1y4 — `extraRoots` extends the walker BEYOND the single
 * Vite project root. Each extra root is `lstat`-checked first; symlinks are
 * skipped with a `console.warn` (no throw). Files DISCOVERED inside any
 * root may write their `.rozie.ts` siblings inside that root because the
 * trust-boundary in `emitRozieTsToDisk` is widened to the full union of
 * (rootDir + extraRoots).
 *
 * @param rootDir  — absolute path of the project root (Vite's resolvedConfig.root)
 * @param registry — modifier registry to feed into emitAngular
 * @param extraRoots — additional absolute paths to walk; defaults to `[]`
 * @returns array of absolute `.rozie` paths that were processed
 */
export function prebuildAngularRozieFiles(
  rootDir: string,
  registry: ModifierRegistry,
  extraRoots: readonly string[] = [],
  // Phase 23 — Angular CVA opt-out, forwarded to every emitRozieTsToDisk call
  // in the prebuild walk so the disk-cache leg honors cva:false uniformly.
  cva?: boolean,
): string[] {
  const processed: string[] = [];
  // Filter extraRoots: refuse symlinks / non-directories with a console.warn
  // (mirrors the in-tree symlink-skip in walkRozieFiles). NEVER throw — a bad
  // entry in the consumer's allowlist shouldn't kill the whole build.
  const safeExtraRoots: string[] = [];
  for (const root of extraRoots) {
    let st: ReturnType<typeof lstatSync>;
    try {
      st = lstatSync(root);
    } catch {
      // biome-ignore lint/suspicious/noConsole: build-time diagnostic
      console.warn(
        `[@rozie/unplugin] prebuildAngularRozieFiles: skipping extra root ${root} (does not exist)`,
      );
      continue;
    }
    if (st.isSymbolicLink()) {
      // biome-ignore lint/suspicious/noConsole: build-time diagnostic
      console.warn(
        `[@rozie/unplugin] prebuildAngularRozieFiles: skipping extra root ${root} (symlink — refused for trust-boundary safety)`,
      );
      continue;
    }
    if (!st.isDirectory()) {
      // biome-ignore lint/suspicious/noConsole: build-time diagnostic
      console.warn(
        `[@rozie/unplugin] prebuildAngularRozieFiles: skipping extra root ${root} (not a directory)`,
      );
      continue;
    }
    safeExtraRoots.push(root);
  }

  // Trust boundary widened to the full union — a file discovered under any
  // root may legally write its `.rozie.ts` sibling inside that root.
  const allowedRoots: readonly string[] = [rootDir, ...safeExtraRoots];

  for (const root of allowedRoots) {
    for (const roziePath of walkRozieFiles(root)) {
      try {
        emitRozieTsToDisk(roziePath, registry, allowedRoots, cva);
        processed.push(roziePath);
      } catch (err) {
        // Surface as a console warning rather than aborting the whole scan —
        // a single bad .rozie shouldn't prevent the rest of the project from
        // building. The actual transform of THIS file will throw at
        // request-time with a Vite-shaped error pointing at the source.
        const msg = err instanceof Error ? err.message : String(err);
        // biome-ignore lint/suspicious/noConsole: build-time diagnostic
        console.warn(`[@rozie/unplugin] prebuildAngularRozieFiles: failed to emit ${roziePath} → ${msg}`);
      }
    }
  }
  return processed;
}

/**
 * Synthesize the .rozie.ts for a single `.rozie` source file and write it
 * to disk. Used by both `prebuildAngularRozieFiles` (eager scan at
 * configResolved) and the HMR re-emit path (single-file update on .rozie
 * change).
 */
export function emitRozieTsToDisk(
  roziePath: string,
  registry: ModifierRegistry,
  rootDirOrAllowedRoots?: string | readonly string[],
  // Phase 23 — Angular CVA opt-out, forwarded to runAngularEmitForDisk.
  cva?: boolean,
): string {
  // When the third arg is supplied (configResolved + HMR paths), refuse writes
  // that would land outside ALL of the listed roots. Closes T-05-04b-03 +
  // WR-01/WR-07. The original D-70 plan assumed writes were sandboxed under
  // node_modules/.rozie-cache; the actual implementation writes alongside
  // the .rozie source, so this guard restores the equivalent trust posture.
  //
  // Quick task 260515-1y4 — the third arg can now be EITHER a single string
  // (back-compat: HMR + existing tests) OR an array of strings (cross-tree
  // prebuild allowlist). When an array, the file is allowed iff it lives
  // inside ANY ONE of the listed roots.
  if (rootDirOrAllowedRoots !== undefined) {
    const allowedRoots: readonly string[] =
      typeof rootDirOrAllowedRoots === 'string'
        ? [rootDirOrAllowedRoots]
        : rootDirOrAllowedRoots;
    if (allowedRoots.length > 0) {
      const allowed = allowedRoots.some((root) => {
        const rel = pathRelative(root, roziePath);
        return !rel.startsWith('..') && !isAbsolute(rel);
      });
      if (!allowed) {
        throw new Error(
          `@rozie/unplugin: refusing to emit .rozie.ts outside any allowed root: ${roziePath} (allowed: ${allowedRoots.join(', ')})`,
        );
      }
    }
  }
  const source = readFileSync(roziePath, 'utf8');
  const result = runAngularEmitForDisk(source, roziePath, registry, cva);

  // Phase 06.1 Plan 01 Pitfall 6 mitigation: analogjs's downstream transform
  // reads `.rozie.ts` from disk and produces its own sourcemap (it uses
  // `@swc/core` internally). Without an embedded source map on the on-disk
  // file, the sourcemap chain breaks at the analogjs link — stack traces
  // resolve to the .rozie.ts (a synthesized file) rather than the .rozie
  // source. Embedding our merged map as a `//# sourceMappingURL=data:...`
  // base64 trailer is the standard Vite-ecosystem pattern that analogjs (and
  // every modern build tool) reads automatically.
  //
  // CONTEXT D-70 + RESEARCH Pitfall 6 (Plan 06.1-01 must_haves truth #4).
  let codeWithMap = result.code;
  if (result.map) {
    const mapJson = JSON.stringify(result.map);
    const base64 = Buffer.from(mapJson, 'utf8').toString('base64');
    codeWithMap =
      result.code +
      `\n//# sourceMappingURL=data:application/json;base64,${base64}\n`;
  }

  const outPath = roziePath + '.ts';
  // Avoid an unnecessary write (and consequent fs.watch event) when the
  // emitted code is byte-identical to what's already on disk. This keeps
  // HMR snappy and prevents loops where Vite's chokidar picks up the write
  // and re-triggers a build.
  if (existsSync(outPath)) {
    const existing = readFileSync(outPath, 'utf8');
    if (existing === codeWithMap) {
      writeCrossRozieShimsFor(roziePath, result.components);
      return outPath;
    }
  }
  writeFileSync(outPath, codeWithMap, 'utf8');
  writeCrossRozieShimsFor(roziePath, result.components);
  return outPath;
}

/**
 * D-70 cross-rozie composition shim (Phase 06.2 follow-up).
 *
 * The Angular target's `rewriteRozieImport` produces extensionless imports
 * for cross-rozie composition: `<components>{ Counter }</components>`
 * → `import { Counter } from './Counter';` inside the prebuilt
 * `Foo.rozie.ts`. CLI codegen mode flat-emits `Counter.ts`, so the import
 * resolves naturally. But the unplugin's D-70 disk-cache uses
 * `Foo.rozie.ts` as the on-disk filename (chosen to avoid colliding with
 * consumer-authored `Foo.ts`), so TypeScript's module resolution can't
 * find `./Counter` at TS-Program-construction time. analogjs's NgCompiler
 * then falls back to runtime `__decorate` (JIT) for any component that
 * imports another rozie component, breaking AOT and producing the
 * "needs to be compiled using the JIT compiler" runtime error.
 *
 * Fix: when a `.rozie` file declares a `<components>` block, write a tiny
 * re-export shim `Counter.ts` next to `Counter.rozie.ts` for each
 * referenced target so TS can follow `./Counter` → `./Counter.ts` (shim)
 * → `./Counter.rozie` (the actual class). Bundlers tree-shake the shim
 * to zero bytes.
 *
 * Self-references (D-114 — the outer name routes via `tagKind:'self'` and
 * forwardRef, no cross-file import) are skipped.
 *
 * Defensive: never clobber a consumer-authored `Foo.ts`. Detection is by
 * marker-line presence on the first line of the existing file.
 */
const SHIM_MARKER = '// @rozie-cross-rozie-shim';
function writeCrossRozieShimsFor(
  importerRoziePath: string,
  components: ReadonlyArray<{ localName: string; importPath: string }>,
): void {
  if (components.length === 0) return;
  const importerDir = dirname(importerRoziePath);
  // The outer-name self-entry (D-114) appears in components but never needs
  // a shim because the same-file reference is handled via forwardRef.
  // Detect it by comparing localName to the importer's basename.
  const importerBase = importerRoziePath
    .slice(importerRoziePath.lastIndexOf('/') + 1)
    .replace(/\.rozie$/, '');
  for (const decl of components) {
    if (decl.localName === importerBase) continue;
    if (!decl.importPath.endsWith('.rozie')) continue;
    const targetRoziePath = pathResolve(importerDir, decl.importPath);
    if (!existsSync(targetRoziePath)) continue;
    writeShimAt(targetRoziePath);
  }
}

function writeShimAt(targetRoziePath: string): void {
  const baseName = targetRoziePath.slice(targetRoziePath.lastIndexOf('/') + 1); // Counter.rozie
  const stem = baseName.slice(0, -'.rozie'.length); // Counter
  const shimPath = pathJoin(dirname(targetRoziePath), `${stem}.ts`);
  const content =
    `${SHIM_MARKER}\n` +
    `// Auto-generated by @rozie/unplugin's prebuild for the Angular target.\n` +
    `// Re-export shim so TypeScript module resolution can find\n` +
    `// cross-rozie composition imports (e.g. \`import { ${stem} } from './${stem}'\`).\n` +
    `// Safe to delete — will be re-emitted by the unplugin's prebuild hook.\n` +
    `export * from './${baseName}';\n` +
    `export { default } from './${baseName}';\n`;
  if (existsSync(shimPath)) {
    const existing = readFileSync(shimPath, 'utf8');
    // Consumer-authored file detected — don't clobber.
    if (!existing.startsWith(SHIM_MARKER)) return;
    // Stale shim from a prior prebuild — overwrite only if content drifted.
    if (existing === content) return;
  }
  writeFileSync(shimPath, content, 'utf8');
}

/**
 * Pipeline-runner that doesn't require a Vite plugin context. Used by the
 * disk-cache helpers (which run during configResolved before any context
 * exists). Throws plain Errors on diagnostic failures rather than the
 * Vite-shaped errors used by the request-time pipeline.
 */
function runAngularEmitForDisk(
  source: string,
  filePath: string,
  registry: ModifierRegistry,
  // Phase 23 — Angular CVA opt-out (disk-prebuild leg). Threaded IDENTICALLY
  // to runAngularPipeline (Vite-runtime leg) so both legs are byte-equal.
  cva?: boolean,
): {
  code: string;
  map: EmitAngularResult['map'];
  components: ReadonlyArray<{ localName: string; importPath: string }>;
} {
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    const first = parseDiags.find((d) => d.severity === 'error');
    throw new Error(`[${first?.code ?? 'parse'}] ${first?.message ?? 'parse error'}`);
  }
  // Phase 54 — thread the producer resolver + host filename so the
  // `.rzts`/`.rzjs` inline pass runs IDENTICALLY to the Vite-runtime leg
  // (runAngularPipeline) and compile()/CLI; the two Angular legs cannot diverge.
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    ...partialInlineLowerOptions(filePath),
  });
  const irError = irDiags.find((d) => d.severity === 'error');
  if (!ir || irError) {
    throw new Error(`[${irError?.code ?? 'lower'}] ${irError?.message ?? 'lowering error'}`);
  }
  // Phase 07.2 Plan 03 — thread producer paramTypes onto consumer SlotFillerDecl.
  const threadDiags: Diagnostic[] = [];
  threadParamTypesForPipeline(ir, filePath, registry, threadDiags);
  validateTwoWayBindingsForPipeline(ir, filePath, registry, threadDiags);
  // Phase 38 — ROZ088: flag scoped `<style>` rules whose subject is used only in
  // portal-fill content (silent Lit shadow-DOM regression). Runs after threading
  // so `filler.isPortal` is populated; reads no cache/resolver.
  validatePortalScopedStyle(ir, threadDiags);
  const threadError = threadDiags.find((d) => d.severity === 'error');
  if (threadError) {
    throw new Error(`[${threadError.code}] ${threadError.message}`);
  }
  // Phase 10 Plan 04 — splice compiled SCSS-to-CSS into the emitter source
  // (no-op for plain CSS) and re-derive block offsets to match. `parse()`
  // above still saw the original `source`.
  const { emitSource, blockOffsets } = emitSourceAndBlocks(source, ast, filePath);
  const result = emitAngular(ir, {
    filename: filePath,
    source: emitSource,
    modifierRegistry: registry,
    blockOffsets,
    // Phase 23 — conditional-spread the CVA opt-out (disk-prebuild leg).
    // MUST stay byte-identical to the Vite-runtime leg in runAngularPipeline.
    ...(cva !== undefined ? { cva } : {}),
  });
  const emitError = result.diagnostics.find((d) => d.severity === 'error');
  if (emitError) {
    throw new Error(`[${emitError.code}] ${emitError.message}`);
  }
  return {
    code: result.code,
    map: result.map,
    components: ir.components.map((c) => ({
      localName: c.localName,
      importPath: c.importPath,
    })),
  };
}

/**
 * Recursive `*.rozie` walker. Skips common irrelevant directories
 * (node_modules, dist, .git, .turbo, .planning, test-results, etc.) so a
 * full project scan stays cheap even on large monorepos.
 *
 * Yields absolute paths.
 */
export function* walkRozieFiles(rootDir: string): Generator<string> {
  const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    '.git',
    '.turbo',
    '.vite',
    '.planning',
    '.next',
    '.cache',
    'test-results',
    'playwright-report',
    'coverage',
  ]);
  const stack: string[] = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith('.') && entry !== '.') {
        // Skip dotfiles/dotdirs except the root itself.
        if (SKIP_DIRS.has(entry)) continue;
      }
      const full = pathJoin(dir, entry);
      let st: ReturnType<typeof statSync>;
      try {
        // lstat (NOT stat) — refuse symlinks so an adversarial symlink inside
        // the project root cannot redirect the scan or the eventual D-70 disk
        // write to a location outside the project. Closes T-05-04b-03 + WR-01.
        st = lstatSync(full);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(entry)) continue;
        // Stop at package boundaries — when walking a cross-tree extra
        // root (e.g. the workspace's top-level `examples/`), don't recurse
        // into nested workspace packages (e.g. `examples/consumers/<demo>/`)
        // and pollute their `src/` with Angular `.rozie.ts` shims they
        // didn't ask for. Each consumer demo is its own pnpm-workspace
        // package with its own framework target, so its .rozie files are
        // owned by ITS own Vite plugin instance, not by the cross-tree
        // walker initiated from a sibling rig.
        try {
          if (lstatSync(pathJoin(full, 'package.json')).isFile()) continue;
        } catch {
          // No package.json — keep walking into this directory.
        }
        stack.push(full);
      } else if (st.isFile() && entry.endsWith('.rozie')) {
        yield full;
      }
    }
  }
}

/**
 * Surface diagnostic-warnings via `this.warn(...)` when a plugin context
 * is available. Guarded against null/undefined context — tests and direct
 * callers that invoke the hook function without a proper bundler context
 * will have this === undefined (strict mode); they should inspect
 * result.diagnostics directly.
 */
function surfaceWarnings(
  this: AnyContext,
  warnings: Diagnostic[],
  filePath: string,
  source: string,
): void {
  // Phase 2+ (semantic/IR/validator) diagnostics reach here with no filename
  // of their own — backfill the host file being compiled so every 6-target
  // pipeline surfaces an attributable warning (mirrors compile()'s stamping).
  stampMissingFilename(warnings, filePath);
  for (const w of warnings) {
    if (typeof this?.warn === 'function') {
      const loc = formatLoc(w.loc, filePath, source);
      this.warn({
        message: `[${w.code}] ${w.message}`,
        ...loc,
      });
    }
  }
}
