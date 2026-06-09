/**
 * Cross-component context primitive (Phase 36) — Solid.js target emitter.
 *
 * Lowers the author-side `$provide(key, value)` / `const x = $inject(key, fb?)`
 * sigils to Solid Context, backed by the globalThis-shared `rozieContext`
 * registry from `@rozie/runtime-solid` (plan 36-06):
 *
 *   $provide('theme', { get color() { return color() }, cycle })
 *     → const __ctx_theme = rozieContext('theme');           (component body)
 *       <__ctx_theme.Provider value={{ get color() {…}, cycle }}>…</__ctx_theme.Provider>
 *
 *   const theme = $inject('theme')
 *     → const theme = useContext(rozieContext('theme'));
 *
 *   const theme = $inject('theme', defaultTheme)
 *     → const theme = useContext(rozieContext('theme')) ?? defaultTheme;
 *
 * The Provider WRAP itself is applied in `shell.ts` (the `return ( … )` JSX
 * assembly seam) — this emitter only produces the strings the shell splices
 * (`contextDecls`, `injectLines`, `providerOpen`, `providerClose`), mirroring
 * the React emitContext.
 *
 * Solid reactivity (D-3 / REQ-29): reactivity rides the SIGNAL ACCESSOR carried
 * in the provided value — NO useMemo / recompute needed (unlike React). The
 * provided value must carry signal accessors (e.g. a live getter
 * `{ get color() { return color() } }`), never a snapshotted primitive; the
 * consumer reads the live getter which re-invokes the accessor inside its own
 * reactive scope. Snapshotting a primitive into the value kills reactivity on
 * ALL six targets (RESEARCH Pitfall, D-3) — an authoring contract, not a
 * Solid-emit limitation. The value expression is therefore emitted INLINE into
 * `value={…}`.
 *
 * Empty-gate (R12 / D-5): when the component has no `$provide`/`$inject`, this
 * returns an all-empty struct with `hasContext: false`; emitScript appends
 * nothing and the shell skips the Provider wrap — every existing (non-context)
 * Solid fixture stays byte-identical.
 *
 * The IR's `ProvideDecl.valueExpr` / `InjectDecl.fallbackExpr` reference the
 * ORIGINAL (un-rewritten) script AST. To pick up `$data`/`$props`/`$refs`
 * rewrites (e.g. a provided getter that reads `$data.color`), this emitter
 * reads the value/fallback expressions back from the CLONED (post-rewrite)
 * program — mirroring the React/Vue/Svelte emitContext.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type {
  SolidImportCollector,
  RuntimeSolidImportCollector,
} from '../rewrite/collectSolidImports.js';

// CJS interop normalization for @babel/generator default export (mirrors emitScript).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
}

export interface ContextEmit {
  /** True when the component has at least one `$provide`/`$inject`. */
  hasContext: boolean;
  /** True when the component has at least one `$provide` (the JSX Provider wrap). */
  hasProvides: boolean;
  /**
   * `const __ctx_<key> = rozieContext('<key>');` lines, in source order.
   * Emitted into the component body BEFORE `return (` so the
   * `<__ctx_<key>.Provider>` tag the shell splices resolves the const.
   */
  contextDecls: string[];
  /**
   * `const <local> = useContext(rozieContext('<key>'))[ ?? fb];` binder lines,
   * in source order.
   */
  injectLines: string[];
  /**
   * `<__ctx_<key>.Provider value={<valueExpr>}>` open tags, OUTERMOST key
   * first. Empty when no `$provide`.
   */
  providerOpen: string[];
  /**
   * `</__ctx_<key>.Provider>` close tags, in REVERSE order so the nesting
   * balances against `providerOpen`. Empty when no `$provide`.
   */
  providerClose: string[];
}

const EMPTY: ContextEmit = {
  hasContext: false,
  hasProvides: false,
  contextDecls: [],
  injectLines: [],
  providerOpen: [],
  providerClose: [],
};

/** Sanitize a context key into a valid JS identifier suffix for `__ctx_<id>`. */
function ctxIdent(key: string): string {
  const safe = key.replace(/[^A-Za-z0-9_$]/g, '_');
  return `__ctx_${safe}`;
}

/**
 * Read the rewritten `$provide(...)` value arguments + `$inject(...)` binders
 * back from the cloned (post-rewrite) Program, in source order so the emitted
 * output picks up `$data`/`$props`/`$refs` → Solid-signal rewrites.
 */
function readClonedContext(clonedProgram: t.File): {
  provideValues: { key: string; valueArg: t.Expression }[];
  injectBinders: {
    localName: string;
    key: string;
    fallbackArg?: t.Expression;
  }[];
} {
  const provideValues: { key: string; valueArg: t.Expression }[] = [];
  const injectBinders: {
    localName: string;
    key: string;
    fallbackArg?: t.Expression;
  }[] = [];

  for (const stmt of clonedProgram.program.body) {
    // $provide('k', v) — a top-level ExpressionStatement CallExpression.
    if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
      const call = stmt.expression;
      if (
        t.isIdentifier(call.callee) &&
        call.callee.name === '$provide' &&
        call.arguments.length >= 2 &&
        t.isStringLiteral(call.arguments[0]) &&
        t.isExpression(call.arguments[1]!)
      ) {
        provideValues.push({
          key: (call.arguments[0] as t.StringLiteral).value,
          valueArg: call.arguments[1] as t.Expression,
        });
      }
      continue;
    }
    // const x = $inject('k', f?) — a top-level VariableDeclaration declarator.
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        if (!t.isIdentifier(d.id)) continue;
        if (!d.init || !t.isCallExpression(d.init)) continue;
        if (!t.isIdentifier(d.init.callee) || d.init.callee.name !== '$inject') continue;
        const keyArg = d.init.arguments[0];
        if (!keyArg || !t.isStringLiteral(keyArg)) continue;
        const fallbackArg = d.init.arguments[1];
        injectBinders.push({
          localName: d.id.name,
          key: keyArg.value,
          ...(fallbackArg && t.isExpression(fallbackArg) ? { fallbackArg } : {}),
        });
      }
    }
  }
  return { provideValues, injectBinders };
}

/**
 * Emit Solid `rozieContext`-backed context for the primitive.
 *
 * @param ir              the component IR (gates on `provides`/`injects`).
 * @param collectors      the `solid` + `runtime` import collectors. `useContext`
 *                        is added to `solid`; `rozieContext` to `runtime`.
 * @param clonedProgram   the post-rewrite cloned Program (so provided values +
 *                        inject fallbacks pick up `$data`/`$props` rewrites).
 */
export function emitContext(
  ir: IRComponent,
  collectors: {
    solid: SolidImportCollector;
    runtime: RuntimeSolidImportCollector;
  },
  clonedProgram: t.File,
): ContextEmit {
  // R12 / D-5 empty-gate — byte-identical-when-empty for all existing fixtures.
  // The `?? []` tolerates legacy hand-built IRComponent test literals that
  // predate the Phase 36 `provides`/`injects` fields (the real parse→lower
  // pipeline always populates them to `[]`); for those the gate trips and no
  // context text is emitted — identical to today.
  const provides = ir.provides ?? [];
  const injects = ir.injects ?? [];
  if (provides.length === 0 && injects.length === 0) {
    return EMPTY;
  }

  const { provideValues, injectBinders } = readClonedContext(clonedProgram);

  const contextDecls: string[] = [];
  const injectLines: string[] = [];
  const providerOpen: string[] = [];
  const providerClose: string[] = [];

  if (injectBinders.length > 0) {
    collectors.solid.add('useContext');
    collectors.runtime.add('rozieContext');
    for (const b of injectBinders) {
      const read = `useContext(rozieContext('${b.key}'))`;
      if (b.fallbackArg) {
        // Solid's useContext has no native default arg; emit a nullish-coalesce
        // fallback so a missing provider yields the author's default value.
        injectLines.push(`const ${b.localName} = ${read} ?? ${genCode(b.fallbackArg)};`);
      } else {
        injectLines.push(`const ${b.localName} = ${read};`);
      }
    }
  }

  if (provideValues.length > 0) {
    collectors.runtime.add('rozieContext');
    for (const p of provideValues) {
      const ident = ctxIdent(p.key);
      contextDecls.push(`const ${ident} = rozieContext('${p.key}');`);
      // Reactivity rides the signal accessor carried in the provided value
      // (D-3) — the value is emitted inline; no useMemo/recompute (Solid has no
      // re-render to chase).
      providerOpen.push(`<${ident}.Provider value={${genCode(p.valueArg)}}>`);
      providerClose.unshift(`</${ident}.Provider>`);
    }
  }

  return {
    hasContext: true,
    hasProvides: provideValues.length > 0,
    contextDecls,
    injectLines,
    providerOpen,
    providerClose,
  };
}
