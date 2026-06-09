/**
 * Cross-component context primitive (Phase 36) — Vue-target emitter.
 *
 * Lowers the author-side `$provide(key, value)` / `const x = $inject(key, fb?)`
 * sigils to Vue's native `provide`/`inject` runtime API (imported from `'vue'`):
 *
 *   $provide('theme', { get color() { return color }, cycle })
 *     → provide('theme', { get color() { return color }, cycle });
 *
 *   const theme = $inject('theme')
 *     → const theme = inject('theme');
 *
 *   const theme = $inject('theme', defaultTheme)
 *     → const theme = inject('theme', defaultTheme);
 *
 * Vue is the REFERENCE target: the string key IS the native injection token
 * (no globalThis registry, no Symbol indirection — D-1), and the provided
 * value carries live refs/reactive objects natively, so reactivity-at-depth
 * (D-3 / REQ-29) is free. The other five targets mirror this emitter's
 * IR→emit wiring shape into their own provide/inject idiom.
 *
 * Empty-gate (R12 / D-5): when the component has no `$provide`/`$inject`, this
 * returns an all-empty struct with `hasContext: false` and emitScript appends
 * nothing — every existing (non-context) Vue fixture stays byte-identical.
 *
 * The IR's `ProvideDecl.valueExpr` / `InjectDecl.fallbackExpr` reference the
 * ORIGINAL (un-rewritten) script AST. To pick up `$data`/`$props`/`$refs`
 * rewrites (e.g. a provided getter that reads `$data.color`), this emitter
 * reads the value/fallback expressions back from the CLONED (post-rewrite)
 * program — mirroring `emitComputedDecls`/`findClonedComputedBodies`.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { VueImportCollector } from '../rewrite/collectVueImports.js';

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
  /**
   * `const x = inject('key'[, fallback]);` binder lines, in source order.
   * Spliced AFTER the preamble (refs/computed) and BEFORE the residual body
   * so consumer code + template can reference the injected `const`.
   */
  injectLines: string[];
  /**
   * `provide('key', value);` call lines, in source order. Spliced AFTER the
   * preamble (the provided value references `$data`/`$computed` refs declared
   * there) — provide-then-children mount order is what Vue requires.
   */
  provideLines: string[];
}

const EMPTY: ContextEmit = { hasContext: false, injectLines: [], provideLines: [] };

/**
 * Read the rewritten `$provide(...)` value arguments + `$inject(...)` binders
 * back from the cloned (post-rewrite) Program, keyed by source order so the
 * emitted output picks up `$data`/`$props`/`$refs` → ref/`.value` rewrites.
 *
 * Two collections:
 *   - provideValues: the 2nd arg expression of each top-level `$provide(k, v)`
 *     ExpressionStatement, in source order.
 *   - injectBinders: `{ localName, keyArg, fallbackArg? }` for each top-level
 *     `const x = $inject(k, f?)` VariableDeclarator, in source order.
 */
function readClonedContext(clonedProgram: t.File): {
  provideValues: { keyArg: t.Expression; valueArg: t.Expression }[];
  injectBinders: {
    localName: string;
    keyArg: t.Expression;
    fallbackArg?: t.Expression;
  }[];
} {
  const provideValues: { keyArg: t.Expression; valueArg: t.Expression }[] = [];
  const injectBinders: {
    localName: string;
    keyArg: t.Expression;
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
        t.isExpression(call.arguments[0]!) &&
        t.isExpression(call.arguments[1]!)
      ) {
        provideValues.push({
          keyArg: call.arguments[0] as t.Expression,
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
        if (!keyArg || !t.isExpression(keyArg)) continue;
        const fallbackArg = d.init.arguments[1];
        injectBinders.push({
          localName: d.id.name,
          keyArg,
          ...(fallbackArg && t.isExpression(fallbackArg) ? { fallbackArg } : {}),
        });
      }
    }
  }
  return { provideValues, injectBinders };
}

/**
 * Emit Vue native `provide`/`inject` for the context primitive.
 *
 * @param ir              the component IR (gates on `provides`/`injects`).
 * @param imports         the `'vue'` import collector (adds `provide`/`inject`).
 * @param clonedProgram   the post-rewrite cloned Program (so provided values +
 *                        inject fallbacks pick up `$data`/`$props` rewrites).
 */
export function emitContext(
  ir: IRComponent,
  imports: VueImportCollector,
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

  const injectLines: string[] = [];
  const provideLines: string[] = [];

  if (injectBinders.length > 0) {
    imports.use('inject');
    for (const b of injectBinders) {
      const keyCode = genCode(b.keyArg);
      if (b.fallbackArg) {
        injectLines.push(
          `const ${b.localName} = inject(${keyCode}, ${genCode(b.fallbackArg)});`,
        );
      } else {
        injectLines.push(`const ${b.localName} = inject(${keyCode});`);
      }
    }
  }

  if (provideValues.length > 0) {
    imports.use('provide');
    for (const p of provideValues) {
      provideLines.push(`provide(${genCode(p.keyArg)}, ${genCode(p.valueArg)});`);
    }
  }

  return { hasContext: true, injectLines, provideLines };
}
