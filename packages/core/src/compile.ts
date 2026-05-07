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
// Per-target imports use RELATIVE paths to avoid the `@rozie/target-*` →
// `@rozie/core` circular dep (mirrors @rozie/unplugin's transform.ts).
import { emitVue } from '../../targets/vue/src/emitVue.js';
import { emitReact } from '../../targets/react/src/emitReact.js';
import { emitReactTypes } from '../../targets/react/src/emit/emitTypes.js';
import { emitSvelte } from '../../targets/svelte/src/emitSvelte.js';
import { emitAngular } from '../../targets/angular/src/emitAngular.js';
import { emitSolid } from '../../targets/solid/src/emitSolid.js';

export type CompileTarget = 'vue' | 'react' | 'svelte' | 'angular' | 'solid';

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
  if (!ir || irDiags.some((d) => d.severity === 'error')) {
    return fail(acc);
  }

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
    default: {
      // Exhaustiveness check — TypeScript narrows opts.target to `never` here.
      // Runtime path: emit ROZ800 if a JS caller passes an invalid target.
      const target = opts.target as string;
      return fail([
        {
          code: 'ROZ800',
          severity: 'error',
          message: `unknown target '${target}' (expected vue|react|svelte|angular|solid)`,
          loc: { start: 0, end: 0 },
        },
      ]);
    }
  }
}
