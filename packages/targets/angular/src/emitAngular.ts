/**
 * emitAngular — Phase 5 Plan 05-04a Task 3.
 *
 * Top-level Angular 17+ standalone-component emitter. Mirrors emitVue/emitReact's
 * coordinator orchestration but emits a CLASS body (not function body):
 *
 *   1. emitScript          → { classBody, imports, interfaceDecls }
 *   2. emitTemplate        → { template, scriptInjections, hasNgModel, diagnostics }
 *   3. emitListeners       → { constructorBody, fieldInitializers, needsRenderer }
 *   4. emitStyle           → { stylesArrayBody, diagnostics }
 *   5. registerDecoratorImports — adds NgTemplateOutlet/FormsModule to import set
 *      based on observed template features (Pitfall 10).
 *   6. emitDecorator       → @Component({...}) text
 *   7. Splice template + listener scriptInjections into class body
 *   8. buildShell composes the .ts file via magic-string
 *   9. composeSourceMap produces a real SourceMap referencing the .rozie source.
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-angular` imports —
 * debounce/throttle/outsideClick all inline.
 *
 * Per RESEARCH Pitfall 8: all `inject(Renderer2)` / `inject(DestroyRef)` calls
 * are constructor-body or field initializers — never inside arrow methods.
 *
 * Per CONTEXT D-67: `emitAngular(ir, opts) → { code, map, diagnostics }`.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, TemplateNode, PropDecl } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '@rozie/core';
import type { BlockMap } from '../../../core/src/ast/types.js';
import { splitBlocks } from '../../../core/src/splitter/splitBlocks.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { rewriteRozieImport } from '../../../core/src/codegen/rewriteRozieImport.js';
import { computeScopeHash } from '../../../core/src/codegen/portalCss.js';

/**
 * Phase 06.2 P2 — recursive walk over the IR template detecting any
 * `tagKind: 'self'` element. Mirror of emitVue/emitSvelte helpers; O(n)
 * over the IR tree per threat T-06.2-P2-04 mitigation.
 */
function templateContainsSelfReference(node: TemplateNode | null): boolean {
  if (!node) return false;
  switch (node.type) {
    case 'TemplateElement': {
      if (node.tagKind === 'self') return true;
      for (const child of node.children) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    case 'TemplateConditional': {
      for (const branch of node.branches) {
        for (const child of branch.body) {
          if (templateContainsSelfReference(child)) return true;
        }
      }
      return false;
    }
    case 'TemplateLoop': {
      for (const child of node.body) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    case 'TemplateSlotInvocation': {
      for (const child of node.fallback) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    case 'TemplateFragment': {
      for (const child of node.children) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    default:
      return false;
  }
}
import * as t from '@babel/types';
import type { File } from '@babel/types';
import type { SourceMap } from 'magic-string';
import { emitScript } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitStyle } from './emit/emitStyle.js';
import { emitDecorator, registerDecoratorImports } from './emit/emitDecorator.js';
import { buildShell } from './emit/shell.js';
import { composeSourceMap } from './sourcemap/compose.js';
import { cloneScriptProgram } from './rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from './rewrite/rewriteScript.js';
import {
  cvaDiagnostics as computeCvaDiagnostics,
  hasBooleanDisabledProp,
} from './cvaDiagnostics.js';

/**
 * Bug 5: build a handler-name → parameter-count map from the (un-rewritten)
 * cloned script Program. Maps each top-level `const x = (a, b) => {}` arrow,
 * `const x = function (a) {}` function-expression, and `function x(a) {}`
 * declaration to its `params.length`. Used by emitTemplateEvent's guarded
 * wrapper synthesis to decide whether to pass the event arg to the inner
 * handler (`this.x(e)`) or call it bare (`this.x()`).
 */
function buildHandlerArityMap(program: File): Map<string, number> {
  const arity = new Map<string, number>();
  for (const stmt of program.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        if (!t.isIdentifier(d.id) || !d.init) continue;
        if (
          t.isArrowFunctionExpression(d.init) ||
          t.isFunctionExpression(d.init)
        ) {
          arity.set(d.id.name, d.init.params.length);
        }
      }
      continue;
    }
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      arity.set(stmt.id.name, stmt.params.length);
    }
  }
  return arity;
}

/**
 * Angular-only (template≠module scope alias). Of the `<script>` VALUE-import
 * local names in `valueImportNames`, return those referenced as a BARE,
 * FREE identifier inside any template-context expression — the IR template tree
 * (attribute/property bindings, `@event` handler + `when` expressions,
 * `r-on`/`r-bind` spreads, interpolations, `r-if`/`r-for`/`r-show`/`r-match`
 * structural-directive expressions, `:key`, slot args) AND the `<listeners>`
 * block (`when` + `handler`).
 *
 * The detection is AST-based (NOT a scan of the rendered template string): it
 * harvests `t.Identifier` nodes in read position from each collected
 * `t.Expression`, so an import name that merely appears inside a STRING literal
 * — a CSS class (`class="rozie-flatpickr"`) or a static attribute value — never
 * counts. A string scan would false-positive on those (the import is real but
 * the reference is not), spuriously aliasing it and churning generated leaves.
 *
 * Excludes any name already declared as a component member (`classMembers`) —
 * that is a pre-existing author-level name clash; aliasing it would emit a
 * duplicate field.
 *
 * Returns names de-duplicated and sorted so the emitted alias block is
 * deterministic.
 */
function detectTemplateReferencedImports(
  valueImportNames: ReadonlySet<string>,
  classMembers: ReadonlySet<string>,
  ir: IRComponent,
): string[] {
  if (valueImportNames.size === 0) return [];

  // Harvest every BARE identifier read-reference from a single Expression.
  // Skips: member-property positions (`a.listPlugin` — the `.listPlugin` part),
  // non-computed object keys (`{ listPlugin: 1 }`), and pattern-binding
  // positions (a destructured param / loop var named after an import). String
  // literals are not Identifier nodes, so they are inherently excluded.
  const harvested = new Set<string>();
  const collectFromExpression = (expr: t.Expression | null | undefined): void => {
    if (!expr) return;
    const visit = (node: t.Node, parent: t.Node | null, key: string | null): void => {
      if (t.isIdentifier(node)) {
        // Member property: `obj.NAME` (non-computed) — not a free reference.
        if (
          parent &&
          (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
          parent.property === node &&
          !parent.computed
        ) {
          return;
        }
        // Non-computed object key: `{ NAME: … }` / method key.
        if (
          parent &&
          (t.isObjectProperty(parent) || t.isObjectMethod(parent)) &&
          parent.key === node &&
          !parent.computed
        ) {
          return;
        }
        // Binding position: a pattern subtree (destructured param, loop var).
        if (
          parent &&
          (t.isObjectProperty(parent) ||
            t.isArrayPattern(parent) ||
            t.isObjectPattern(parent) ||
            t.isRestElement(parent) ||
            t.isAssignmentPattern(parent)) &&
          // `key === 'value' | 'elements' | 'argument' | 'left'` are binding
          // sides; only an AssignmentPattern's `right` is an expression side.
          !(t.isAssignmentPattern(parent) && key === 'right')
        ) {
          return;
        }
        // Function param identifiers are bindings, not references.
        if (parent && t.isFunction(parent) && key === 'params') return;
        harvested.add(node.name);
        return;
      }
      for (const k of t.VISITOR_KEYS[node.type] ?? []) {
        const child = (node as unknown as Record<string, unknown>)[k];
        if (Array.isArray(child)) {
          for (const c of child) {
            if (c && typeof c === 'object' && 'type' in c) {
              visit(c as t.Node, node, k);
            }
          }
        } else if (child && typeof child === 'object' && 'type' in child) {
          visit(child as t.Node, node, k);
        }
      }
    };
    visit(expr, null, null);
  };

  // Walk the IR template tree, feeding every Expression-bearing field to the
  // harvester. Mirrors the recursive TemplateNode union (lower.ts shapes).
  const walkNode = (node: TemplateNode | null | undefined): void => {
    if (!node) return;
    switch (node.type) {
      case 'TemplateElement': {
        for (const attr of node.attributes) {
          if (attr.kind === 'binding' || attr.kind === 'twoWayBinding') {
            collectFromExpression(attr.expression);
          } else if (attr.kind === 'spreadBinding') {
            collectFromExpression(attr.expression);
          } else if (attr.kind === 'interpolated') {
            for (const seg of attr.segments) {
              if (seg.kind === 'binding') collectFromExpression(seg.expression);
            }
          }
        }
        for (const ev of node.events) {
          collectFromExpression(ev.when);
          collectFromExpression(ev.handler);
        }
        for (const ls of node.listenerSpreads) {
          collectFromExpression(ls.expression);
        }
        for (const filler of node.slotFillers ?? []) {
          // `<template #[expr]>` dynamic-name expression.
          collectFromExpression(filler.dynamicNameExpr);
          // The filler body is a TemplateNode tree the consumer authored.
          for (const child of filler.body) walkNode(child);
        }
        for (const child of node.children) walkNode(child);
        return;
      }
      case 'TemplateConditional': {
        for (const branch of node.branches) {
          collectFromExpression(branch.test);
          for (const child of branch.body) walkNode(child);
        }
        return;
      }
      case 'TemplateMatch': {
        collectFromExpression(node.discriminant);
        for (const branch of node.branches) {
          collectFromExpression(branch.test);
          for (const child of branch.body) walkNode(child);
        }
        if (node.hostElement) walkNode(node.hostElement);
        return;
      }
      case 'TemplateLoop': {
        collectFromExpression(node.iterableExpression);
        collectFromExpression(node.keyExpression);
        for (const child of node.body) walkNode(child);
        return;
      }
      case 'TemplateSlotInvocation': {
        for (const arg of node.args) collectFromExpression(arg.expression);
        for (const child of node.fallback) walkNode(child);
        return;
      }
      case 'TemplateFragment': {
        for (const child of node.children) walkNode(child);
        return;
      }
      case 'TemplateInterpolation': {
        collectFromExpression(node.expression);
        return;
      }
      case 'TemplateStaticText':
        return;
      default:
        return;
    }
  };
  walkNode(ir.template);

  // `<listeners>`-block expressions (when + handler).
  for (const l of ir.listeners) {
    collectFromExpression(l.when);
    collectFromExpression(l.handler);
  }

  const out: string[] = [];
  for (const name of valueImportNames) {
    // Collision guard: a prop / $data key / exposed method / existing member
    // shadowing the import name is a pre-existing author clash — do NOT emit a
    // duplicate field. (The import still works inside <script>.)
    if (classMembers.has(name)) continue;
    if (harvested.has(name)) out.push(name);
  }
  return out.sort();
}

export interface EmitAngularOptions {
  filename?: string | undefined;
  source?: string | undefined;
  modifierRegistry?: ModifierRegistry | undefined;
  /**
   * Phase 06.1 Plan 01 (DX-04): block byte offsets from splitBlocks() —
   * required by buildShell() for accurate source maps. When omitted,
   * derived from `opts.source` via splitBlocks() if available.
   */
  blockOffsets?: BlockMap | undefined;
  /**
   * Phase 23 (angular-cva-forms-integration) — compiler-config gate for the
   * auto-`ControlValueAccessor` emit. DEFAULT IS ON IN THE EMITTER
   * (`opts.cva ?? true`): when omitted, a component with exactly one
   * `model: true` prop auto-emits the CVA class shape + `NG_VALUE_ACCESSOR`
   * provider + `(focusout)` host binding. Set `false` to suppress CVA on a
   * single-model component (Plan 04 threads this from the compiler config).
   *
   * The default-ON-in-the-emitter rule is load-bearing for the dist-parity
   * byte-equality contract (Pitfall 2): compile()'s emitOpts and unplugin's two
   * direct emitAngular calls all omit `cva`, so they must all behave identically
   * — i.e. ON — without coordination.
   */
  cva?: boolean | undefined;
}

export interface EmitAngularResult {
  code: string;
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

/**
 * Phase 26 (SPEC-1/SPEC-2/SPEC-4, D-01/D-02 via RESEARCH Pitfall 4) — the
 * INLINED, module-scope `rozieDisplay` helper for the Angular target.
 *
 * There is NO `@rozie/runtime-angular` package and project convention forbids
 * one (`emitAngular.ts` header + `collectAngularImports`; `spreadBinding.test.ts`
 * asserts `not.toContain('@rozie/runtime-angular')`). So unlike the other four
 * non-Vue targets — which import `rozieDisplay` from their `@rozie/runtime-*`
 * package — Angular emits the helper body verbatim at module scope.
 *
 * The body is algorithmically byte-equivalent to the runtime-package helper
 * (`packages/runtime/{react,solid,svelte,lit}/src/rozieDisplay.ts`): null/
 * undefined → '', string passthrough, object (incl. arrays) → 2-space JSON,
 * else `String(v)`.
 *
 * Angular templates cannot call a module-scope free function (AOT resolves
 * interpolation/binding identifiers against the COMPONENT instance), so the
 * template never calls `__rozieDisplay` directly — it calls the delegating
 * CLASS METHOD synthesized in `DISPLAY_CLASS_METHOD`, which forwards to this fn.
 *
 * Both are emitted ONLY when at least one interpolation actually wrapped
 * (`tmplResult.hasDisplayWrap`), keeping non-wrapping components byte-identical
 * to pre-phase (SPEC-3).
 */
const INLINE_DISPLAY_FN = [
  'function __rozieDisplay(v: unknown): string {',
  "  if (v == null) return '';",
  "  if (typeof v === 'string') return v;",
  "  if (typeof v === 'object') {",
  '    try {',
  '      return JSON.stringify(v, null, 2);',
  '    } catch {',
  '      // Circular structure or a non-serialisable value (BigInt nested in an',
  '      // object). Degrade to a non-throwing form so the wrap never crashes the',
  '      // render — that is the entire point of "safe" interpolation (SPEC-1).',
  '      return String(v);',
  '    }',
  '  }',
  '  return String(v);',
  '}',
].join('\n');

/**
 * Phase 26 (D-02) — the delegating class method synthesized into the component
 * body (via the `allFieldInjections` / classBodyParts mechanism, the same path
 * the `$expose` methods + listener field initializers use). The template calls
 * `rozieDisplay(expr)` against `this`; this method forwards to the inlined
 * module-scope `__rozieDisplay`. Gated on `tmplResult.hasDisplayWrap`.
 */
const DISPLAY_CLASS_METHOD =
  'rozieDisplay(v: unknown): string { return __rozieDisplay(v); }';

/**
 * 260608-sya — inline module-scope `__rozieAttr` for the WHOLE-VALUE
 * attribute-binding position. Unlike interpolation/text (where nullish → ''),
 * a nullish bound attribute value must DROP the attribute, matching Vue's
 * `:attr` binding. Angular's `[attr.x]="null"` removes the attribute. `false`
 * is NOT dropped (delegates to `__rozieDisplay` → `"false"`), preserving
 * aria-/data- a11y. Depends on `__rozieDisplay`, so both inline whenever the
 * display-wrap flag is set (the attr swap sets the same flag). There is no
 * `@rozie/runtime-angular` package (convention forbids one), so it inlines.
 */
const INLINE_ATTR_FN = [
  'function __rozieAttr(v: unknown): string | null {',
  '  return v == null ? null : __rozieDisplay(v);',
  '}',
].join('\n');

/**
 * 260608-sya — the delegating class method synthesized into the component body
 * (same mechanism as `DISPLAY_CLASS_METHOD`). The template calls `rozieAttr(expr)`
 * against `this`; this forwards to the inlined module-scope `__rozieAttr`.
 * Gated on `tmplResult.hasDisplayWrap` (the attr swap flips it).
 */
const ATTR_CLASS_METHOD =
  'rozieAttr(v: unknown): string | null { return __rozieAttr(v); }';

export function emitAngular(
  ir: IRComponent,
  opts: EmitAngularOptions = {},
): EmitAngularResult {
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  // Pre-compute collisionRenames + classMembers + signalMembers by running a
  // "preview" rewrite — we need them for emitTemplate / emitListeners but
  // emitScript runs the real rewrite internally. The cheapest thing to do is
  // re-run rewrite on a clone here.
  const previewClone = cloneScriptProgram(ir.setupBody.scriptProgram);
  // Bug 5: compute the handler-arity map from the un-rewritten clone BEFORE
  // rewriteRozieIdentifiers mutates it (the rewrite doesn't touch param lists,
  // but compute up-front for clarity + to key by original handler names).
  const handlerArity = buildHandlerArityMap(previewClone);
  const previewRewrite = rewriteRozieIdentifiers(previewClone, ir);
  const collisionRenames = previewRewrite.collisionRenames;
  const classMembers = previewRewrite.classMembers;
  const signalMembers = previewRewrite.signalMembers;

  // Phase 23 (angular-cva-forms-integration) — compute the auto-CVA gate ONCE,
  // here, mirroring the previewRewrite single-source precedent. Every downstream
  // CVA decision (emitScript's methods/members, emitDecorator's providers/host)
  // branches on `cvaModelProp !== null`, NOT on a re-derived model-prop count —
  // this single-gate discipline is what keeps zero-model and ≥2-model components
  // byte-identical to today (Pitfall 5).
  //
  //   - cva omitted        → ON  (opts.cva ?? true — the dist-parity default)
  //   - cva === false      → OFF (cvaModelProp === null regardless of count)
  //   - exactly one model  → that prop (CVA emitted)
  //   - zero or ≥2 models  → null (no single-control accessor; Plan 03 fires
  //                                ROZ125 for the ≥2 case)
  const cvaEnabled = opts.cva ?? true;
  const modelProps = ir.props.filter((p) => p.isModel);
  const cvaModelProp =
    cvaEnabled && modelProps.length === 1 ? modelProps[0]! : null;
  // Phase 23 Plan 03 — populate the reserved slot with ROZ124 (collision error),
  // ROZ125 (≥2-model info), and ROZ126 (no-disabled info). Computed from the IR +
  // the single resolved gate; never throws (D-08). Flows through the diagnostics
  // aggregation spread at the bottom of emitAngular.
  const cvaDiagnostics: Diagnostic[] = computeCvaDiagnostics(
    ir,
    cvaModelProp !== null ? cvaModelProp.name : null,
    // WR-01 — thread the resolved `cva` flag so ROZ125 (multi-model info) is
    // suppressed when the user explicitly opted out via `cva:false`; the info
    // should only fire when the model count is the actual reason no CVA exists.
    cvaEnabled,
  );

  // 1. Script-side emission.
  // Phase 06.1 P2: thread filename for sourceFileName + capture scriptMap.
  // Spike 004 — per-component scope hash for `@portal` CSS scoping. Angular
  // has no native scope-hash infra (it uses `_ngcontent-*`); the shared
  // helper gives the identical FNV-1a value the other targets compute.
  const portalScopeHash = computeScopeHash(ir.name, opts.filename);
  const scriptOpts: {
    filename?: string;
    portalScopeHash?: string;
    cvaModelProp?: PropDecl | null;
  } = {
    portalScopeHash,
    // Phase 23 — thread the single CVA gate so emitScript appends the four CVA
    // methods + three private members when (and only when) it is non-null.
    cvaModelProp,
  };
  if (opts.filename !== undefined) scriptOpts.filename = opts.filename;
  const scriptResult = emitScript(ir, scriptOpts);

  // 2. Template-side emission.
  // Phase 23 — thread the resolved CVA gate so template model-writes inject
  // __rozieCvaOnChange (Task 1) and `disabled` reads OR-merge __rozieCvaDisabled
  // (Task 2). cvaMergeDisabled is true only when CVA-receiving AND a BOOLEAN
  // `disabled` prop is declared (WR-05). A non-Boolean `disabled` prop is NOT
  // OR-merged — `(this.disabled() || this.__rozieCvaDisabled())` mixing e.g. a
  // string with a boolean is truthy-broken (`'no' || false` is `'no'`), so
  // setDisabledState(false) could never re-enable the control. The shared
  // `hasBooleanDisabledProp` helper keeps this gate in lockstep with ROZ126.
  const cvaMergeDisabled =
    cvaModelProp !== null && hasBooleanDisabledProp(ir.props);
  const tmplResult = emitTemplate(ir, registry, {
    collisionRenames,
    handlerArity,
    classMembers,
    cvaModelProp: cvaModelProp !== null ? cvaModelProp.name : null,
    cvaMergeDisabled,
  });

  // 3. Listeners-block emission.
  // Phase 23 — thread the resolved CVA gate (Task 1 write-site / Task 2 disabled
  // merge) into the <listeners>-block lowering.
  const listenersResult = emitListeners(
    ir.listeners,
    ir,
    registry,
    collisionRenames,
    classMembers,
    signalMembers,
    {
      cvaModelProp: cvaModelProp !== null ? cvaModelProp.name : null,
      cvaMergeDisabled,
    },
  );

  // 4. Style emission.
  const styleResult = opts.source !== undefined
    ? emitStyle(ir.styles, opts.source, portalScopeHash)
    : { stylesArrayBody: '', portalStylesEntry: '', diagnostics: [] as Diagnostic[] };

  // 5. Register conditional imports based on template features.
  const imports = scriptResult.imports;
  registerDecoratorImports(imports, {
    hasSlots: ir.slots.length > 0,
    hasNgModel: tmplResult.hasNgModel,
  });

  // Phase 06.2 P2 (Pitfall 5): when a template contains `tagKind: 'self'`,
  // ensure `forwardRef` is in the @angular/core import line BEFORE the
  // decorator + shell render. Defensive `?? []` guards pre-P1 hand-rolled IRs.
  const components = ir.components ?? [];
  const selfReferenced = templateContainsSelfReference(ir.template);
  if (selfReferenced) {
    imports.add('forwardRef');
  }

  // Phase 23 — when the CVA gate is active the emitted class needs:
  //   - `signal`     for the `private __rozieCvaDisabled = signal(false)` member
  //                  (NOT guaranteed present: collectAngularImports only adds
  //                  `signal` when `ir.state.length > 0`).
  //   - `forwardRef` for the self-referencing `useExisting: forwardRef(() => X)`
  //                  in the NG_VALUE_ACCESSOR provider (the collector adds it for
  //                  the `tagKind: 'self'` template case, not for CVA — add
  //                  unconditionally here; the import Set dedupes).
  //   - `NG_VALUE_ACCESSOR` from @angular/forms — the provider token.
  if (cvaModelProp !== null) {
    imports.add('signal');
    imports.add('forwardRef');
    imports.addForms('NG_VALUE_ACCESSOR');
  }

  // Phase 07.2 Plan 04 (R5 dynamic-name): when the consumer's template emits
  // at least one dynamic-name slot filler (`<template #[expr]>`), the
  // dispatcher needs `ViewChild` + `TemplateRef` from @angular/core and
  // `NgTemplateOutlet` from @angular/common (the decorator emitter already
  // adds NgTemplateOutlet when hasSlots is true — for the consumer-side
  // case we add it explicitly here since the IR.slots list is empty on a
  // pure consumer with no producer-side slots of its own).
  if (tmplResult.hasDynamicSlotFiller) {
    imports.add('ViewChild');
    imports.add('TemplateRef');
    imports.addCommon('NgTemplateOutlet');
  }

  // Debug fix(33-04) (tiptap-nodeview): the multi-source class/style merge path
  // emits `[ngClass]` / `[ngStyle]` bindings. These are NOT Angular built-ins
  // (unlike `[class]`/`[style]`) — they require the `NgClass` / `NgStyle`
  // directives from `@angular/common` to be in the standalone component's
  // `imports: [...]`. Without them the binding is an inert DOM property
  // assignment (`element.ngClass = ...`) that silently never applies the merged
  // class — surfaced where a dynamic `:class` is load-bearing inside an embedded
  // view (the TipTap reactive node-view portal slot's scoped `display:none`).
  // Add to BOTH the @angular/common import line (collector) AND the decorator
  // `imports: [...]` array (emitDecorator opts below). Gated on the emitted
  // template actually containing the binding, so directive-free components stay
  // byte-identical.
  if (tmplResult.usesNgClass) {
    imports.addCommon('NgClass');
  }
  if (tmplResult.usesNgStyle) {
    imports.addCommon('NgStyle');
  }

  // Plan 14-05 / D-01 — when the template lowered at least one `spreadBinding`
  // (`r-bind="<expr>"` or the synthesized `$attrs` auto-fallthrough), the
  // emitted component needs `inject` (for the shared `__rozieApplyAttrs`
  // IIFE's `Renderer2` injection), `Renderer2` (the safe imperative DOM API),
  // `ElementRef` (the `viewChild<ElementRef>(...)` generic),
  // `afterRenderEffect` (the post-render reactive subscriber — Phase 14.1 /
  // WR-A1: post-render ordering is load-bearing so the merged class/style
  // wins over the wrapper-author's own `[ngClass]` / `ɵɵstyleMap` bindings,
  // which re-fire after a plain `effect()` and clobber the merge), and
  // `viewChild` (the signal-based template-ref query). Same conditional-
  // import pattern as `hasDynamicSlotFiller`.
  if (tmplResult.hasSpreadBinding) {
    imports.add('inject');
    imports.add('Renderer2');
    imports.add('ElementRef');
    imports.add('afterRenderEffect');
    imports.add('viewChild');
  }

  // Plan 15-05 / D-13 — when the template lowered at least one dynamic
  // `ListenerSpreadIR`, the emitted component needs the same `inject` /
  // `Renderer2` / `ElementRef` / `effect` / `viewChild` surface as the
  // attribute spread, plus `DestroyRef` (for the per-spread one-time
  // `__rozieDestroyRef.onDestroy(...)` cleanup registration — D-14 contract).
  // `effect` (not `afterRenderEffect`) is sufficient here because listener
  // attach/detach has no class/style binding race the post-render scheduling
  // was solving for the attribute spread; standard `effect()` runs once per
  // reactive read change and is the right schedule for `addEventListener`.
  // Import overlap with `hasSpreadBinding` is deduped by the collector Set.
  if (tmplResult.hasListenerSpread) {
    imports.add('inject');
    imports.add('Renderer2');
    imports.add('ElementRef');
    imports.add('effect');
    imports.add('viewChild');
    imports.add('DestroyRef');
  }

  // Portal-slot primitive (Spike 003) — append `<ng-container #rozie_portalAnchor>`
  // to the rendered template so the ViewContainerRef query has an anchor to
  // read. The portal closure synthesized in ngAfterViewInit reads from this
  // anchor; without it `_portalAnchor()` returns undefined and every portal
  // mount silently no-ops.
  const finalTemplate =
    scriptResult.portalTemplateAppend.length > 0
      ? tmplResult.template + scriptResult.portalTemplateAppend
      : tmplResult.template;

  // 6. Build the @Component decorator.
  const decorator = emitDecorator(ir, {
    componentName: ir.name,
    template: finalTemplate,
    stylesArrayBody: styleResult.stylesArrayBody,
    portalStylesEntry: styleResult.portalStylesEntry,
    hasSlots: ir.slots.length > 0,
    hasNgModel: tmplResult.hasNgModel,
    hasDynamicSlotFiller: tmplResult.hasDynamicSlotFiller,
    usesNgClass: tmplResult.usesNgClass,
    usesNgStyle: tmplResult.usesNgStyle,
    componentDecls: components,
    selfReferenced,
    // Phase 23 — gate providers: NG_VALUE_ACCESSOR + host: (focusout) on the
    // single CVA prop. Decorator branches on `cvaModelProp !== null`.
    cvaModelProp,
  });

  // 7. Compose the class body. Insertion order:
  //    - existing classBody from emitScript (fields + constructor + computed + methods + guard)
  //    - listener field initializers (debounce/throttle wraps) — appended to fields
  //    - listener effect blocks — spliced into constructor body
  //    - template scriptInjections (debounce/throttle template-event wraps,
  //      guarded handler wrappers) — appended to fields
  //
  // Strategy: rather than re-parse the classBody string, we splice fragments
  // into well-known anchor positions. The classBody from emitScript has the
  // shape:
  //
  //   <field declarations>
  //
  //   constructor() {
  //     <existing constructor body>
  //   }
  //
  //   <computed properties>
  //
  //   <user methods>
  //
  //   [optional ngTemplateContextGuard]
  //
  // To inject listener effect blocks into the constructor body and add
  // listener/template field initializers, we splice both fragments into the
  // classBody string.
  let classBody = scriptResult.classBody;

  // Plan 15-05 / Phase 13 coordination — when emitTemplate's dynamic
  // listener-spread lowering needs the `__rozieDestroyRef.onDestroy(...)`
  // cleanup registration AND the class body does NOT already declare the
  // shared `private __rozieDestroyRef = inject(DestroyRef);` field (it would
  // already be there when the component uses `$onMount` paired-cleanup OR
  // portal slots — emitScript handles both of those sources directly via
  // `lifecycleNeedsDestroyRefField`), prepend the field declaration to the
  // template scriptInjections so the union site below produces exactly ONE
  // field declaration per component (the regression to avoid per memory
  // `project_rozie_angular_onmount_emit_bug`). The string-level "already
  // declares" check uses a literal-substring match against the emitted shape;
  // both emitScript's L895 emit and this synthesised emit use the same
  // canonical text so the dedupe is exact.
  const HOIST_DESTROY_REF_LINE =
    'private __rozieDestroyRef = inject(DestroyRef);';
  const destroyRefAlreadyEmitted = classBody.includes(HOIST_DESTROY_REF_LINE);
  const destroyRefSynthesised: string[] = [];
  if (tmplResult.needsDestroyRefField && !destroyRefAlreadyEmitted) {
    destroyRefSynthesised.push(HOIST_DESTROY_REF_LINE);
  }

  // Inject `const renderer = inject(Renderer2);` at the top of constructor
  // body when listener effect blocks are present. The fragment is spliced
  // right after `constructor() {\n` and before the existing body.
  // Angular-only (template≠module scope) — alias every `<script>` VALUE-import
  // whose local name is referenced inside a template-context expression (the
  // emitted template OR the lowered `<listeners>` constructor body) to a
  // `protected readonly <name> = <name>;` component field. Angular AOT resolves
  // a bare template identifier against the component INSTANCE, but the import is
  // hoisted to module scope and is not a class member — so without the alias the
  // reference is `undefined` at runtime AND the import is tree-shaken (its only
  // use lives in the separate template compilation context). The field name ===
  // the import local name so the UNCHANGED bare template reference resolves
  // against `this` (Angular templates reference members bare); `readonly` (not
  // mutable) and `protected` (AOT template type-checking cannot see `private`).
  // Imports used ONLY in `<script>` (not referenced in any template/listener
  // expression) are NOT aliased — they already work via the module import; only
  // template-referenced value imports need this. Collision-guarded against
  // existing class members inside the detector. The other five targets emit
  // NOTHING new (this whole block is Angular-only), so their output stays
  // byte-identical.
  const templateReferencedImports = detectTemplateReferencedImports(
    scriptResult.valueImportNames,
    classMembers,
    ir,
  );

  const allFieldInjections: string[] = [
    ...destroyRefSynthesised,
    ...listenersResult.fieldInitializers.map((fi) => fi.decl),
    ...tmplResult.scriptInjections.map((si) => si.decl),
    // Quick task 260520-w18 bug class 6(ii) — expose well-known JS global
    // namespaces referenced in template expressions (e.g. `Math.round(...)`)
    // as component members so Angular's `strictTemplates` resolves them
    // against the class instead of failing TS2339.
    ...tmplResult.usedGlobals.map((g) => `protected readonly ${g} = ${g};`),
    // Angular-only — `<script>` value-imports referenced in template-context
    // expressions, aliased to a `protected readonly` field (see block above).
    ...templateReferencedImports.map((n) => `protected readonly ${n} = ${n};`),
    // Phase 26 (D-02) — the delegating `rozieDisplay` class method, synthesized
    // ONLY when an interpolation wrapped. The template calls it against `this`;
    // it forwards to the inlined module-scope `__rozieDisplay` (emitted below
    // via the interfaceDecls bucket). Both gated on the same flag so a
    // non-wrapping component stays byte-identical to pre-phase (SPEC-3).
    ...(tmplResult.hasDisplayWrap ? [DISPLAY_CLASS_METHOD] : []),
    // 260608-sya — the delegating `rozieAttr` class method, synthesized on the
    // SAME flag (a wrapped whole-value attr binding flips `hasDisplayWrap`).
    // `__rozieAttr` depends on `__rozieDisplay`, so both inline together.
    ...(tmplResult.hasDisplayWrap ? [ATTR_CLASS_METHOD] : []),
  ];

  // Find the constructor block and splice the listener effects + renderer
  // setup INTO it. If no constructor exists yet (no script body, no
  // lifecycle, no listeners), synthesize one.
  if (listenersResult.constructorBody.length > 0) {
    const rendererSetup = `    const renderer = inject(Renderer2);`;
    const listenerBlock = `    ${listenersResult.constructorBody}`;

    if (/constructor\s*\(\s*\)\s*\{/.test(classBody)) {
      // Insert renderer + listener blocks right BEFORE the existing
      // constructor body's content. Match the constructor opening, then
      // splice content right after. Use a whitespace-flexible regex so a
      // future @babel/generator formatting change (extra space, compact flag,
      // etc.) does not silently drop the constructor injection. Closes WR-05.
      classBody = classBody.replace(
        /constructor\s*\(\s*\)\s*\{\n/,
        `constructor() {\n${rendererSetup}\n\n${listenerBlock}\n\n`,
      );
    } else {
      // No constructor — synthesize one.
      const synthesized = [
        `constructor() {`,
        rendererSetup,
        ``,
        listenerBlock,
        `}`,
      ].join('\n');
      // Append after field declarations (before any computed/method/guard sections).
      // Heuristic: append at end of fields section. Simplest — prepend before
      // first non-field block (computed/method/guard). For v1, prepend after
      // the first non-field newline. As a robust fallback, prepend the
      // synthesized constructor at the start of classBody.
      classBody = synthesized + '\n\n' + classBody;
    }
  }

  // Append additional field initializers (debounce/throttle wrappers from
  // listeners + template events, guarded handler methods). Place AFTER user
  // methods so they can reference them in arrow bodies if needed.
  if (allFieldInjections.length > 0) {
    classBody = classBody + '\n\n' + allFieldInjections.join('\n\n');
  }

  // 8. Build the .ts shell.
  // Phase 06.1 Plan 01 (DX-04) — anchor MagicString at .rozie source bytes via
  // overwrite() over the <rozie> envelope's byte range. blockOffsets resolution:
  //   1. opts.blockOffsets (caller threaded splitBlocks result through)
  //   2. derive from opts.source via splitBlocks()
  //   3. degenerate empty BlockMap (legacy fallback path).
  let resolvedBlockOffsets: BlockMap;
  if (opts.blockOffsets !== undefined) {
    resolvedBlockOffsets = opts.blockOffsets;
  } else if (opts.source !== undefined) {
    resolvedBlockOffsets = splitBlocks(opts.source, opts.filename);
  } else {
    resolvedBlockOffsets = {};
  }

  // Phase 06.2 P2 (D-118): synthesize NAMED top-of-file component imports
  // (skipping self-entry — the class is in scope of its own decorator and
  // referenced via forwardRef(() => Self) in @Component({ imports: [...] })).
  const componentImportsLines: string[] = components
    .filter((decl) => decl.localName !== ir.name)
    .map((decl) => {
      const rewritten = rewriteRozieImport(decl.importPath, 'angular');
      return `import { ${decl.localName} } from '${rewritten}';`;
    });
  const componentImportsBlock =
    componentImportsLines.length > 0
      ? componentImportsLines.join('\n') + '\n'
      : '';

  // Phase 26 (D-01-correction/D-02) — when any interpolation wrapped, append the
  // inlined module-scope `function __rozieDisplay(v)` to the module-scope decls
  // bucket (rendered above the @Component class by the shell). NO
  // `@rozie/runtime-angular` import is emitted (the package does not exist;
  // convention forbids it). When nothing wrapped, the bucket is unchanged so the
  // emitted file is byte-identical to pre-phase (SPEC-3).
  // 260608-sya — `__rozieAttr` is appended alongside `__rozieDisplay` (it
  // delegates to it). Both inline only when the display-wrap flag is set, so a
  // non-wrapping component's module-scope decls stay byte-identical to pre-phase.
  const moduleDecls = tmplResult.hasDisplayWrap
    ? [...scriptResult.interfaceDecls, INLINE_DISPLAY_FN, INLINE_ATTR_FN]
    : scriptResult.interfaceDecls;

  const { ms, scriptOutputOffset, scriptMap: shellScriptMap, userCodeLineOffset } = buildShell({
    importLines: imports.render(),
    interfaceDecls: moduleDecls,
    decorator,
    componentName: ir.name,
    classBody,
    rozieSource: opts.source ?? '',
    blockOffsets: resolvedBlockOffsets,
    scriptMap: scriptResult.scriptMap,
    preambleSectionLines: scriptResult.preambleSectionLines,
    componentImportsBlock,
    userImports: scriptResult.userImports,
  });

  const code = ms.toString();

  // 9. Phase 06.1 P2 (D-109): composeSourceMap chains shell map + scriptMap
  // via composeMaps(). Pass userCodeLineOffset so the semicolon-prefix VLQ
  // shift aligns script map generated lines with actual .ts output lines.
  const map =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(ms, {
          filename: opts.filename,
          source: opts.source,
          scriptMap: shellScriptMap,
          scriptOutputOffset,
          userCodeLineOffset,
        })
      : null;

  return {
    code,
    map,
    diagnostics: [
      ...scriptResult.diagnostics,
      ...tmplResult.diagnostics,
      ...listenersResult.diagnostics,
      ...styleResult.diagnostics,
      ...cvaDiagnostics,
    ],
  };
}
