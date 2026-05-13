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
 * Plan 04-05 Task 2 — React branch (D-58):
 *   - Suffix `.rozie.tsx` for the JSX shell.
 *   - Sibling `Foo.rozie.module.css` and `Foo.rozie.global.css` virtual ids
 *     handled by separate load branches that run emitStyle and return only
 *     the CSS body (no map). Vite's CSS-Modules pipeline picks up the
 *     `.module.css` extension naturally and applies hashing — see
 *     04-05-SPIKE.md (Path 2) for the rationale.
 *   - The compiled `.tsx` body emits `import styles from './Foo.module.css'`
 *     (NOT `./Foo.rozie.module.css`) so the consumer's import path stays
 *     human-friendly. resolveId rewrites the `Foo.module.css` request back
 *     to the `Foo.rozie.module.css` virtual id when a sibling `.rozie` file
 *     exists at the importer's path.
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
import type { ModifierRegistry } from '../../core/src/modifiers/ModifierRegistry.js';
import { emitVue, type EmitVueResult } from '../../targets/vue/src/emitVue.js';
import { emitReact, type EmitReactResult } from '../../targets/react/src/emitReact.js';
import { emitSvelte, type EmitSvelteResult } from '../../targets/svelte/src/emitSvelte.js';
import { emitAngular, type EmitAngularResult } from '../../targets/angular/src/emitAngular.js';
import { emitSolid, type EmitSolidResult } from '../../targets/solid/src/emitSolid.js';
import { emitLit, type EmitLitResult } from '../../targets/lit/src/emitLit.js';
import type { Diagnostic } from '../../core/src/diagnostics/Diagnostic.js';
import type { TargetValue } from './options.js';
import { formatViteError, formatLoc } from './diagnostics.js';

/**
 * Synthetic suffix appended by Vue's resolveId. The downstream load hook
 * strips `.vue` to recover the underlying `.rozie` path.
 */
const VIRTUAL_SUFFIX_VUE = '.rozie.vue';

/**
 * React-target synthetic suffixes. The `.tsx` carries the JSX shell;
 * `.module.css` and `.global.css` carry the styles produced by emitStyle.
 */
const VIRTUAL_SUFFIX_REACT = '.rozie.tsx';
const VIRTUAL_SUFFIX_REACT_MODULE_CSS = '.rozie.module.css';
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
  return (
    id.endsWith(VIRTUAL_SUFFIX_VUE) ||
    id.endsWith(VIRTUAL_SUFFIX_REACT) || // VIRTUAL_SUFFIX_REACT === VIRTUAL_SUFFIX_SOLID by construction; both targets share the .rozie.tsx suffix.
    id.endsWith(VIRTUAL_SUFFIX_REACT_MODULE_CSS) ||
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
 *   React path uses `.rozie.tsx` plus sibling `.rozie.module.css` /
 *   `.rozie.global.css` rewrites.
 */
export function createResolveIdHook(
  target: TargetValue = 'vue',
): (id: string, importer: string | undefined) => string | null {
  if (target === 'angular') {
    return function resolveIdAngular(id: string, importer: string | undefined): string | null {
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
      // 1) Bare `.rozie` import → `<abs>/Foo.rozie.tsx`.
      if (id.endsWith('.rozie')) {
        const abs = absolutize(id, importer);
        return abs + '.tsx';
      }
      // 2) The compiled `.tsx` body emits `import styles from './Foo.module.css'`.
      //    Rewrite to the synthetic `.rozie.module.css` id ONLY when there is a
      //    sibling `.rozie` file on disk (so we don't clobber consumer-authored
      //    .module.css imports).
      if (id.endsWith('.module.css') && !id.endsWith(VIRTUAL_SUFFIX_REACT_MODULE_CSS)) {
        const abs = absolutize(id, importer);
        const base = abs.slice(0, -'.module.css'.length); // <abs>/Foo
        if (existsSync(base + '.rozie')) {
          return base + VIRTUAL_SUFFIX_REACT_MODULE_CSS;
        }
        return null;
      }
      // 3) Same dance for sibling `.global.css`.
      if (id.endsWith('.global.css') && !id.endsWith(VIRTUAL_SUFFIX_REACT_GLOBAL_CSS)) {
        const abs = absolutize(id, importer);
        const base = abs.slice(0, -'.global.css'.length);
        if (existsSync(base + '.rozie')) {
          return base + VIRTUAL_SUFFIX_REACT_GLOBAL_CSS;
        }
        return null;
      }
      // 4) Pass-through for the synthetic ids themselves and the query-form
      //    fallbacks — load handles them.
      if (
        id.endsWith(VIRTUAL_SUFFIX_REACT) ||
        id.endsWith(VIRTUAL_SUFFIX_REACT_MODULE_CSS) ||
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
export function createLoadHook(registry: ModifierRegistry, target: TargetValue = 'vue') {
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
      return runAngularPipeline.call(this, source, filePath, registry);
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
      return runSveltePipeline.call(this, source, filePath, registry);
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
      return runSolidPipeline.call(this, source, filePath, registry);
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
      return runLitPipeline.call(this, source, filePath, registry);
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

      // Module CSS path (file-extension form).
      if (bareId.endsWith(VIRTUAL_SUFFIX_REACT_MODULE_CSS)) {
        const filePath = bareId.slice(0, -VIRTUAL_SUFFIX_REACT_MODULE_CSS.length) + '.rozie';
        const source = readFileSync(filePath, 'utf8');
        const result = runReactPipeline.call(this, source, filePath, registry);
        return { code: result.css, map: null };
      }
      // Global CSS path.
      if (bareId.endsWith(VIRTUAL_SUFFIX_REACT_GLOBAL_CSS)) {
        const filePath = bareId.slice(0, -VIRTUAL_SUFFIX_REACT_GLOBAL_CSS.length) + '.rozie';
        const source = readFileSync(filePath, 'utf8');
        const result = runReactPipeline.call(this, source, filePath, registry);
        // No :root rules → return null so Vite emits no module (empty file
        // would cause an unnecessary import-side-effect noop).
        if (result.globalCss === undefined || result.globalCss === '') return null;
        return { code: result.globalCss, map: null };
      }
      // .tsx shell — also handles ?style=module / ?style=global query forms
      // by routing back through the CSS branches.
      if (bareId.endsWith(VIRTUAL_SUFFIX_REACT)) {
        const filePath = bareId.slice(0, -'.tsx'.length); // strip `.tsx` only — leaves `.rozie`
        const source = readFileSync(filePath, 'utf8');
        const result = runReactPipeline.call(this, source, filePath, registry);
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
export function createTransformHook(registry: ModifierRegistry, target: TargetValue = 'vue') {
  if (target === 'angular') {
    return function transformAngular(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitAngularResult['map'] } | null {
      return runAngularPipeline.call(this, code, id, registry);
    };
  }
  if (target === 'svelte') {
    return function transformSvelte(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitSvelteResult['map'] } | null {
      return runSveltePipeline.call(this, code, id, registry);
    };
  }
  if (target === 'solid') {
    return function transformSolid(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitSolidResult['map'] } | null {
      return runSolidPipeline.call(this, code, id, registry);
    };
  }
  if (target === 'lit') {
    return function transformLit(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitLitResult['map'] } | null {
      return runLitPipeline.call(this, code, id, registry);
    };
  }
  if (target === 'react') {
    return function transformReact(
      this: AnyContext,
      code: string,
      id: string,
    ): { code: string; map: EmitReactResult['map'] } | null {
      const result = runReactPipeline.call(this, code, id, registry);
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
  const { ir, diagnostics: irDiags } = lowerToIR(ast, { modifierRegistry: registry });
  // Surface parse-time warnings + IR-time warnings together
  const warnings: Diagnostic[] = [...parseDiags.filter((d) => d.severity === 'warning'), ...irDiags.filter((d) => d.severity === 'warning')];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 3. emitVue
  const result = emitVue(ir, {
    filename: filePath,
    source,
    modifierRegistry: registry,
    blockOffsets: ast.blocks,
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
): EmitReactResult {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, { modifierRegistry: registry });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 3. emitReact
  const result = emitReact(ir, {
    filename: filePath,
    source,
    modifierRegistry: registry,
    blockOffsets: ast.blocks,
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
): { code: string; map: EmitSvelteResult['map'] } {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, { modifierRegistry: registry });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 3. emitSvelte
  const result = emitSvelte(ir, {
    filename: filePath,
    source,
    modifierRegistry: registry,
    blockOffsets: ast.blocks,
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
): { code: string; map: EmitSolidResult['map'] } {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, { modifierRegistry: registry });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 3. emitSolid
  const result = emitSolid(ir, {
    filename: filePath,
    source,
    modifierRegistry: registry,
    blockOffsets: ast.blocks,
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
): { code: string; map: EmitLitResult['map'] } {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, { modifierRegistry: registry });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 3. emitLit
  const result = emitLit(ir, {
    filename: filePath,
    source,
    modifierRegistry: registry,
    blockOffsets: ast.blocks,
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
): { code: string; map: EmitAngularResult['map'] } {
  this?.addWatchFile?.(filePath);
  // 1. parse
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    throw formatViteError(parseDiags, filePath, source);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, { modifierRegistry: registry });
  const warnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
  ];
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    throw formatViteError(irDiags, filePath, source);
  }

  // 3. emitAngular
  const result = emitAngular(ir, {
    filename: filePath,
    source,
    modifierRegistry: registry,
    blockOffsets: ast.blocks,
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
 * @param rootDir  — absolute path of the project root (Vite's resolvedConfig.root)
 * @param registry — modifier registry to feed into emitAngular
 * @returns array of absolute `.rozie` paths that were processed
 */
export function prebuildAngularRozieFiles(
  rootDir: string,
  registry: ModifierRegistry,
): string[] {
  const processed: string[] = [];
  for (const roziePath of walkRozieFiles(rootDir)) {
    try {
      emitRozieTsToDisk(roziePath, registry, rootDir);
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
  rootDir?: string,
): string {
  // When rootDir is supplied (configResolved + HMR paths), refuse writes that
  // would land outside the project root. Closes T-05-04b-03 + WR-01/WR-07.
  // The original D-70 plan assumed writes were sandboxed under
  // node_modules/.rozie-cache; the actual implementation writes alongside
  // the .rozie source, so this guard restores the equivalent trust posture.
  if (rootDir) {
    const rel = pathRelative(rootDir, roziePath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(
        `@rozie/unplugin: refusing to emit .rozie.ts outside project root: ${roziePath} (root: ${rootDir})`,
      );
    }
  }
  const source = readFileSync(roziePath, 'utf8');
  const result = runAngularEmitForDisk(source, roziePath, registry);

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
  const { ir, diagnostics: irDiags } = lowerToIR(ast, { modifierRegistry: registry });
  const irError = irDiags.find((d) => d.severity === 'error');
  if (!ir || irError) {
    throw new Error(`[${irError?.code ?? 'lower'}] ${irError?.message ?? 'lowering error'}`);
  }
  const result = emitAngular(ir, {
    filename: filePath,
    source,
    modifierRegistry: registry,
    blockOffsets: ast.blocks,
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
function* walkRozieFiles(rootDir: string): Generator<string> {
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
