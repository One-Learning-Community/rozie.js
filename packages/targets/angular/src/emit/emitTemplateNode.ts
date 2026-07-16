/**
 * emitTemplateNode — Phase 5 Plan 05-04a Task 2.
 *
 * Recursive switch over the IR's TemplateNode discriminated union, producing
 * Angular 17+ template string fragments per RESEARCH Pattern 9 emission map:
 *
 *   - r-if/r-else-if/r-else        → @if (x) {...} @else if (y) {...} @else {...}
 *   - r-for + :key                 → @for (item of items; track item.id) {...}
 *   - r-for missing :key           → ROZ720 error (Pitfall 3)
 *   - r-show                       → [style.display]="x ? '' : 'none'"
 *   - r-html                       → [innerHTML]="expr"; ROZ721 if children
 *   - r-text                       → {{ expr }}
 *   - {{ expr }} interpolation     → {{ expr }} (identical)
 *   - @event handler               → (event)="handler($event)"
 *   - <slot ...>                   → *ngTemplateOutlet (see emitSlotInvocation)
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateMatchIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  Listener,
  ListenerSpreadIR,
  AttributeBinding,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import {
  rewriteTemplateExpression,
  hoistNonPureTemplateExpression,
} from '../rewrite/rewriteTemplateExpression.js';
import {
  emitAttributes,
  emitListenerSpread,
  emitPortalDirective,
  findRHtml,
  findRShow,
} from './emitTemplateAttribute.js';
import { emitTemplateEvent, type AngularScriptInjection } from './emitTemplateEvent.js';
import { emitSlotInvocation } from './emitSlotInvocation.js';
import { emitConditional } from './emitConditional.js';
import { toKebabCase } from './emitDecorator.js';
// Phase 07.2 Plan 03 — consumer-side slot-fill emit for component-tag elements.
// Phase 07.2 Plan 04 — R5 dynamic-name dispatch via emitDynamicSlotFiller.
import {
  emitSlotFiller,
  emitDynamicSlotFiller,
  type EmitSlotFillerCtx,
} from './emitSlotFiller.js';
// Phase 71 Plan 09 (r-keynav, Angular — highest blast radius) — inline
// controller emitter wiring (see emitKeynav.ts's module doc comment).
import {
  keynavItemAttrs,
  keynavRootAttrs,
  stripKeynavCommitEvent,
  type KeynavEmitPlan,
} from './emitKeynav.js';

/**
 * Phase 06.2 P2: resolve a TemplateElement's emitted tag name. For
 * composition (`tagKind: 'component'`) and recursion (`tagKind: 'self'`)
 * tags, return the Angular standalone-component selector form
 * `rozie-{kebab-case(localName)}`. Otherwise, the verbatim tagName.
 *
 * Mirrors the selector convention from `emitDecorator.toKebabCase` (Phase 5
 * D-72): Counter → `rozie-counter`, TodoList → `rozie-todo-list`. Both
 * `'component'` and `'self'` resolve through the @Component({ imports: [...] })
 * registration (user-class for component; forwardRef(() => Self) for self).
 */
function resolveAngularTagName(node: TemplateElementIR): string {
  if (node.tagKind === 'component' || node.tagKind === 'self') {
    return `rozie-${toKebabCase(node.tagName)}`;
  }
  return node.tagName;
}

/** HTML void elements. */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'source', 'track', 'wbr',
]);

export interface EmitNodeCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
  /** Class-body field declarations to inject (debounce/throttle wrappers, guarded methods). */
  scriptInjections: AngularScriptInjection[];
  /** Per-component counter shared across events for stable wrap-name suffixes. */
  injectionCounter: { next: number };
  /**
   * Phase 07.2 Plan 04 — when the template includes at least one dynamic
   * slot-name consumer-fill, this ref is set to `{ value: true }` so the
   * caller adds the `ViewChild` / `TemplateRef` / `NgTemplateOutlet`
   * imports.
   */
  hasDynamicSlotFiller?: { value: boolean };
  /**
   * Plan 14-05 — when the template includes at least one `spreadBinding`
   * (`r-bind="<expr>"` or synthesized `$attrs` fallthrough), set to
   * `{ value: true }` so emitAngular adds `inject` / `Renderer2` /
   * `ElementRef` / `effect` / `viewChild` to the `@angular/core` import line.
   * Same pattern as `hasDynamicSlotFiller`.
   */
  hasSpreadBinding?: { value: boolean };
  /**
   * Plan 15-05 / D-13 — when the template lowers at least one dynamic
   * `ListenerSpreadIR` (`r-on="<expr>"` non-literal, OR a literalKeys-empty
   * spread, OR synthesized `$listeners` auto-fallthrough), set to
   * `{ value: true }` so emitAngular adds the SAME `inject` / `Renderer2` /
   * `ElementRef` / `effect` / `viewChild` / `DestroyRef` import surface (the
   * overlap with `hasSpreadBinding` is deduped by the AngularImportCollector
   * Set semantics).
   */
  hasListenerSpread?: { value: boolean };
  /**
   * Plan 15-05 — when the dynamic-listener-spread effect() body emits the
   * one-time `__rozieDestroyRef.onDestroy(...)` registration, set to
   * `{ value: true }`. emitScript reads this flag and unions it into
   * `lifecycleNeedsDestroyRefField` alongside the existing portals + lifecycle
   * sources so `private __rozieDestroyRef = inject(DestroyRef);` is hoisted
   * EXACTLY ONCE per component (Phase 13 coordination — memory
   * `project_rozie_angular_onmount_emit_bug`).
   */
  needsDestroyRefField?: { value: boolean };
  /**
   * Phase 26 (SPEC-1/SPEC-4, D-06/D-07) — set to `{ value: true }` when at
   * least one text / attribute-binding / class-interpolation position emitted
   * the `rozieDisplay(...)` wrap. emitAngular reads this off
   * `EmitTemplateResult` to gate BOTH the inlined module-scope
   * `function __rozieDisplay(v)` AND the synthesized delegating class method
   * `rozieDisplay(v) { return __rozieDisplay(v); }`. When false, NEITHER is
   * emitted so non-wrapping components stay byte-identical to pre-phase
   * (SPEC-3). Mirrors the `hasSpreadBinding` boxed-flag plumbing pattern.
   * NOTE: Angular cannot call a module-scope free function OR use the `json`
   * pipe (it quotes strings) in a template — so the template calls the CLASS
   * METHOD `rozieDisplay`, never the free `__rozieDisplay`.
   *
   * 260608-sya — a wrapped WHOLE-VALUE attribute binding sets this flag too;
   * emitAngular then also inlines `function __rozieAttr(v)` (drop-on-nullish)
   * + the delegating `rozieAttr` class method on the same flag. The template
   * calls the CLASS METHOD `rozieAttr`, never the free `__rozieAttr`.
   */
  hasDisplayWrap?: { value: boolean };
  /**
   * Whether the template has produced at least one [(ngModel)] binding —
   * drives FormsModule conditional import in emitDecorator.
   */
  hasNgModel: { value: boolean };
  /** Collision-renames from rewriteScript. */
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  /** Loop-local bindings (name -> presence) accumulated during recursion. */
  loopBindings?: Set<string> | undefined;
  /** Bug 5: handler-name → param-count map for guarded-wrapper arity. */
  handlerArity?: ReadonlyMap<string, number> | undefined;
  /**
   * Class members from rewriteScript — includes user-method names lifted to
   * class fields. Threaded into emitSlotInvocation / emitTemplateEvent for
   * accurate `this.`-prefixing inside class-body field initializers. See
   * EmitTemplateOpts.classMembers docstring for rationale.
   */
  classMembers?: ReadonlySet<string> | undefined;
  /**
   * Phase 23 (angular-cva-forms-integration) — the resolved single CVA model
   * prop name (or null when not CVA-receiving). Threaded into every
   * `rewriteTemplateExpression` call so a template model-write to the CVA prop
   * also emits `__rozieCvaOnChange(<newValue>)` (Task 1). Set ONCE in
   * emitTemplate from emitAngular's single gate.
   */
  cvaModelProp?: string | null | undefined;
  /**
   * Phase 23 — Task 2: when true, a template `$props.disabled` read OR-merges
   * `this.__rozieCvaDisabled()`. Set when CVA-receiving AND a `disabled` prop is
   * declared.
   */
  cvaMergeDisabled?: boolean | undefined;
  /**
   * Phase 71 (r-keynav, Angular) — the per-component keynav emission plan
   * (resolved ONCE by `emitAngular.ts` via `resolveKeynavPlan`, threaded
   * through both `emitTemplate.ts` and `emitScript.ts`), or `null` when the
   * component has no `r-keynav` root. `undefined` (the default, back-compat
   * for callers that don't thread it) is treated identically to `null`.
   */
  keynav?: KeynavEmitPlan | null;
  /**
   * Phase 71 (r-keynav, Angular) — the CURRENT `@for` loop's index
   * identifier, threaded down by `emitLoop` for the duration of that loop's
   * body subtree ONLY (a nested loop overwrites it with its own). Angular's
   * `@for` block exposes an implicit `$index` context variable that is
   * ALWAYS directly usable inside the block with no `let` alias needed — so,
   * unlike the React/Vue/Solid references, this is threaded UNCONDITIONALLY
   * on every loop (no `loopBodyHasKeynavItem`-gated synthesis is needed; see
   * `emitKeynav.ts`'s `keynavItemAttrs` doc comment). `null` when not inside
   * a loop.
   */
  keynavItemIndexAlias?: string | null;
}

function emitStaticText(node: TemplateStaticTextIR): string {
  return node.text;
}

/**
 * Plan 15-05 — synthesize a virtual `Listener` from a `ListenerSpreadIR`'s
 * `literalKeys[i]` entry. Each literal-key entry carries
 * `{ eventName, modifierPipeline, valueExpr }` — enough to fabricate a
 * Listener with the same shape `emitTemplateEvent` already consumes from
 * `el.events`. `target` is `'self'`; `when` is null; `deps` inherits the
 * parent spread's deps; `source` is `'template-event'` (codegen path treats
 * both sources identically). Mirror of the Vue/Svelte/React/Solid/Lit
 * targets' `listenerFromLiteralKey`.
 */
function listenerFromLiteralKey(
  spread: ListenerSpreadIR,
  literalKey: NonNullable<ListenerSpreadIR['literalKeys']>[number],
): Listener {
  return {
    type: 'Listener',
    target: { kind: 'self', el: '$el' },
    event: literalKey.eventName,
    modifierPipeline: literalKey.modifierPipeline,
    when: null,
    handler: literalKey.valueExpr,
    deps: spread.deps,
    source: 'template-event',
    sourceLoc: spread.sourceLoc,
  };
}

function emitInterpolation(
  node: TemplateInterpolationIR,
  ctx: EmitNodeCtx,
): string {
  // Emitter-hardening item #7 sub-shape (ii) — an inline arrow/function
  // literal anywhere in the interpolated expression (e.g.
  // `{{ items().find((x) => x > 1) }}`) is illegal in Angular's template
  // expression grammar and silently JIT-falls-back, throwing "JIT compiler
  // unavailable" under AOT. Hoist the WHOLE expression into a generated
  // class-body getter FIRST; only fall back to the plain inline rewrite when
  // no function literal is present (byte-identical to pre-fix for every
  // existing interpolation, which never contains one).
  const taken = new Set(ctx.scriptInjections.map((si) => si.name));
  const hoist = hoistNonPureTemplateExpression(
    node.expression,
    ctx.ir,
    `interp_${ctx.injectionCounter.next}`,
    taken,
    {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
      cvaModelProp: ctx.cvaModelProp,
      cvaMergeDisabled: ctx.cvaMergeDisabled,
    },
  );
  let expr: string;
  if (hoist !== null) {
    ctx.injectionCounter.next++;
    ctx.scriptInjections.push({ name: hoist.memberName, decl: hoist.decl });
    expr = hoist.memberName;
  } else {
    expr = rewriteTemplateExpression(node.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
      cvaModelProp: ctx.cvaModelProp,
      cvaMergeDisabled: ctx.cvaMergeDisabled,
    });
  }
  // Phase 26 (SPEC-1, D-06/D-07) — gate on the IR-precomputed wrap decision.
  // When `wrapForDisplay` is true the value may be a non-primitive
  // (object/array/unknown) which renders as `[object Object]` on Angular;
  // `rozieDisplay` pretty-prints it as portable JSON identical to the other
  // targets. Angular templates cannot call a module-scope free function, so we
  // call the synthesized CLASS METHOD `rozieDisplay` (Task 2 emits both the
  // inlined `function __rozieDisplay` and the delegating method, gated on the
  // `hasDisplayWrap` flag we flip here). When false, emit byte-identical to
  // pre-phase (SPEC-3).
  if (node.wrapForDisplay) {
    if (ctx.hasDisplayWrap) ctx.hasDisplayWrap.value = true;
    return `{{ rozieDisplay(${expr}) }}`;
  }
  return `{{ ${expr} }}`;
}

function emitFragment(
  node: TemplateFragmentIR,
  ctx: EmitNodeCtx,
): string {
  return node.children.map((c) => emitNode(c, ctx)).join('');
}

/**
 * Emit a TemplateLoop as `@for (item of items(); track item.id) { ... }`.
 *
 * Pitfall 3 mitigation: when keyExpression is null, raise ROZ720 (Angular
 * compiler requires `track` in `@for` blocks). We still emit a fallback
 * `track $index` so the output parses, but the diagnostic is an ERROR.
 */
function emitLoop(node: TemplateLoopIR, ctx: EmitNodeCtx): string {
  // Track loop-local bindings so rewriteTemplateExpression doesn't apply
  // class-member rewrites to them.
  const childBindings = new Set(ctx.loopBindings ?? []);
  childBindings.add(node.itemAlias);
  if (node.indexAlias) childBindings.add(node.indexAlias);

  // Phase 71 (r-keynav) — Angular's `@for` block exposes `$index` as an
  // implicit context variable directly usable inside the block body with NO
  // `let` alias required (Angular's own `@for` docs). This means, unlike
  // every other target, NO loop-declaration synthesis is needed for keynav's
  // sake — the value is threaded through unconditionally (cheap: only
  // consumed by `keynavItemAttrs`, itself gated on `node.keynavItem`).
  const keynavItemIndexAlias = node.indexAlias ?? '$index';

  const childCtx: EmitNodeCtx = { ...ctx, loopBindings: childBindings, keynavItemIndexAlias };

  const iter = rewriteTemplateExpression(node.iterableExpression, ctx.ir, {
    collisionRenames: ctx.collisionRenames,
    loopBindings: ctx.loopBindings,
    cvaModelProp: ctx.cvaModelProp,
    cvaMergeDisabled: ctx.cvaMergeDisabled,
  });

  let trackExpr: string;
  if (node.keyExpression === null) {
    // Pitfall 3: ROZ720.
    ctx.diagnostics.push({
      code: RozieErrorCode.TARGET_ANGULAR_RFOR_MISSING_KEY,
      severity: 'error',
      message: `r-for missing :key — Angular's @for block requires a track expression. Add :key="..." to the loop element.`,
      loc: node.sourceLoc,
    });
    trackExpr = '$index';
  } else {
    trackExpr = rewriteTemplateExpression(node.keyExpression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: childBindings,
      cvaModelProp: ctx.cvaModelProp,
      cvaMergeDisabled: ctx.cvaMergeDisabled,
    });
  }

  const loopVarDecl = node.indexAlias
    ? `${node.itemAlias} of ${iter}; track ${trackExpr}; let ${node.indexAlias} = $index`
    : `${node.itemAlias} of ${iter}; track ${trackExpr}`;

  // Strip `:key` from the inner element to avoid duplicate emission.
  const stripKey = (n: TemplateNode): TemplateNode => {
    if (n.type !== 'TemplateElement') return n;
    return {
      ...n,
      attributes: n.attributes.filter(
        (a) => !(a.kind === 'binding' && a.name === 'key'),
      ),
    };
  };

  const innerNodes = node.body.map(stripKey);
  const inner = innerNodes.map((c) => emitNode(c, childCtx)).join('');

  return `@for (${loopVarDecl}) {\n${inner}\n}`;
}

/**
 * Emit element events. Handles multiple listeners on same DOM event by
 * letting Angular accept multiple `(event)="..."` bindings — Angular's
 * template compiler does NOT enforce attribute uniqueness for outputs. So
 * each Listener emits independently.
 *
 * Wait — actually Angular DOES enforce uniqueness. Let me check: Angular 17
 * disallows duplicate `(event)` bindings on the same element (template parse
 * error). We need to merge same-event handlers into a single binding.
 */
function emitEvents(events: Listener[], ctx: EmitNodeCtx): string {
  if (events.length === 0) return '';

  // Group by lowercase event name.
  const groups = new Map<string, Listener[]>();
  for (const ev of events) {
    const key = ev.event.toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(ev);
    groups.set(key, list);
  }

  const out: string[] = [];

  for (const [eventName, group] of groups) {
    if (group.length === 1) {
      const result = emitTemplateEvent(group[0]!, {
        ir: ctx.ir,
        registry: ctx.registry,
        injectionCounter: ctx.injectionCounter,
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
        handlerArity: ctx.handlerArity,
        cvaModelProp: ctx.cvaModelProp,
        cvaMergeDisabled: ctx.cvaMergeDisabled,
      });
      out.push(result.eventAttr);
      if (result.scriptInjection) ctx.scriptInjections.push(result.scriptInjection);
      for (const d of result.diagnostics) ctx.diagnostics.push(d);
      continue;
    }

    // Multiple listeners on same event — synthesize ONE `(event)="..."` binding
    // via a class-body wrapper method that runs each listener's body.
    const wrapperName = `_merged_${eventName}_${ctx.injectionCounter.next++}`;
    const guardLines: string[] = [];

    for (const ev of group) {
      const sub = emitTemplateEvent(ev, {
        ir: ctx.ir,
        registry: ctx.registry,
        injectionCounter: ctx.injectionCounter,
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
        handlerArity: ctx.handlerArity,
        cvaModelProp: ctx.cvaModelProp,
        cvaMergeDisabled: ctx.cvaMergeDisabled,
      });
      if (sub.scriptInjection) ctx.scriptInjections.push(sub.scriptInjection);
      for (const d of sub.diagnostics) ctx.diagnostics.push(d);

      // Extract the inner attrValue from `(event)="X"` so we can splice it
      // into the merged wrapper.
      const m = sub.eventAttr.match(/^\([a-zA-Z]+\)="(.*)"$/s);
      if (!m) continue;
      let inner = m[1]!;
      // The handler invocation references identifiers that need `this.` prefix
      // when emitted at class-body level (template implicit-this doesn't apply
      // inside class methods). Quick rewrite: bare identifier callees → `this.X`.
      // This is a v1 heuristic — works for the reference examples (handlers
      // are bare identifiers like `onSearch`, `clear`, `close`).
      //
      // Plan 15-05 [Rule 1 — bug] — the original regex required a literal
      // `($event)` arg, but the 0-arity dropdown in emitTemplateEvent.ts:279
      // emits `fn()` (no arg) when the original user handler is 0-arg.
      // Without an arg the original pattern misses the call entirely,
      // leaving bare `f1()` / `f2()` in the merger body which fails at
      // runtime (`f1 is not defined` at class scope). Extended to also
      // capture the 0-arg shape — bare `fn()` (no other chars between the
      // parens) now also gets the `this.` prefix.
      // angular-stop-handler-in-loop — the negative lookbehind `(?<![\w$.])`
      // ensures we only prefix BARE call expressions. Without it, an inlined
      // side-effect guard's MEMBER call (`$event.stopPropagation()` /
      // `$event.preventDefault()` — now spliced verbatim from a `.stop`/`.prevent`
      // handler) would match the `\b(\w+)\(\)` shape on `stopPropagation()` and
      // get mangled into `$event.this.stopPropagation()`. The lookbehind rejects
      // any identifier preceded by `.` (member access) or `$`/word-char.
      inner = inner.replace(
        /(?<![\w$.])([a-zA-Z_$][\w$]*)\(\$event\)/g,
        (_match, fn: string) => {
          if (fn === 'this') return _match;
          // The collision-renamed user methods already carry `_` prefix from
          // rewriteScript — keep that as-is, just add `this.`.
          return `this.${fn}($event)`;
        },
      );
      inner = inner.replace(
        /(?<![\w$.])([a-zA-Z_$][\w$]*)\(\)/g,
        (_match, fn: string) => {
          if (fn === 'this') return _match;
          return `this.${fn}()`;
        },
      );
      // Wrapper signature is `($event: any) => {...}` so user-side `$event`
      // references resolve naturally — no rewrite needed.
      guardLines.push(`  ${inner};`);
    }

    const decl = [
      `private ${wrapperName} = ($event: any) => {`,
      ...guardLines,
      `};`,
    ].join('\n');
    ctx.scriptInjections.push({ name: wrapperName, decl });

    out.push(`(${eventName})="${wrapperName}($event)"`);
  }

  return out.join(' ');
}

/**
 * Does a child node contribute meaningful (non-whitespace) content?
 *
 * Used to decide whether a Rozie-component invocation has default-slot
 * children that need wrapping in `<ng-template #defaultSlot>` (D-LIT-ANG-DEFAULT-SLOT).
 */
function isMeaningfulChild(node: TemplateNode): boolean {
  if (node.type === 'TemplateStaticText') {
    return node.text.trim().length > 0;
  }
  if (node.type === 'TemplateFragment') {
    return node.children.some(isMeaningfulChild);
  }
  // Elements / loops / conditionals / interpolations / slot-invocations all
  // count as meaningful content.
  return true;
}

/**
 * Emit a TemplateElement.
 *
 * Keyed-remount codegen Task 6 (Angular — the HARDEST target) — a
 * component-level `:key="expr"` (NOT under r-for; that path owns `key` via
 * `TemplateLoopIR.keyExpression` and never sets this field — see Task 1's
 * Global Constraints) lowers to `remountKeyExpression`. Angular has NO
 * first-class "recreate this view when a key changes" primitive. The idiom
 * that produces a real destroy+recreate is a SINGLE-ELEMENT keyed `@for`:
 *
 *   @for (__rozieRemountKey of [<expr>]; track __rozieRemountKey) {
 *     <rozie-child …/>
 *   }
 *
 * The array `[<expr>]` always has exactly one element (so the child renders
 * once and is NEVER hidden — no falsy-key guard is needed, unlike Solid's
 * `<Show>`), and `track __rozieRemountKey` tracks by the KEY VALUE. When the
 * key value is unchanged across change-detection the tracked identity is
 * stable → no churn; when it changes, Angular tears down the old embedded
 * view and builds a fresh one → the remount. The previously-forwarded inert
 * `[key]` input (the child declares no `key` input) is stripped inside
 * `emitElementInner` (guarded on this SAME field) so it's never also emitted.
 *
 * REF INTERACTION (the reason this task is hard): a component may carry BOTH
 * `:key` AND `ref=` (e.g. DataTableSuperDemo — `:key="String($data.virtual)"`
 * + `ref="tbl"`). `ref=` emits a `#tbl` template-ref var on the tag and a
 * `tbl = viewChild<Child>('tbl')` SIGNAL query in the class. Wrapping the tag
 * in `@for` moves `#tbl` into the block's embedded view. Angular's SIGNAL view
 * queries (`viewChild()`) are DYNAMIC (never `{static:true}`) and reactively
 * match template-reference variables inside `@if`/`@for` control-flow blocks
 * — they re-resolve as the embedded view is created/destroyed. So the imperative
 * `$refs.tbl.verb()` calls (which fire at user-interaction time, i.e. at rest
 * after view init) still resolve to the current child instance. This does NOT
 * regress Fix #3 (the imperative-handle repair).
 */
function emitElement(origNode: TemplateElementIR, ctx: EmitNodeCtx): string {
  const markup = emitElementInner(origNode, ctx);

  if (
    (origNode.tagKind === 'component' || origNode.tagKind === 'self') &&
    origNode.remountKeyExpression
  ) {
    const keyExpr = rewriteTemplateExpression(origNode.remountKeyExpression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
      cvaModelProp: ctx.cvaModelProp,
      cvaMergeDisabled: ctx.cvaMergeDisabled,
    });
    // Single-element keyed @for: `[expr]` always renders exactly one child;
    // `track` by the key value recreates it only when the value changes.
    return `@for (__rozieRemountKey of [${keyExpr}]; track __rozieRemountKey) {\n${markup}\n}`;
  }

  return markup;
}

/**
 * Emit a TemplateElement's markup. Walks attributes, events; renders children.
 */
function emitElementInner(origNode: TemplateElementIR, ctx: EmitNodeCtx): string {
  // Phase 71 (r-keynav) — strip the synthetic `@keynav-commit` listener
  // BEFORE any listener emission runs; it's routed into the inline
  // controller's `KeynavHost.commit` by `emitScript.ts`, never as an Angular
  // `(keynavCommit)=` template binding (see `emitKeynav.ts`'s
  // `stripKeynavCommitEvent` doc comment). No-op (returns the SAME node) for
  // every element that isn't a keynav root.
  let node = stripKeynavCommitEvent(origNode);

  // Keyed-remount codegen Task 6 — when this element carries a
  // `remountKeyExpression` (a component-level `:key`, not an r-for loop key),
  // the raw `key` binding is retained upstream in the IR (Task 1 — Vue still
  // emits it as a working vnode key) but MUST NOT be forwarded here as an
  // inert `[key]` input now that `emitElement` wraps the whole invocation in
  // a keyed `@for`. Strip it before attrs are computed below.
  if (node.remountKeyExpression) {
    node = {
      ...node,
      attributes: node.attributes.filter(
        (a) => !(a.kind === 'binding' && a.name === 'key'),
      ),
    };
  }

  // Detect ngModel binding (either [(ngModel)] shorthand or [ngModel]/(ngModelChange)
  // long form) for FormsModule wiring. r-model on form-input always lowers to one of
  // these in emitTemplateAttribute → r-model presence on form-input tag triggers it.
  for (const a of node.attributes) {
    if (
      a.kind === 'binding' &&
      a.name === 'r-model' &&
      isFormInputTag(node.tagName)
    ) {
      ctx.hasNgModel.value = true;
      break;
    }
  }

  const attrText = emitAttributes(node.attributes, {
    ir: ctx.ir,
    collisionRenames: ctx.collisionRenames,
    loopBindings: ctx.loopBindings,
    elementTagKind: node.tagKind,
    // Quick task 260520-w18 follow-up — thread the class-body injection sink so
    // a template attr expression with a double-read accessor can synthesise a
    // single-read getter member (strictTemplates double-signal-call narrowing).
    scriptInjections: ctx.scriptInjections,
    // Plan 14-05 — thread the shared injection counter (used by template-event
    // debounce/throttle wrappers) so the `rozieSpread_<N>` ref/effect-field
    // names never collide with same-component event wrappers.
    injectionCounter: ctx.injectionCounter,
    // Plan 14-05 — flag that emitAngular reads to add inject/Renderer2/
    // ElementRef/effect/viewChild to the @angular/core import line.
    hasSpreadBinding: ctx.hasSpreadBinding,
    // Phase 26 — thread the display-wrap flag so a wrapped attribute / class
    // interpolation flips it (same flag the text path uses), gating Task 2's
    // inline fn + class-method synthesis.
    hasDisplayWrap: ctx.hasDisplayWrap,
    // Phase 23 — Task 2: thread the CVA gate so a bound `:disabled` read
    // OR-merges `this.__rozieCvaDisabled()`.
    cvaModelProp: ctx.cvaModelProp,
    cvaMergeDisabled: ctx.cvaMergeDisabled,
  }, node.tagName);

  // Plan 15-05 — partition `node.listenerSpreads` into literal-key entries
  // (synthesized into virtual Listeners spliced alongside `node.events` so
  // the existing same-event grouping fires R6 collision merge AND modifier-
  // bearing keys ride the existing `emitTemplateEvent.ts` modifier-pipeline
  // emit — modifier-bearing literal keys produce the SAME
  // `(click)="__wrapper($event)"` shape that an authored `@click.stop="fn"`
  // would, so the dynamic-Renderer2 path is reserved for genuinely opaque
  // listener objects) and dynamic spreads (emitted as separate per-element
  // `effect()` + `Renderer2.listen()` bodies via `emitListenerSpread`).
  //
  // Defensive `?? []`: synthetic test-IR may omit `listenerSpreads`; the real
  // lowered IR always sets `[]` by construction (Plan 15-01 made the field
  // non-optional on TemplateElementIR).
  const syntheticListenerEvents: Listener[] = [];
  const dynamicListenerSpreads: ListenerSpreadIR[] = [];
  for (const spread of node.listenerSpreads ?? []) {
    const literalKeys = spread.literalKeys;
    if (literalKeys !== undefined && literalKeys.length > 0) {
      for (const lk of literalKeys) {
        syntheticListenerEvents.push(listenerFromLiteralKey(spread, lk));
      }
    } else {
      dynamicListenerSpreads.push(spread);
    }
  }
  // Combine real events + synthetic listener-from-literal-key Listeners.
  // The same-event grouping in emitEvents folds R6 collisions into a single
  // `(click)="__merged_click_N($event)"` template binding (Angular forbids
  // duplicate `(event)=` attributes on one element — Pitfall 1; mandatory).
  const combinedEvents: Listener[] = [...node.events, ...syntheticListenerEvents];
  const eventText = emitEvents(combinedEvents, ctx);

  // Emit each dynamic ListenerSpreadIR as a per-element template-ref +
  // effect()/Renderer2.listen() body. Returns the `#rozieListenersTarget_<N>`
  // template-ref attribute string for splicing onto the open tag. The effect
  // field declarations are pushed onto `ctx.scriptInjections` (consumed by
  // emitAngular's class-body composer).
  const dynamicListenerTexts: string[] = [];
  for (const spread of dynamicListenerSpreads) {
    const text = emitListenerSpread(spread, {
      ir: ctx.ir,
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
      elementTagKind: node.tagKind,
      scriptInjections: ctx.scriptInjections,
      injectionCounter: ctx.injectionCounter,
      hasListenerSpread: ctx.hasListenerSpread,
      needsDestroyRefField: ctx.needsDestroyRefField,
    });
    dynamicListenerTexts.push(text);
  }
  const rHtml = findRHtml(node.attributes);
  const rShow = findRShow(node.attributes);

  // Filter r-html and r-show out of the attribute set we already emitted —
  // we'll add them as Angular property bindings here.
  // (emitAttributes already filters r-html; r-show needs separate handling.)
  const partsHead: string[] = [];
  if (attrText) partsHead.push(attrText);
  if (eventText) partsHead.push(eventText);
  for (const text of dynamicListenerTexts) partsHead.push(text);

  // command-palette-portal-overlay phase — `r-portal="<expr>"` element
  // teleport. Emits a `#roziePortal_<N>` template-ref + a per-element
  // `effect()`/`viewChild()` field pair (AOT-safe, signals-era lifecycle —
  // see emitPortalDirective's doc comment). Mirrors the dynamic-listener-
  // spread wiring immediately above.
  if (node.portalTo) {
    const portalRefText = emitPortalDirective(
      node as TemplateElementIR & { portalTo: NonNullable<TemplateElementIR['portalTo']> },
      {
        ir: ctx.ir,
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
        scriptInjections: ctx.scriptInjections,
        injectionCounter: ctx.injectionCounter,
        hasListenerSpread: ctx.hasListenerSpread,
        needsDestroyRefField: ctx.needsDestroyRefField,
        cvaModelProp: ctx.cvaModelProp,
        cvaMergeDisabled: ctx.cvaMergeDisabled,
        classMembers: ctx.classMembers,
      },
    );
    partsHead.push(portalRefText);
  }

  // Phase 71 (r-keynav) — root `#…`/`[attr.aria-activedescendant]` and item
  // `[id]`/`[attr.data-rozie-keynav-item]`/`[attr.data-rozie-keynav-active]`/
  // `[tabIndex]` fragments. Both resolve to `[]` for the overwhelming
  // majority of elements (no keynav plan, or this element carries neither
  // marker) — a cheap two-property check, not a tree walk, so non-keynav
  // components pay no emission cost (SPEC §11: "no corpus rebless").
  const keynav = ctx.keynav ?? null;
  const keynavAttrs = [
    ...keynavRootAttrs(keynav, node, ctx.ir),
    ...keynavItemAttrs(keynav, node, ctx.keynavItemIndexAlias ?? null, ctx.ir),
  ];
  for (const a of keynavAttrs) partsHead.push(a);

  if (rShow !== null) {
    const expr = rewriteTemplateExpression(rShow.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
      cvaModelProp: ctx.cvaModelProp,
      cvaMergeDisabled: ctx.cvaMergeDisabled,
    });
    partsHead.push(`[style.display]="(${expr}) ? '' : 'none'"`);
  }

  const head = partsHead.length > 0 ? ' ' + partsHead.join(' ') : '';

  // r-html: emit as [innerHTML]="..."
  if (rHtml !== null) {
    if (node.children.length > 0) {
      ctx.diagnostics.push({
        code: RozieErrorCode.TARGET_ANGULAR_RHTML_WITH_CHILDREN, // ROZ721
        severity: 'error',
        message: `r-html cannot coexist with template children on the same element. Move r-html to a child element or remove the children.`,
        loc: node.sourceLoc,
      });
    }
    const expr = rewriteTemplateExpression(rHtml.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
      cvaModelProp: ctx.cvaModelProp,
      cvaMergeDisabled: ctx.cvaMergeDisabled,
    });
    // Phase 06.2 P2: tagKind: 'component'/'self' → rozie-kebab selector.
    const tagOut = resolveAngularTagName(node);
    return `<${tagOut}${head} [innerHTML]="${expr}"></${tagOut}>`;
  }

  // Phase 06.2 P2: tagKind: 'component' | 'self' resolve to the Angular
  // standalone-component selector (rozie-{kebab-case(localName)}); 'html'
  // emits the tag verbatim.
  const tagOut = resolveAngularTagName(node);
  const isVoid = VOID_ELEMENTS.has(node.tagName.toLowerCase());

  if (node.children.length === 0) {
    if (isVoid) return `<${tagOut}${head} />`;
    return `<${tagOut}${head}></${tagOut}>`;
  }

  // Phase 07.2 Plan 03 — Angular consumer-side slot-fill emit (R3 + R4).
  //
  // When this element is a component-tag with structured `slotFillers`, emit
  // each filler as an `<ng-template #ref let-…>…</ng-template>` child of the
  // component tag. This TAKES PRECEDENCE over the D-LIT-ANG-DEFAULT-SLOT
  // wrap path below — when slotFillers populated, the lowerer has already
  // captured the default-slot body as a synthetic `{ name: '' }` filler, so
  // we own the synthesis here.
  //
  // The parallel-array lowering invariant (lowerSlotFillers.ts L186-310)
  // means node.children and node.slotFillers reference the SAME body content;
  // emitting both double-renders. We emit fillers and SKIP the children path.
  if (node.slotFillers !== undefined && node.slotFillers.length > 0) {
    const fillerCtx: EmitSlotFillerCtx = {
      ir: ctx.ir,
      emitChildren: (children) => children.map((c) => emitNode(c, ctx)).join(''),
    };
    const fillerParts: string[] = [];
    const dispatchParts: string[] = [];
    const dynRefs: { refName: string; keyExpr: string; classBodyKeyExpr: string }[] = [];
    // Phase 07.3.2.1-01: consumer-side dynamic-name slot dispatch — bound as
    // an Angular property INPUT on the producer tag (NOT a projected
    // `<ng-container *ngTemplateOutlet>` child). Composed inside the
    // `if (dynRefs.length > 0)` block below; empty-string default preserves
    // D-04 byte-identity for static-only consumers (Pattern A / Pitfall #1).
    let templatesBinding = '';
    let dynIdx = 0;
    for (const filler of node.slotFillers) {
      if (filler.isDynamic) {
        // R5 dynamic-name dispatch (Phase 07.3.2.1-01 closure of F-07.3.2-11-A):
        // emit the body as a synthetic-named `<ng-template #__dynSlot_<N>>`
        // declaration (a child of the producer tag). The CALLER no longer
        // emits an inline projected `<ng-container *ngTemplateOutlet>`
        // dispatcher — Angular components don't render projected children
        // unless they declare `<ng-content>`, so the dispatcher would have
        // been silently dropped. Instead the producer tag is annotated
        // (below, in the `dynRefs.length > 0` block) with a `[templates]=
        // "<getterName>"` property input. The producer's already-correct
        // `templates = input<Record<string, TemplateRef<unknown>> |
        // undefined>(undefined)` signal (Phase 07.3.2 Plan 03) receives the
        // consumer's class-body `templates` getter; its merged guard
        // `@if ((headerTpl ?? templates()?.['header']))` (Plan 10) then
        // resolves the runtime dispatch.
        //
        // Each ViewChild captures one `__dynSlot_<N>` ref so the consumer's
        // getter can compose `{ [<keyExpr>]: this.__dynSlot_<N>! }`.
        const dyn = emitDynamicSlotFiller(filler, fillerCtx, dynIdx);
        if (dyn !== null) {
          fillerParts.push(dyn.template);
          dynRefs.push({
            refName: dyn.refName,
            keyExpr: dyn.keyExpr,
            classBodyKeyExpr: dyn.classBodyKeyExpr,
          });
          dynIdx++;
        }
      } else {
        const text = emitSlotFiller(filler, fillerCtx);
        if (text.length > 0) fillerParts.push(text);
      }
    }
    // For any dynamic-name fillers, register the consumer-side templates
    // getter + per-ref ViewChild fields via scriptInjections. The class
    // body composer in emitAngular appends these as class fields.
    if (dynRefs.length > 0) {
      if (ctx.hasDynamicSlotFiller) ctx.hasDynamicSlotFiller.value = true;
      for (const { refName } of dynRefs) {
        const fieldDecl = `@ViewChild('${refName}', { static: true }) ${refName}?: TemplateRef<unknown>;`;
        // Only inject each per-ref ViewChild once per component (siblings
        // of the same component tag share the same parent class body).
        if (!ctx.scriptInjections.some((s) => s.name === refName)) {
          ctx.scriptInjections.push({ name: refName, decl: fieldDecl });
        }
      }
      // Append a `templates` getter that maps the user's runtime-key
      // expression to each captured ref. Compose the map entries
      // deterministically from the collected dynRefs (one entry per
      // dynamic filler). The class-body getter consumes classBodyKeyExpr
      // (produced by rewriteTemplateExpression with prefixThis:true) so
      // each identifier reference is correctly scoped via `this.` —
      // including template-literal shapes like `` `footer${footerMode()}` ``
      // where a naive outer prefix would be a syntax error.
      const classScopedEntries = dynRefs
        .map((r) => `[${r.classBodyKeyExpr}]: this.${r.refName}!`)
        .join(', ');
      const getterName = 'templates';
      const getterDecl = `get ${getterName}(): Record<string, TemplateRef<unknown>> {\n    return { ${classScopedEntries} };\n  }`;
      // Use a deterministic name so duplicate sibling-component dispatch
      // collapses into a single getter. The map entries from the FIRST
      // appearance win — sibling dynamic fillers must reuse the same
      // getter scope. For Wave 1 (one component tag per dynamic-name
      // fixture), this collapses cleanly; multi-sibling cases land in
      // Plan 07.2-05/06.
      if (!ctx.scriptInjections.some((s) => s.name === getterName)) {
        ctx.scriptInjections.push({ name: getterName, decl: getterDecl });
      }
      // Phase 07.3.2.1-01 — bind the deterministic class-body getter as a
      // property INPUT on the producer tag. Leading-space prefix matches
      // the `head`-composition invariant from L337 (tokenizer-safe append).
      // Reuses `getterName` so a future multi-sibling lift (Plan 07.2-05/06)
      // that promotes the name to `templates_<N>` auto-follows here. The
      // RHS is the bare identifier — Angular's template parser resolves it
      // against the component class, hitting the getter at runtime.
      templatesBinding = ` [${getterName}]="${getterName}"`;
    }
    // `dispatchParts` is intentionally retained as a vestigial declaration
    // above to minimise diff churn (the non-dynamic branch never populated
    // it either; the dynamic branch no longer pushes to it post-Phase
    // 07.3.2.1-01). Future cleanup may delete it once the surrounding
    // shape stabilises.
    const innerFills = fillerParts.join('');
    return `<${tagOut}${head}${templatesBinding}>${innerFills}</${tagOut}>`;
  }

  const inner = node.children.map((c) => emitNode(c, ctx)).join('');

  // D-LIT-ANG-DEFAULT-SLOT: when consuming a Rozie-component (tagKind:
  // 'component' or 'self'), Angular's content-projection model requires the
  // default-slot children to be wrapped in `<ng-template #defaultSlot>`. The
  // component-side emit declares
  //   `@ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: ...`
  // and renders it via `<ng-container *ngTemplateOutlet="defaultTpl">`. Raw
  // children of `<rozie-component>` are silently DROPPED by Angular because
  // there is no `<ng-content>` in the consumed component's view template.
  //
  // Vue/Svelte/Solid/React naturally route children through their own
  // slot/`children:` mechanisms; only Angular needs the explicit ng-template
  // wrapper at the consumer site.
  //
  // We only wrap when the children carry meaningful content (non-whitespace).
  if (
    (node.tagKind === 'component' || node.tagKind === 'self') &&
    node.children.some(isMeaningfulChild)
  ) {
    return `<${tagOut}${head}><ng-template #defaultSlot>${inner}</ng-template></${tagOut}>`;
  }

  return `<${tagOut}${head}>${inner}</${tagOut}>`;
}

function isFormInputTag(tagName: string): boolean {
  const lc = tagName.toLowerCase();
  return lc === 'input' || lc === 'select' || lc === 'textarea';
}

/**
 * Recursively scan an AST node for an `Identifier` whose name equals `name`.
 *
 * Used to decide whether a `hoist`-mode match actually needs its `@let` temp:
 * core (plan 11-01) classifies a literal-`true` predicate-chain discriminant as
 * `hoist` and allocates a `tempName` — but `foldCaseTest` folds each rung to the
 * BARE predicate, so the temp is never referenced. Emitting the `@let` anyway
 * would produce a dead, unused template variable.
 */
function astReferencesIdentifier(node: unknown, name: string): boolean {
  if (node === null || typeof node !== 'object') return false;
  const n = node as { type?: string; name?: string };
  if (n.type === 'Identifier' && n.name === name) return true;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'sourceLoc') continue;
    const value = (node as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (astReferencesIdentifier(item, name)) return true;
      }
    } else if (value !== null && typeof value === 'object') {
      if (astReferencesIdentifier(value, name)) return true;
    }
  }
  return false;
}

/** True when at least one folded branch test references the hoist temp. */
function hoistTempIsReferenced(node: TemplateMatchIR): boolean {
  if (node.tempName === undefined) return false;
  const tempName = node.tempName;
  return node.branches.some(
    (b) => b.test !== null && astReferencesIdentifier(b.test, tempName),
  );
}

/**
 * D-02 — the `r-match` (`TemplateMatch`) delegate.
 *
 * `node.branches` is byte-identical to `TemplateConditionalIR.branches` (the
 * `r-case`/`r-default` tests are pre-folded by core, plan 11-01), so emitting a
 * match is pure delegation: construct a synthetic `TemplateConditional` and
 * hand it to the existing `emitConditional`. No bespoke `emitMatch` logic, no
 * touch to `emitConditional`'s signature.
 *
 * When `node.hostElement` is present (a real-element host, `<div r-match>`),
 * the conditional ladder is rendered as the single child of a synthetic copy
 * of that host element — so the host tag + its attributes survive to emitted
 * output (R8), mirroring how a real-element `r-if` host keeps its tag.
 *
 * The `discriminantMode === 'hoist'` path (D-04 — plan 11-06): an impure
 * `CallExpression` discriminant must be evaluated EXACTLY ONCE per render.
 * Angular has no `@let` precedent (`grep "@let"` across the emitter → zero
 * hits); `@let` is Angular 18.1+ template syntax, valid on the 19+ floor. We
 * emit `@let <tempName> = <rewritten-discriminant>;` as a line IMMEDIATELY
 * BEFORE the `@if` ladder, in the SAME template view — an `@let` is visible to
 * the following siblings in its view, so the `@if` ladder's folded branch
 * tests (`<tempName> === <caseValue>`, pre-folded by core, plan 11-01) resolve.
 * Nested hoisting matches recurse through `emitNode`; the core per-component
 * counter (plan 11-01) guarantees their `tempName`s never collide.
 */
function emitMatchNode(node: TemplateMatchIR, ctx: EmitNodeCtx): string {
  const synthetic: TemplateConditionalIR = {
    type: 'TemplateConditional',
    branches: node.branches,
    sourceLoc: node.sourceLoc,
  };
  // D-04 hoist: build the `@let` declaration line. It must precede the `@if`
  // ladder in the same view so the ladder's `<tempName>` references resolve.
  // The `hoistTempIsReferenced` guard skips the `@let` for literal-`true`
  // predicate-chain matches (core marks them `hoist` and allocates a `tempName`,
  // but each rung folds to a bare predicate that never mentions the temp).
  let letLine = '';
  if (
    node.discriminantMode === 'hoist' &&
    node.tempName !== undefined &&
    hoistTempIsReferenced(node)
  ) {
    const rewritten = rewriteTemplateExpression(node.discriminant, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
      cvaModelProp: ctx.cvaModelProp,
      cvaMergeDisabled: ctx.cvaMergeDisabled,
    });
    letLine = `@let ${node.tempName} = ${rewritten};\n`;
  }
  if (node.hostElement !== undefined) {
    // Real-element host: the `@let` lives inside the host element's view,
    // immediately before the ladder, so it stays in scope for the ladder.
    const ladderText: TemplateStaticTextIR = {
      type: 'TemplateStaticText',
      text: letLine + emitConditional(synthetic, ctx, emitNode),
      sourceLoc: node.hostElement.sourceLoc,
    };
    const wrapper: TemplateElementIR = {
      ...node.hostElement,
      children: [ladderText],
    };
    return emitElement(wrapper, ctx);
  }
  return letLine + emitConditional(synthetic, ctx, emitNode);
}

/** Top-level dispatch over TemplateNode discriminator. */
export function emitNode(node: TemplateNode, ctx: EmitNodeCtx): string {
  switch (node.type) {
    case 'TemplateStaticText':
      return emitStaticText(node);
    case 'TemplateInterpolation':
      return emitInterpolation(node, ctx);
    case 'TemplateFragment':
      return emitFragment(node, ctx);
    case 'TemplateConditional':
      return emitConditional(node as TemplateConditionalIR, ctx, emitNode);
    case 'TemplateMatch':
      return emitMatchNode(node as TemplateMatchIR, ctx);
    case 'TemplateLoop':
      return emitLoop(node, ctx);
    case 'TemplateSlotInvocation':
      return emitSlotInvocation(node as TemplateSlotInvocationIR, {
        ir: ctx.ir,
        emitChildren: (children) => children.map((c) => emitNode(c, ctx)).join(''),
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
        scriptInjections: ctx.scriptInjections,
        injectionCounter: ctx.injectionCounter,
        classMembers: ctx.classMembers,
      });
    case 'TemplateElement':
      return emitElement(node, ctx);
    default: {
      const _exhaustive: never = node;
      void _exhaustive;
      return '';
    }
  }
}

// Re-export for emitTemplate consumers.
export type { AttributeBinding };
