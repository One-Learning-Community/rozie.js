/**
 * Cross-component context primitive (Phase 36) — Lit (web-components) target emitter.
 *
 * Lowers the author-side `$provide(key, value)` / `const x = $inject(key, fb?)`
 * sigils to `@lit/context`'s `ContextProvider` / `ContextConsumer` reactive
 * controllers (the W3C Context Community Protocol — event-driven, async, and
 * shadow-DOM crossing):
 *
 *   $provide('theme', { get color() { return $data.color; }, cycle })
 *     → const __rozieCtx_theme = createContext(Symbol.for('rozie:theme'));
 *       private __rozieCtxProvider_theme = new ContextProvider(this, {
 *         context: __rozieCtx_theme,
 *         initialValue: { get color() { return this._color.value; }, cycle: …},
 *       });
 *       // + (if the value reads $data/$computed/slot signals) a reactive
 *       //   setValue hooked into the existing @lit-labs/preact-signals effect()
 *       //   route, registered in firstUpdated via _disconnectCleanups (R10 / D-3):
 *       this._disconnectCleanups.push(effect(() => {
 *         void this._color.value;                         // dep touch (subscribe)
 *         this.__rozieCtxProvider_theme.setValue({ … });   // re-publish on change
 *       }));
 *
 *   const theme = $inject('theme')
 *     → private __rozieCtxConsumer_theme = new ContextConsumer(this, {
 *         context: createContext(Symbol.for('rozie:theme')),
 *         subscribe: true,
 *       });
 *       // null-guarded read accessor (REQ-30 — the documented async edge):
 *       private get theme() { return this.__rozieCtxConsumer_theme.value; }
 *
 *   const theme = $inject('theme', defaultTheme)
 *     → private get theme() {
 *         return this.__rozieCtxConsumer_theme.value ?? defaultTheme;
 *       }
 *
 * THREE Lit-specific rules:
 *
 *  1. `createContext` is identity-on-key (`(n) => n`, verified in installed
 *     1.1.6 source), so `createContext(Symbol.for('rozie:' + key))` carries
 *     cross-file context identity NATIVELY through `Symbol.for`'s global
 *     registry — NO app-level registry, NO `@rozie/runtime-lit` helper (D-1).
 *     A provider and a consumer in two separately-compiled modules construct
 *     the SAME context object, so the `context-request` round-trip resolves.
 *
 *  2. REQ-30 / Pitfall 4 — `ContextConsumer` is event-driven: its `.value` is
 *     `undefined` until the `context-request` round-trip resolves on first
 *     paint. This is the ONE accepted, documented cross-target parity edge.
 *     Every consumer read site is emitted through a null-guarded `get`
 *     accessor (`.value` for the no-fallback form — already `T | undefined`;
 *     `.value ?? fallback` for the fallback form). We DO NOT try to make the
 *     consumer synchronous (that would mean reimplementing the protocol).
 *
 *  3. R10 reactivity-at-depth (Pattern 5 / D-3) — `ContextConsumer(subscribe:
 *     true)` only re-invokes the consumer when the provider calls `setValue`.
 *     A provided value that reads `$data`/`$computed`/slot signals is
 *     re-published via `provider.setValue(value)` inside a
 *     `@lit-labs/preact-signals` `effect()` (the existing reactive route at
 *     emitScript.ts:374-503) — the effect TOUCHES each signal the value reads
 *     so it subscribes, then re-publishes on change. A value with no signal
 *     reads (constant, or `$props`-only — `@property` mirrors are not preact
 *     signals) gets only the `initialValue` (no effect), keeping the emit
 *     minimal.
 *
 * Empty-gate (R12 / D-5): when the component has no `$provide`/`$inject`, this
 * returns an all-empty struct with `hasContext: false` and emitScript emits
 * nothing new — every existing (non-context) Lit fixture stays byte-identical.
 *
 * The IR's `ProvideDecl.valueExpr` / `InjectDecl.fallbackExpr` reference the
 * ORIGINAL (un-rewritten) script AST. To pick up `$data`/`$props`/`$refs`
 * rewrites (e.g. a provided getter that reads `$data.color` → `this._color
 * .value`), this emitter reads the value/fallback expressions back from the
 * REWRITTEN program — mirroring the Vue/Svelte/Angular emitters.
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
 * Sanitize an author context key into the identifier-tail used for the
 * generated `__rozieCtx_<tail>` / `__rozieCtxProvider_<tail>` /
 * `__rozieCtxConsumer_<tail>` member + local names. Keys are string literals
 * (ROZ129/ROZ130 enforce that upstream), but they may contain characters
 * illegal in a JS identifier (`-`, `.`, `:`, …) — replace each run with `_`.
 * The PROTOCOL key (the `Symbol.for('rozie:' + <raw key>)` argument) always
 * uses the raw author key verbatim, so cross-file identity is unaffected.
 */
function keyIdent(key: string): string {
  const tail = key.replace(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(tail) ? tail : `_${tail}`;
}

export interface LitContextEmit {
  /** True when the component has at least one `$provide`/`$inject`. */
  hasContext: boolean;
  /**
   * Module-scope `const __rozieCtx_<key> = createContext(Symbol.for('rozie:<key>'));`
   * lines — one per DISTINCT key — spliced above the class by emitLit's
   * `interfaceDecls` bucket so a provider and a consumer in the SAME module
   * share one context object. Empty when `hasContext` is false.
   */
  moduleContextDecls: string[];
  /**
   * Class FIELD declarations, in source order: each `ContextProvider` /
   * `ContextConsumer` controller field plus each consumer's null-guarded
   * `get <localBinding>()` accessor (REQ-30). emitScript pushes these onto
   * `fieldLines` so the template + methods read the injected value via the
   * guarded accessor.
   */
  fieldLines: string[];
  /**
   * `this._disconnectCleanups.push(effect(() => { … provider.setValue(v); }));`
   * registrations for reactive providers (Pattern 5 / D-3). emitScript splices
   * these into the firstUpdated body alongside the `$watch` effect
   * registrations so they subscribe at first paint AND tear down on disconnect.
   * Empty for constant / `$props`-only provided values.
   */
  setValueEffects: string[];
  /** `@lit/context` value imports this emit needs. Empty when no context. */
  litContextImports: string[];
  /**
   * True when at least one reactive `setValue` effect was emitted — emitScript
   * must ensure `effect` is imported from `@lit-labs/preact-signals`.
   */
  needsEffectImport: boolean;
}

const EMPTY: LitContextEmit = {
  hasContext: false,
  moduleContextDecls: [],
  fieldLines: [],
  setValueEffects: [],
  litContextImports: [],
  needsEffectImport: false,
};

/**
 * Read the rewritten `$provide(...)` value arguments + `$inject(...)` binders
 * back from the REWRITTEN Program, in source order — so the emitted output
 * picks up `$data.x` → `this._x.value` / `$computed` getter / `$props.x` →
 * `this.x` rewrites. Mirrors the Vue/Svelte/Angular `readClonedContext`.
 *
 * The rewritten program is what emitScript already produced via `rewriteScript`
 * (the `$provide`/`$inject` callee identifiers survive the rewrite — they are
 * not `$data`/`$props`/`$refs`/method names — so the call shapes are intact and
 * carry the rewritten value/fallback subtrees).
 */
function readRewrittenContext(rewrittenProgram: t.File): {
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

  for (const stmt of rewrittenProgram.program.body) {
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
 * Collect the reactive signal-read "touch" expressions a rewritten provided
 * value depends on, so the `setValue` effect subscribes to them. After
 * `rewriteScript`:
 *   - `$data.x`     → `this._x.value`         (a settable preact signal `.value`)
 *   - `$computed.x` → `this.x`                (a `get x()` computed-signal getter)
 *   - `$slots.x`    → `this.__slot_x_present.value` / similar signal reads
 * A `$props.x` read rewrites to `this.x` (a plain `@property` accessor, NOT a
 * preact signal) — those do NOT subscribe an `effect()` and are intentionally
 * excluded (a `@property` change flows through Lit's `updated()`, and a
 * `$props`-only provided value re-publishes via the initialValue + Lit's own
 * re-render, not via a preact effect).
 *
 * We detect a preact-signal read structurally: a `MemberExpression` whose
 * property is `value` and whose object is `this.<field>` where `<field>` starts
 * with `_` (the `$data`/`$slots` signal-field naming convention `this._x.value`
 * / `this.__slot…value`). This is conservative: an unrecognised read simply
 * yields no touch (the provider still ships `initialValue`), never a crash.
 */
function collectSignalTouches(valueExpr: t.Expression): string[] {
  const touches = new Set<string>();

  function visit(node: t.Node | null | undefined): void {
    if (!node || typeof node !== 'object') return;
    if (t.isMemberExpression(node)) {
      // this._x.value  →  the signal read we touch to subscribe the effect.
      if (
        !node.computed &&
        t.isIdentifier(node.property) &&
        node.property.name === 'value' &&
        t.isMemberExpression(node.object) &&
        node.object.object &&
        t.isThisExpression(node.object.object) &&
        t.isIdentifier(node.object.property) &&
        node.object.property.name.startsWith('_')
      ) {
        touches.add(genCode(node));
      }
    }
    const rec = node as unknown as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
      const child = rec[key];
      if (Array.isArray(child)) {
        for (const c of child) visit(c as t.Node);
      } else if (child && typeof child === 'object' && 'type' in (child as object)) {
        visit(child as t.Node);
      }
    }
  }

  visit(valueExpr);
  return [...touches];
}

/**
 * Emit `@lit/context` ContextProvider/ContextConsumer for the context primitive.
 *
 * @param ir                the component IR (gates on `provides`/`injects`).
 * @param rewrittenProgram  the post-`rewriteScript` Program (so provided values
 *                          + inject fallbacks pick up `$data`/`$props`/`$refs`
 *                          → `this.*` rewrites).
 */
export function emitContext(
  ir: IRComponent,
  rewrittenProgram: t.File,
): LitContextEmit {
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

  const { provideValues, injectBinders } = readRewrittenContext(rewrittenProgram);

  const moduleContextDecls: string[] = [];
  const fieldLines: string[] = [];
  const setValueEffects: string[] = [];
  const litContextImports = new Set<string>();
  // DISTINCT keys → one module-scope `createContext` const each (a provider and
  // an in-module consumer over the same key share the const).
  const ctxDeclEmitted = new Set<string>();
  let needsEffectImport = false;

  function ensureModuleCtxDecl(rawKey: string): string {
    const ident = `__rozieCtx_${keyIdent(rawKey)}`;
    if (!ctxDeclEmitted.has(ident)) {
      ctxDeclEmitted.add(ident);
      litContextImports.add('createContext');
      // Symbol.for(...) carries cross-file identity natively (D-1) — createContext
      // is identity-on-key so the context object IS the global-registry symbol.
      moduleContextDecls.push(
        `const ${ident} = createContext(Symbol.for('rozie:${rawKey}'));`,
      );
    }
    return ident;
  }

  // PROVIDERS — one ContextProvider field per $provide, plus a reactive setValue
  // effect when the provided value reads $data/$computed/slot signals (D-3).
  for (const p of provideValues) {
    if (!t.isStringLiteral(p.keyArg)) {
      // Non-literal key — ROZ129 rejects this upstream; defensively skip.
      continue;
    }
    const rawKey = p.keyArg.value;
    const ident = keyIdent(rawKey);
    const ctxConst = ensureModuleCtxDecl(rawKey);
    litContextImports.add('ContextProvider');
    const providerField = `__rozieCtxProvider_${ident}`;
    const valueCode = genCode(p.valueArg);
    fieldLines.push(
      `private ${providerField} = new ContextProvider(this, { context: ${ctxConst}, initialValue: ${valueCode} });`,
    );

    // Reactivity-at-depth (Pattern 5): re-publish on signal change via effect().
    const touches = collectSignalTouches(p.valueArg);
    if (touches.length > 0) {
      needsEffectImport = true;
      const touchStmts = touches.map((tch) => `void ${tch};`).join(' ');
      setValueEffects.push(
        `this._disconnectCleanups.push(effect(() => { ${touchStmts} this.${providerField}.setValue(${valueCode}); }));`,
      );
    }
  }

  // CONSUMERS — one ContextConsumer field per $inject + a null-guarded read
  // accessor (REQ-30 — the value is undefined until the context-request resolves).
  for (const b of injectBinders) {
    if (!t.isStringLiteral(b.keyArg)) {
      // Non-literal key — ROZ130 rejects this upstream; defensively skip.
      continue;
    }
    const rawKey = b.keyArg.value;
    const ident = keyIdent(rawKey);
    const ctxConst = ensureModuleCtxDecl(rawKey);
    litContextImports.add('ContextConsumer');
    const consumerField = `__rozieCtxConsumer_${ident}`;
    fieldLines.push(
      `private ${consumerField} = new ContextConsumer(this, { context: ${ctxConst}, subscribe: true });`,
    );
    // REQ-30 null-guard at the read site: a getter is the single chokepoint so
    // every template + method read of `this.<localBinding>` flows through the
    // guard. No fallback → `.value` (already `T | undefined` — the guard is the
    // type); with fallback → `.value ?? fallback`.
    if (b.fallbackArg) {
      fieldLines.push(
        `private get ${b.localName}() { return this.${consumerField}.value ?? ${genCode(b.fallbackArg)}; }`,
      );
    } else {
      fieldLines.push(
        `private get ${b.localName}() { return this.${consumerField}.value; }`,
      );
    }
  }

  return {
    hasContext: true,
    moduleContextDecls,
    fieldLines,
    setValueEffects,
    litContextImports: [...litContextImports],
    needsEffectImport,
  };
}
