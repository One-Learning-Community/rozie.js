/**
 * Cross-component context primitive (Phase 36) — Angular 19+ target emitter.
 *
 * Lowers the author-side `$provide(key, value)` / `const x = $inject(key, fb?)`
 * sigils to Angular's hierarchical-DI provide/inject mechanism:
 *
 *   $provide('theme', { ... })
 *     → a `@Component({ providers: [{ provide: rozieToken('theme'),
 *        useFactory: () => ({ ... }) }] })` entry
 *
 *   const theme = $inject('theme')
 *     → `theme = inject(rozieToken('theme'));`              (class field)
 *
 *   const theme = $inject('theme', defaultTheme)
 *     → `theme = inject(rozieToken('theme'), { optional: true }) ?? defaultTheme;`
 *
 * THREE hard Angular-specific rules (REQ-31 / Pitfall 2 / D-1):
 *
 *  1. `providers`, NEVER `viewProviders` (REQ-31). Angular exposes `providers`
 *     to PROJECTED `ng-content` descendants while `viewProviders` hides from
 *     them. The compound-component pattern projects the consumer, so the token
 *     MUST live in `providers` for a projected `inject(rozieToken('k'))` to
 *     resolve. The provider entries this emitter produces are MERGED into the
 *     decorator's single `providers: [...]` array by `emitDecorator.ts` —
 *     emitting two `providers:` keys (the CVA `NG_VALUE_ACCESSOR` entry + a
 *     context entry) is invalid object syntax (Pitfall 2). This emitter only
 *     produces the per-key entry STRINGS; the merge happens in the decorator.
 *
 *  2. The token is an `InjectionToken` deduped through a `globalThis`-backed
 *     registry — the inline module-level `rozieToken` helper (D-1 / REQ-28).
 *     A per-module `new Map()` would mint a DISTINCT token per separately-
 *     compiled file, breaking cross-file identity so `inject(...)` returns
 *     undefined through the unaware passthrough. There is NO
 *     `@rozie/runtime-angular` package (D-2 — convention forbids one, mirroring
 *     the inline `__rozieDisplay`/`__rozieAttr` helpers), so the helper is
 *     emitted verbatim at module scope.
 *
 *  3. The `useFactory: () => <value>` runs in the DECORATOR (static) scope, NOT
 *     a method body — it cannot reference `this`. Per D-3 the provided value is
 *     authored self-contained (a getter/`signal()` minted inside the factory),
 *     so reactivity-at-depth rides the live ref the consumer reads. This
 *     emitter generates the value expression verbatim from the cloned
 *     (post-rewrite) program; an author who reads `$data`/`$props` inside the
 *     provided value is responsible for the self-contained-value rule (the
 *     `this`-referencing forms simply will not compile, surfacing the rule).
 *
 * Empty-gate (R12 / D-5): when the component has no `$provide`/`$inject`, this
 * returns an all-empty struct with `hasContext: false` and emitScript/decorator
 * emit nothing new — every existing (non-context) Angular fixture stays
 * byte-identical, including the CVA decorator shape.
 *
 * The IR's `ProvideDecl.valueExpr` / `InjectDecl.fallbackExpr` reference the
 * ORIGINAL (un-rewritten) script AST. To pick up `$data`/`$props`/`$refs`
 * rewrites, this emitter reads the value/fallback expressions back from the
 * CLONED (post-rewrite) program — mirroring the Vue/Svelte emitters and
 * `findClonedComputedBodies` in emitScript.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';

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

/**
 * The host-capture local name bound inside the Angular `useFactory` when the
 * provided value references the component instance. See `bindProvidedValue`.
 */
const HOST_LOCAL = '__rozieCtxHost';

/**
 * Render a `$provide(...)` value for Angular's `useFactory`, binding any
 * `this.<member>` it contains to the component instance.
 *
 * Phase 36 bug: the rewrite lowers `$data.color` → `this.color()` (a signal
 * read), `$props.x` → `this.x()`, methods → `this.cycle`. Emitting the value
 * verbatim inside `useFactory: () => (<value>)` is doubly wrong: (a) an arrow
 * factory's `this` is NOT the component (it's the decorator/module scope), and
 * (b) inside a nested getter `{ get color() { return this.color() } }`, `this`
 * rebinds to the object literal, so `this.color()` calls the getter itself —
 * `RangeError: Maximum call stack size exceeded` at runtime, and the projected
 * consumer's `inject(...)` resolves an exploding value.
 *
 * Fix (mirrors the spike's validated Angular ref, which read the component's
 * signal): capture the component instance via Angular's `inject()` INSIDE the
 * factory and rewrite EVERY `ThisExpression` in the value to that captured
 * local. `inject()` is legal in a `useFactory` (it runs in the providing
 * injector's context) and `forwardRef` defers the not-yet-declared class
 * reference:
 *
 *   useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => Foo));
 *     return ({ get color() { return __rozieCtxHost.color() }, cycle: __rozieCtxHost.cycle }); }
 *
 * When the value contains no `this` (a self-contained constant), the bare
 * arrow-return form is kept — byte-identical to the pre-fix constant path, and
 * no `inject`/`forwardRef` is needed.
 *
 * @returns `{ factoryBody, needsForwardRef }` — `factoryBody` is the full text
 *   after `useFactory: ` (either `() => (<value>)` or the inject-capturing block
 *   form); `needsForwardRef` is true when the block form (and hence a
 *   `forwardRef` import) is required.
 */
function bindProvidedValue(
  valueArg: t.Expression,
  componentName: string,
): { factoryBody: string; needsForwardRef: boolean } {
  let sawThis = false;
  const clone = t.cloneNode(valueArg, true, false);
  function walk(node: unknown): unknown {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) node[i] = walk(node[i]);
      return node;
    }
    const n = node as t.Node & Record<string, unknown>;
    if (n.type === 'ThisExpression') {
      sawThis = true;
      return t.identifier(HOST_LOCAL);
    }
    for (const key of Object.keys(n)) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
      const child = n[key];
      if (child && typeof child === 'object') n[key] = walk(child);
    }
    return n;
  }
  const inner = genCode(walk(clone) as t.Expression);
  if (!sawThis) {
    return { factoryBody: `() => (${inner})`, needsForwardRef: false };
  }
  return {
    factoryBody: `() => { const ${HOST_LOCAL} = inject(forwardRef(() => ${componentName})); return (${inner}); }`,
    needsForwardRef: true,
  };
}

/**
 * The inline module-level `rozieToken` helper (D-1 / REQ-28). `globalThis`-backed
 * dedup of an `InjectionToken` keyed by the author's string — the SAME token
 * object is returned in two separately-compiled modules so hierarchical DI
 * resolves the provider's value in a projected consumer.
 *
 * Emitted verbatim at module scope (above the `@Component` class) ONLY when the
 * component has at least one `$provide`/`$inject` — keeping non-context
 * components byte-identical (R12). NOT a `@rozie/runtime-angular` export (D-2).
 */
export const INLINE_ROZIE_TOKEN_FN = [
  'const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =',
  "  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<",
  '    string,',
  '    InjectionToken<unknown>',
  '  >;',
  'function rozieToken(key: string): InjectionToken<unknown> {',
  '  let token = __rozieTokenRegistry.get(key);',
  '  if (!token) {',
  "    token = new InjectionToken<unknown>('rozie:' + key);",
  '    __rozieTokenRegistry.set(key, token);',
  '  }',
  '  return token;',
  '}',
].join('\n');

export interface AngularContextEmit {
  /** True when the component has at least one `$provide`/`$inject`. */
  hasContext: boolean;
  /**
   * `<localBinding> = inject(rozieToken('key'))[ , { optional: true }] [?? fb];`
   * class-field lines, in source order. emitScript appends these to `fieldLines`
   * so the injected value is a class member (`this.theme`) the template +
   * methods can read.
   */
  injectFields: string[];
  /**
   * The per-key `providers` ENTRY strings (each a `{ provide: rozieToken('key'),
   * useFactory: () => <value> }` literal, comma-terminated, 4-space-indented to
   * sit inside the decorator's `providers: [ ... ]`). emitDecorator MERGES these
   * with the CVA `NG_VALUE_ACCESSOR` entry into ONE `providers:` array — never
   * two `providers:` keys (Pitfall 2). Empty when no `$provide`.
   */
  providerEntries: string[];
  /**
   * True when the inline `rozieToken` helper + `InjectionToken` import are
   * needed (i.e. any `$provide`/`$inject` present). emitAngular splices
   * `INLINE_ROZIE_TOKEN_FN` into the module-scope decls bucket and adds
   * `InjectionToken` + `inject` to the @angular/core import line.
   */
  needsTokenHelper: boolean;
  /**
   * True when at least one provided value references the component instance
   * (`this`) and is therefore emitted with the `inject(forwardRef(() => Foo))`
   * host-capture factory form — emitAngular must ensure `forwardRef` is in the
   * @angular/core import line. False for self-contained constant provides.
   */
  needsForwardRef: boolean;
}

const EMPTY: AngularContextEmit = {
  hasContext: false,
  injectFields: [],
  providerEntries: [],
  needsTokenHelper: false,
  needsForwardRef: false,
};

/**
 * Read the rewritten `$provide(...)` value arguments + `$inject(...)` binders
 * back from the cloned (post-rewrite) Program, in source order — so the emitted
 * output picks up any `$data`/`$props`/`$refs` → `this.x()` rewrites. Mirrors
 * the Vue/Svelte `readClonedContext`.
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
 * Emit Angular hierarchical-DI provide/inject for the context primitive.
 *
 * @param ir              the component IR (gates on `provides`/`injects`).
 * @param clonedProgram   the post-rewrite cloned Program (so provided values +
 *                        inject fallbacks pick up `$data`/`$props` rewrites).
 */
export function emitContext(
  ir: IRComponent,
  clonedProgram: t.File,
  componentName: string,
): AngularContextEmit {
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

  const injectFields: string[] = [];
  for (const b of injectBinders) {
    const keyCode = genCode(b.keyArg);
    if (b.fallbackArg) {
      // Angular's `inject(token, { optional: true })` returns null when no
      // provider is found; nullish-coalesce to the author's fallback so a
      // consumer rendered outside any provider still gets a value.
      injectFields.push(
        `${b.localName} = inject(rozieToken(${keyCode}), { optional: true }) ?? ${genCode(b.fallbackArg)};`,
      );
    } else {
      injectFields.push(`${b.localName} = inject(rozieToken(${keyCode}));`);
    }
  }

  const providerEntries: string[] = [];
  let needsForwardRef = false;
  for (const p of provideValues) {
    const keyCode = genCode(p.keyArg);
    // Bind the value's `this` (the rewrite's `this.color()` signal reads,
    // `this.cycle` methods) to the component instance captured via `inject()`
    // inside the factory (Phase 36 fix). A self-contained constant value keeps
    // the bare `() => (<value>)` form. MERGED with the CVA entry by
    // emitDecorator into a single `providers: [...]` array (Pitfall 2).
    const { factoryBody, needsForwardRef: thisNeeds } = bindProvidedValue(
      p.valueArg,
      componentName,
    );
    if (thisNeeds) needsForwardRef = true;
    providerEntries.push(
      [
        `    {`,
        `      provide: rozieToken(${keyCode}),`,
        `      useFactory: ${factoryBody},`,
        `    },`,
      ].join('\n'),
    );
  }

  return {
    hasContext: true,
    injectFields,
    providerEntries,
    needsTokenHelper: true,
    needsForwardRef,
  };
}
