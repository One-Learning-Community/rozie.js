/**
 * Cross-component context primitive (Phase 36) — Svelte 5 target emitter.
 *
 * Lowers the author-side `$provide(key, value)` / `const x = $inject(key, fb?)`
 * sigils to Svelte's native `setContext`/`getContext` runtime API (imported
 * from `'svelte'`):
 *
 *   $provide('theme', { get color() { return color }, cycle })
 *     → setContext('theme', { get color() { return color }, cycle });
 *
 *   const theme = $inject('theme')
 *     → const theme = getContext('theme');
 *
 *   const theme = $inject('theme', defaultTheme)
 *     → const theme = getContext('theme') ?? defaultTheme;
 *
 * CRITICAL (REQ-32 / Pitfall 5): both `setContext` and `getContext` MUST be
 * called during component INIT — the scope where `$state`/`$derived`
 * declarations land — NEVER inside `onMount` or any other lifecycle callback.
 * Svelte throws "Function called outside component initialization" otherwise.
 * emitScript.ts therefore splices the inject binders into the preamble (with
 * `$state`/`$derived`) and the provide calls into the init body AFTER the
 * residual (so the provided value may reference residual-declared helpers) but
 * still BEFORE the `onMount`/`$effect` lifecycle blocks.
 *
 * Like Vue, Svelte uses the string key as the native context key (no
 * globalThis registry, no Symbol indirection — D-1), and a provided value
 * carrying a live getter over `$state` (or a `$state`-backed object) gives
 * reactivity-at-depth (D-3 / REQ-29) for free — the consumer reads the live
 * getter, not a snapshot.
 *
 * Empty-gate (R12 / D-5): when the component has no `$provide`/`$inject`, this
 * returns an all-empty struct with `hasContext: false` and emitScript appends
 * nothing — every existing (non-context) Svelte fixture stays byte-identical.
 *
 * The IR's `ProvideDecl.valueExpr` / `InjectDecl.fallbackExpr` reference the
 * ORIGINAL (un-rewritten) script AST. To pick up `$data`/`$props`/`$refs`
 * rewrites (e.g. a provided getter that reads `$data.color`), this emitter
 * reads the value/fallback expressions back from the CLONED (post-rewrite)
 * program — mirroring `findClonedComputedBodies` in emitScript.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { computeTsCastWrapText, unwrapTsCast } from '../../../../core/src/ast/unwrapTsCast.js';

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
   * `const x = getContext('key')[ ?? fallback];` binder lines, in source
   * order. Spliced into the preamble (where `$state`/`$derived` land) and
   * BEFORE the residual body — at component INIT scope (REQ-32) so consumer
   * code + the template can reference the injected `const`.
   */
  injectLines: string[];
  /**
   * `setContext('key', value);` call lines, in source order. Spliced AFTER the
   * residual body (the provided value may reference residual-declared helpers)
   * but BEFORE the lifecycle (`onMount`/`$effect`) blocks — still at component
   * INIT scope (REQ-32), never inside a lifecycle callback.
   */
  provideLines: string[];
  /**
   * `'svelte'` value imports this emit needs (`setContext`/`getContext`).
   * Folded into emitScript's `valueImports` set so the single `'svelte'`
   * import line carries them alongside `onMount`/`untrack`. Empty when
   * `hasContext` is false.
   */
  svelteImports: string[];
}

const EMPTY: ContextEmit = {
  hasContext: false,
  injectLines: [],
  provideLines: [],
  svelteImports: [],
};

/**
 * Read the rewritten `$provide(...)` value arguments + `$inject(...)` binders
 * back from the cloned (post-rewrite) Program, keyed by source order so the
 * emitted output picks up `$data`/`$props`/`$refs` rewrites (e.g. a provided
 * getter that reads `$data.color` lands as a getter over the `$state` `let`).
 */
function readClonedContext(clonedProgram: t.File): {
  provideValues: { keyArg: t.Expression; valueArg: t.Expression }[];
  injectBinders: {
    localName: string;
    keyArg: t.Expression;
    fallbackArg?: t.Expression;
    castPrefix: string;
    castSuffix: string;
  }[];
} {
  const provideValues: { keyArg: t.Expression; valueArg: t.Expression }[] = [];
  const injectBinders: {
    localName: string;
    keyArg: t.Expression;
    fallbackArg?: t.Expression;
    castPrefix: string;
    castSuffix: string;
  }[] = [];

  for (const stmt of clonedProgram.program.body) {
    // $provide('k', v) — a top-level ExpressionStatement CallExpression.
    // ROZ131 cast-blindness fix — unwrap `stmt.expression` through any TS
    // wrapper (`as void` etc.) before the CallExpression check, so a
    // cast-wrapped `$provide(...)` statement is still emitted.
    if (t.isExpressionStatement(stmt) && t.isCallExpression(unwrapTsCast(stmt.expression))) {
      const call = unwrapTsCast(stmt.expression) as t.CallExpression;
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
    // ROZ132 cast-blindness fix — `d.init` may be a TS wrapper (`as T` / `!` /
    // `satisfies T` / `<T>`) around the real `$inject(...)` call; unwrap before
    // the CallExpression check, and re-apply the SAME wrapper text around the
    // emitted read (castPrefix/castSuffix) so the author's type survives.
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        if (!t.isIdentifier(d.id)) continue;
        if (!d.init) continue;
        const call = unwrapTsCast(d.init);
        if (!t.isCallExpression(call)) continue;
        if (!t.isIdentifier(call.callee) || call.callee.name !== '$inject') continue;
        const keyArg = call.arguments[0];
        if (!keyArg || !t.isExpression(keyArg)) continue;
        const fallbackArg = call.arguments[1];
        const { prefix, suffix } = computeTsCastWrapText(d.init, genCode);
        injectBinders.push({
          localName: d.id.name,
          keyArg,
          ...(fallbackArg && t.isExpression(fallbackArg) ? { fallbackArg } : {}),
          castPrefix: prefix,
          castSuffix: suffix,
        });
      }
    }
  }
  return { provideValues, injectBinders };
}

/**
 * Emit Svelte native `setContext`/`getContext` for the context primitive.
 *
 * @param ir              the component IR (gates on `provides`/`injects`).
 * @param clonedProgram   the post-rewrite cloned Program (so provided values +
 *                        inject fallbacks pick up `$data`/`$props` rewrites).
 */
export function emitContext(ir: IRComponent, clonedProgram: t.File): ContextEmit {
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
  const svelteImports = new Set<string>();

  if (injectBinders.length > 0) {
    svelteImports.add('getContext');
    for (const b of injectBinders) {
      const keyCode = genCode(b.keyArg);
      // Svelte has no native 2-arg getContext default; emit a nullish-coalesce
      // fallback so a missing provider yields the author's default value.
      // ROZ132 cast-blindness fix — re-apply the author's original TS wrapper
      // (`as T` / `!` / `satisfies T`) around the read so the injected value
      // keeps its author-declared type in the emitted output.
      const inner = b.fallbackArg
        ? `getContext(${keyCode}) ?? ${genCode(b.fallbackArg)}`
        : `getContext(${keyCode})`;
      injectLines.push(`const ${b.localName} = ${b.castPrefix}${inner}${b.castSuffix};`);
    }
  }

  if (provideValues.length > 0) {
    svelteImports.add('setContext');
    for (const p of provideValues) {
      provideLines.push(`setContext(${genCode(p.keyArg)}, ${genCode(p.valueArg)});`);
    }
  }

  return {
    hasContext: true,
    injectLines,
    provideLines,
    svelteImports: [...svelteImports],
  };
}
