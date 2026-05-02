/**
 * @rozie/unplugin transform / load / resolveId hooks.
 *
 * Per D-25 amendment (Plan 06 Wave 0 spike): we use the path-virtual chain.
 *   - resolveId: rewrites `Foo.rozie` → `<abs>/Foo.rozie.vue` (synthetic .vue suffix)
 *   - load: reads the underlying `.rozie`, runs parse → lowerToIR → emitVue,
 *     returns the .vue source so vite-plugin-vue's transformInclude (default
 *     `/\.vue$/`) matches the synthetic id and processes it naturally.
 *   - The `transform` hook is exported for direct use (tests + symmetry with
 *     Plan 02-04 ScriptInjection split), but production wiring uses load.
 *
 * Errors throw Vite-shaped objects with `loc`, `frame`, `plugin`, `code` per
 * D-28 — Vite's dev-overlay renders them with the offending .rozie line
 * highlighted. Non-fatal warnings call `this.warn(...)`.
 *
 * @experimental — shape may change before v1.0
 */

import { readFileSync } from 'node:fs';
import { isAbsolute, resolve as pathResolve, dirname } from 'node:path';
import { parse } from '../../core/src/parse.js';
import { lowerToIR } from '../../core/src/ir/lower.js';
import type { ModifierRegistry } from '../../core/src/modifiers/ModifierRegistry.js';
import { emitVue, type EmitVueResult } from '../../targets/vue/src/emitVue.js';
import type { Diagnostic } from '../../core/src/diagnostics/Diagnostic.js';
import { formatViteError, formatLoc } from './diagnostics.js';

/**
 * Synthetic suffix appended by resolveId. The downstream load hook strips
 * `.vue` to recover the underlying `.rozie` path. vite-plugin-vue's default
 * transformInclude (`/\.vue$/`) matches the synthetic id naturally.
 */
const VIRTUAL_SUFFIX = '.rozie.vue';

/**
 * transformInclude predicate — matches synthetic .rozie.vue ids only. Bare
 * `.rozie` ids are intercepted by resolveId; vite-plugin-vue handles `.vue`.
 */
export function transformIncludeRozie(id: string): boolean {
  return id.endsWith(VIRTUAL_SUFFIX);
}

/**
 * Subset of unplugin/Vite's plugin-context shape we use. The real types are
 * `UnpluginBuildContext & UnpluginContext` from unplugin which is more
 * specific than we need; we accept any context that exposes `.warn(msg)`.
 * Tests pass `{ warn: vi.fn() }` stubs.
 */

/**
 * resolveId hook (path-virtual): rewrites bare `.rozie` ids to absolute
 * `<path>.rozie.vue` synthetic ids. Returns null for non-.rozie ids.
 */
export function createResolveIdHook(): (id: string, importer: string | undefined) => string | null {
  return function resolveId(id: string, importer: string | undefined): string | null {
    if (!id.endsWith('.rozie')) return null;
    let abs: string;
    if (isAbsolute(id)) {
      abs = id;
    } else if (importer) {
      abs = pathResolve(dirname(importer), id);
    } else {
      abs = pathResolve(id);
    }
    return abs + '.vue';
  };
}

/**
 * load hook: reads the underlying `.rozie` file (id is the synthetic
 * `<abs>.rozie.vue`), runs parse → lowerToIR → emitVue, returns the .vue
 * source + source map. Throws Vite-shaped errors on parse / lowering /
 * emission failures; calls `this.warn` on non-fatal warnings.
 */
// biome-ignore lint/suspicious/noExplicitAny: unplugin/Vite plugin-context shape varies; we only call .warn().
type AnyContext = any;

export function createLoadHook(registry: ModifierRegistry) {
  return function load(this: AnyContext, id: string): { code: string; map: EmitVueResult['map'] } | null {
    if (!id.endsWith(VIRTUAL_SUFFIX)) return null;
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
export function createTransformHook(registry: ModifierRegistry) {
  return function transform(this: AnyContext, code: string, id: string): { code: string; map: EmitVueResult['map'] } | null {
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
  const result = emitVue(ir, { filename: filePath, source, modifierRegistry: registry });
  const emitErrors = result.diagnostics.filter((d) => d.severity === 'error');
  if (emitErrors.length > 0) {
    throw formatViteError(emitErrors, filePath, source);
  }
  warnings.push(...result.diagnostics.filter((d) => d.severity === 'warning'));

  // 4. Surface warnings via this.warn (D-28).
  // Guard against null/undefined context — tests and direct callers that invoke
  // the hook function without a proper bundler context will have this === undefined
  // (strict mode) or the global object (sloppy). Callers in those scenarios should
  // inspect result.diagnostics directly.
  for (const w of warnings) {
    if (typeof this?.warn === 'function') {
      const loc = formatLoc(w.loc, filePath, source);
      this.warn({
        message: `[${w.code}] ${w.message}`,
        ...loc,
      });
    }
  }

  return { code: result.code, map: result.map };
}
