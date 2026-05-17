/**
 * compile() — Phase 6 public API entrypoint (DIST-01 / D-80).
 *
 * The single source of truth for `.rozie` → per-target compilation.
 * Consumed by:
 *   - `@rozie/unplugin` (Vite/Rollup/Webpack/etc plugin) — load hook
 *   - `@rozie/babel-plugin` (Webpack/Metro pipelines) — ImportDeclaration visitor
 *   - `@rozie/cli` (`rozie build`) — per (input × target) tuple dispatch
 *
 * Internal sequencing (D-80 / RESEARCH §"compile() Public API Surface"):
 *   1. parse(source, { filename })
 *   2. lowerToIR(ast, { modifierRegistry })
 *   3. switch (opts.target):
 *        case 'vue':     emitVue(ir, emitOpts)
 *        case 'react':   emitReact(ir, emitOpts) + emitReactTypes(ir) (Plan 06-02 D-84)
 *        case 'svelte':  emitSvelte(ir, emitOpts)
 *        case 'angular': emitAngular(ir, emitOpts)
 *
 * Per D-81 collected-not-thrown: NEVER throws on user input. Errors flow
 * through `result.diagnostics`. `code: ''`, `map: null`, `types: ''` on fatal.
 *
 * Per D-82: `opts.modifierRegistry` defaults to `createDefaultRegistry()`.
 * Per D-83: `opts.types` defaults true; `opts.sourceMap` defaults true.
 *
 * Per Pitfall 6 (RESEARCH.md): when `wantSourceMap === false`, set
 * `result.map = null` regardless of what the emitter computed. The
 * emitter still pays the compute cost — revisit in v2 if hot-path
 * benchmarks show pressure.
 *
 * Note on emit-target imports: per RESEARCH §"compile() skeleton" we use
 * RELATIVE imports into the sibling target packages (matching the existing
 * pattern at `packages/unplugin/src/transform.ts:40-43`). Importing via
 * `@rozie/target-vue` package name would create a circular dep
 * (target-vue depends on @rozie/core). The relative-path strategy is
 * already proven by `@rozie/unplugin` — `tsdown` inlines workspace siblings
 * when bundling.
 *
 * Note on emitReactTypes: imported from `@rozie/target-react`'s
 * `packages/targets/react/src/emit/emitTypes.ts` (Plan 06-02 D-84). Used
 * only for the React target — Vue/Svelte/Angular are inline-typed via
 * defineProps<T>(), $props<T>(), and @Input() decorators respectively, so
 * `result.types` stays `''` for those targets.
 */
import { parse } from './parse.js';
import { lowerToIR } from './ir/lower.js';
import { createDefaultRegistry } from './modifiers/registerBuiltins.js';
import type { Diagnostic } from './diagnostics/Diagnostic.js';
import type { ModifierRegistry } from './modifiers/ModifierRegistry.js';
import type { SourceMap } from 'magic-string';
// Phase 07.2 Plan 01 Task 3 — wire IRCache + ProducerResolver + threadParamTypes
// into the lowerToIR → per-target-emit pipeline so consumer-side SlotFillerDecl
// gets producer paramTypes threaded onto it before any emitter sees the IR.
import { IRCache } from './ir/cache.js';
import { ProducerResolver } from './resolver/index.js';
import { threadParamTypes } from './ir/threadParamTypes.js';
// Phase 07.3 Plan 02 — consumer-side two-way binding validator. Runs AFTER
// threadParamTypes so any producer IR fetched for paramTypes threading is
// already cached (lookup-order-independent, but threading errors fire first).
import { validateTwoWayBindings } from './ir/validateTwoWayBindings.js';

// Per-target imports use RELATIVE paths to avoid the `@rozie/target-*` →
// `@rozie/core` circular dep (mirrors @rozie/unplugin's transform.ts).
import { emitVue } from '../../targets/vue/src/emitVue.js';
import { emitReact } from '../../targets/react/src/emitReact.js';
import { emitReactTypes } from '../../targets/react/src/emit/emitTypes.js';
import { emitSvelte } from '../../targets/svelte/src/emitSvelte.js';
import { emitAngular } from '../../targets/angular/src/emitAngular.js';
import { emitSolid } from '../../targets/solid/src/emitSolid.js';
import { emitLit } from '../../targets/lit/src/emitLit.js';

export type CompileTarget = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';

/**
 * Options accepted by `compile()`.
 *
 * @public
 */
export interface CompileOptions {
  /** Required: the per-call target framework. */
  target: CompileTarget;
  /** Optional: filename label for diagnostics + source-map paths. */
  filename?: string;
  /**
   * Optional: a populated `ModifierRegistry`. When omitted, `compile()`
   * constructs `createDefaultRegistry()` (the 11 builtin impls) per call.
   */
  modifierRegistry?: ModifierRegistry;
  /** Default true. Set false to skip `.d.ts` emission (no-op for inline-typed targets). */
  types?: boolean;
  /** Default true. Set false to drop the SourceMap (emitter still pays the compute cost in v1 — Pitfall 6). */
  sourceMap?: boolean;
  /**
   * Phase 07.2 D-01 — optional pre-built per-compiler-instance IR cache. When
   * omitted, `compile()` builds a fresh per-call instance. Pass a shared cache
   * across multiple `compile()` calls (e.g., from `@rozie/unplugin`) to
   * amortize producer parse + lower across the consumer set.
   */
  irCache?: IRCache;
  /**
   * Phase 07.2 D-02 / D-12 — optional pre-built producer resolver. When
   * omitted, `compile()` builds a fresh per-call instance rooted at
   * `opts.resolverRoot ?? process.cwd()`.
   */
  resolver?: ProducerResolver;
  /**
   * Phase 07.2 D-02 / D-12 — root directory for tsconfig discovery. Defaults
   * to `process.cwd()`. Each entrypoint (CLI / unplugin / babel-plugin /
   * Vite-runtime) MUST derive this consistently from a single source of
   * truth to preserve byte-identical dist-parity (RESEARCH Pitfall 1).
   */
  resolverRoot?: string;
}

/**
 * Phase 06.2 P3 (D-120): metadata about a `.rozie` component declared in the
 * source's `<components>` block. Populated in source-order from
 * `IRComponent.components`. Empty array when the source has no
 * `<components>` block.
 *
 * Consumers (CLI, IDE plugin, babel-plugin) inspect this to resolve component
 * graphs without re-parsing the emitted `.code`.
 *
 * @public
 */
export interface ComponentDep {
  /** PascalCase identifier from the `<components>` key (e.g., 'Modal'). */
  localName: string;
  /** Verbatim `.rozie` import path from the `<components>` value (e.g., './Modal.rozie'). */
  importPath: string;
}

/**
 * Result returned by `compile()`. Always returned — never thrown (D-81).
 *
 * On fatal error: `code: ''`, `map: null`, `types: ''`, `diagnostics`
 * carries one or more `severity === 'error'` entries.
 *
 * @public
 */
export interface CompileResult {
  /** Emitted target source. Empty string when fatal error prevents emission. */
  code: string;
  /** SourceMap when `sourceMap !== false` and emitter produced one; otherwise null. */
  map: SourceMap | null;
  /** `.d.ts` text. Empty for inline-typed targets (Vue/Svelte/Angular). React-only per Plan 06-02 D-84. */
  types: string;
  /** React-only: scoped module CSS body for the sibling `.module.css` file. */
  css?: string;
  /** React-only: `:root`-scoped global CSS body for the sibling `.global.css` file. */
  globalCss?: string;
  /**
   * Phase 06.2 P3 (D-120): components declared via `<components>` block.
   * Source-order. Empty array when no `<components>` block. Optional for
   * forward-compat with pre-06.2 consumers.
   */
  componentDeps?: ComponentDep[];
  /** Collected diagnostics from parse, lower, and emit phases. */
  diagnostics: Diagnostic[];
}

/**
 * Compile a `.rozie` source into target-framework code + types + maps.
 *
 * @public — Phase 6 DIST-01 stable surface.
 *
 * @example
 *   const result = compile(source, { target: 'react', filename: 'Counter.rozie' });
 *   if (result.diagnostics.some((d) => d.severity === 'error')) {
 *     for (const d of result.diagnostics) console.error(renderDiagnostic(d, source));
 *     return;
 *   }
 *   writeFileSync('Counter.tsx', result.code);
 *   if (result.types) writeFileSync('Counter.d.ts', result.types);
 *   if (result.css)   writeFileSync('Counter.module.css', result.css);
 */
export function compile(source: string, opts: CompileOptions): CompileResult {
  const filename = opts.filename;
  const wantTypes = opts.types !== false;
  const wantSourceMap = opts.sourceMap !== false;
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  const fail = (diagnostics: Diagnostic[]): CompileResult => ({
    code: '',
    map: null,
    types: '',
    // Phase 06.2 P3 D-120: predictable empty array on fatal-error paths so
    // consumers can rely on the field being present (the optional `?` is
    // forward-compat for pre-06.2 consumers; new code can dot-into it).
    componentDeps: [],
    diagnostics,
  });

  // 1. parse
  // exactOptionalPropertyTypes:true — conditional spread on `filename` (Phase 1 convention).
  const { ast, diagnostics: parseDiags } = parse(
    source,
    filename !== undefined ? { filename } : {},
  );
  if (!ast || parseDiags.some((d) => d.severity === 'error')) {
    return fail(parseDiags);
  }

  // 2. lowerToIR
  const { ir, diagnostics: irDiags } = lowerToIR(ast, { modifierRegistry: registry });
  const acc: Diagnostic[] = [...parseDiags, ...irDiags];
  // Phase 07.3 Plan 02 — defer the irDiags-error gate until AFTER validators
  // run. lowerToIR may have surfaced an error (e.g. ROZ920 unknown component),
  // but the validators still produce useful diagnostics from the partial IR
  // (ROZ949/950/951 catch consumer-side two-way mistakes even on an unknown-
  // component element). Without this deferral the user sees only ROZ920 and
  // re-runs the compile to discover ROZ950 below it — the classic "fix one
  // error, hit the next" loop. Fail-fast still applies on a missing IR.
  if (!ir) {
    return fail(acc);
  }

  // 2.5. Phase 07.2 — thread producer paramTypes onto consumer SlotFillerDecl.
  // The cache + resolver are per-compiler-instance (D-01). Construct per-call
  // when callers don't pass pre-built ones. Output is a pure function of
  // (consumerSource, producerSource), not of cache-fill order (RESEARCH
  // Pitfall 2 — cache iteration order MUST NEVER drive emit decisions).
  const cache = opts.irCache ?? new IRCache({ modifierRegistry: registry });
  const resolver =
    opts.resolver ??
    new ProducerResolver({ root: opts.resolverRoot ?? process.cwd() });
  threadParamTypes(ir, filename ?? '<anonymous>', cache, resolver, acc);

  // 2.6. Phase 07.3 — validate consumer-side two-way bindings (r-model:propName=).
  // Pasted-line pattern after threadParamTypes (per 07.3-RESEARCH §A5 — runs
  // after threading so threading errors fire first; the shared cache means
  // producer IRs fetched during threading are reused here for free). Emits
  // ROZ949 (dual-frame producer prop lacks model:true), ROZ950 (shape error
  // — empty propName or non-component target), ROZ951 (RHS not a writable
  // lvalue per D-03), and ROZ945 (cross-package resolver miss) when needed.
  validateTwoWayBindings(ir, filename ?? '<anonymous>', cache, resolver, acc);

  // Gate on accumulated errors before emit. Both the deferred irDiags errors
  // (ROZ920 etc.) and any validator errors (ROZ947/949/950/951/945) block.
  // Emitters traverse the IR's AttributeBinding union and TypeScript
  // exhaustiveness requires per-target branches for kind: 'twoWayBinding'
  // (added in Wave 3); running an emitter on a ROZ949/950/951-flagged IR
  // would hit the unhandled-kind branch and throw, masking the validator's
  // diagnostics. Returning early surfaces them cleanly to callers.
  if (acc.some((d) => d.severity === 'error')) {
    return fail(acc);
  }

  // Phase 07.3 Plan 09 — the Wave-2 `hasTwoWayBinding` short-circuit guard
  // was removed here. All 6 target emitters (Wave 3 plans 07.3-03..08) now
  // ship `kind: 'twoWayBinding'` branches in their `emitTemplateAttribute`,
  // so the IR can reach the emitter directly. Keeping the guard caused
  // silent empty-output for the dogfood combination
  // (`model: true` prop + `r-model:open="$props.open"` forwarding pattern),
  // because the IR contains a valid twoWayBinding and the guard returned
  // early before any per-target branch could run.

  // 3. emit per target
  // Per Phase 1 convention: exactOptionalPropertyTypes:true requires conditional
  // spread on `filename` so we never pass `filename: undefined` into Emit*Options.
  const emitOpts = {
    source,
    modifierRegistry: registry,
    ...(filename !== undefined ? { filename } : {}),
  };

  // Phase 06.2 P3 D-120: project IRComponent.components (which is
  // ComponentDecl[] from the IR) onto the public ComponentDep[] surface.
  // Source-order preserved via the IR's Map insertion order. Empty when no
  // <components> block — the IR exposes [] in that case (P1 contract).
  const componentDeps: ComponentDep[] = ir.components.map((decl) => ({
    localName: decl.localName,
    importPath: decl.importPath,
  }));
  switch (opts.target) {
    case 'vue': {
      const r = emitVue(ir, emitOpts);
      return {
        code: r.code,
        map: wantSourceMap ? r.map : null,
        types: '', // D-84 inline-typed via defineProps<T>()
        componentDeps, // D-120
        diagnostics: [...acc, ...r.diagnostics],
      };
    }
    case 'react': {
      const r = emitReact(ir, emitOpts);
      // D-121: emitReactTypes accepts an optional linkedComponents map
      // (accepted-but-ignored in v1.0). v2 wire-up will pass it through here.
      const types = wantTypes ? emitReactTypes(ir) : '';
      const result: CompileResult = {
        code: r.code,
        map: wantSourceMap ? r.map : null,
        types,
        css: r.css,
        componentDeps, // D-120
        diagnostics: [...acc, ...r.diagnostics],
      };
      if (r.globalCss !== undefined) {
        result.globalCss = r.globalCss;
      }
      return result;
    }
    case 'svelte': {
      const r = emitSvelte(ir, emitOpts);
      return {
        code: r.code,
        map: wantSourceMap ? r.map : null,
        types: '', // D-84 inline-typed via $props<T>()
        componentDeps, // D-120
        diagnostics: [...acc, ...r.diagnostics],
      };
    }
    case 'angular': {
      const r = emitAngular(ir, emitOpts);
      return {
        code: r.code,
        map: wantSourceMap ? r.map : null,
        types: '', // D-84 inline-typed via @Input() decorators
        componentDeps, // D-120
        diagnostics: [...acc, ...r.diagnostics],
      };
    }
    case 'solid': {
      const r = emitSolid(ir, emitOpts);
      return {
        code: r.code,
        map: wantSourceMap ? r.map : null,
        types: '', // inline-typed via splitProps + TypeScript inference
        componentDeps, // D-120
        diagnostics: [...acc, ...r.diagnostics],
      };
    }
    case 'lit': {
      const r = emitLit(ir, emitOpts);
      return {
        code: r.code,
        map: wantSourceMap ? r.map : null,
        types: '', // inline-typed via @property decorators + TypeScript inference
        componentDeps, // D-120
        diagnostics: [...acc, ...r.diagnostics],
      };
    }
    default: {
      // Exhaustiveness check — TypeScript narrows opts.target to `never` here.
      // Runtime path: emit ROZ800 if a JS caller passes an invalid target.
      const target = opts.target as string;
      return fail([
        {
          code: 'ROZ800',
          severity: 'error',
          message: `unknown target '${target}' (expected vue|react|svelte|angular|solid|lit)`,
          loc: { start: 0, end: 0 },
        },
      ]);
    }
  }
}
