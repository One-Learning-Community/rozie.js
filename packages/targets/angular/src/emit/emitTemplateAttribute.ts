/**
 * emitTemplateAttribute — Phase 5 Plan 05-04a Task 2.
 *
 * Renders an element's AttributeBinding[] as Angular-template attribute strings.
 *
 * Three AttributeBinding kinds:
 *   - 'static'       — `class="counter"` (HTML-escape value)
 *   - 'binding'      — `[prop]="expr"` (Angular property binding)
 *   - 'interpolated' — segments[]; emit as Angular template-literal binding:
 *                      `[class]="\`card card--${variant()}\`"`
 *
 * Special-case attribute names:
 *   - `r-model` on form input  → `[(ngModel)]="formData().x"` (FormsModule
 *     wired by emitDecorator).
 *   - `ref="name"`             → `#name` (Angular template-ref variable).
 *   - `r-html="expr"`          → emitted as `[innerHTML]="expr"` and ROZ721
 *     when the same element has children. Filtered from regular attribute
 *     emission by emitTemplateNode.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type {
  IRComponent,
  AttributeBinding,
} from '../../../../core/src/ir/types.js';
import {
  rewriteTemplateExpression,
  hoistTemplateDoubleReadAccessor,
} from '../rewrite/rewriteTemplateExpression.js';
import type { AngularScriptInjection } from './emitTemplateEvent.js';

export interface EmitAttrCtx {
  ir: IRComponent;
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  /** Loop-local bindings in scope (e.g., `item` from r-for). */
  loopBindings?: ReadonlySet<string> | undefined;
  /**
   * Phase 06.2 — element's tagKind. When 'component' or 'self', kebab-case
   * binding names are camelCased before emit (Angular component properties
   * are camelCase by convention, and Angular rejects `on-` prefix bindings
   * with NG0306 for security). HTML elements keep kebab-case; dynamic
   * `aria-*` / `data-*` are additionally routed through Angular's
   * `[attr.NAME]` form by `resolveBindingName` — a plain `[aria-label]`
   * property binding is a silent no-op (no scalar DOM property exists).
   */
  elementTagKind?: 'html' | 'component' | 'self';
  /**
   * Quick task 260520-w18 follow-up — class-body field injections collected
   * during attribute emission. When a template attribute expression reads the
   * SAME `$props.X` / `$data.X` accessor 2+ times in a guard-and-use shape,
   * a single-read getter member is synthesised here and the attribute binds to
   * it instead — Angular `strictTemplates` cannot narrow a signal-call result
   * across two independent `X()` calls. emitTemplateNode threads its own
   * `scriptInjections` array + `injectionCounter` through so the synthesised
   * getter lands in the class body via emitAngular's class-body composer.
   * Synthesised member names are disambiguated against the names already in
   * this array, so no separate counter is needed.
   */
  scriptInjections?: AngularScriptInjection[] | undefined;
  /**
   * Plan 14-05 / D-01 — per-component counter for the `rozieSpread_<N>`
   * template-ref / `__rozieSpread_<N>_effect` field-decl pair synthesised on
   * every `spreadBinding`. The same counter is shared with `emitTemplateEvent`
   * so suffixes never collide. emitTemplateNode threads its own counter
   * through this channel; absent → the spreadBinding arm allocates fresh
   * names with `0` as the start.
   */
  injectionCounter?: { next: number } | undefined;
  /**
   * Plan 14-05 — set to `true` by the `spreadBinding` arm when at least one
   * `r-bind`/`$attrs` spread was lowered to the `effect()` + `Renderer2`
   * `applyAttrs` path. emitAngular reads this off `EmitTemplateResult` and
   * conditionally adds `inject`/`Renderer2`/`ElementRef`/`effect`/`viewChild`
   * to the `@angular/core` import line (the same pattern `hasDynamicSlotFiller`
   * uses to add `ViewChild`/`TemplateRef`/`NgTemplateOutlet`).
   */
  hasSpreadBinding?: { value: boolean } | undefined;
}

/**
 * Convert kebab-case to camelCase for component property bindings.
 * `on-close` → `onClose`. `aria-label` and `data-*` are NEVER passed to this
 * helper because callers gate on tagKind: 'component'|'self'. HTML element
 * bindings keep kebab-case.
 */
function kebabToCamel(name: string): string {
  if (!name.includes('-')) return name;
  return name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

/** Minimal HTML attribute-value escape (single-quoted Angular attribute syntax). */
function escapeAttrValue(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * HTML attributes whose dynamic Angular binding name differs from the
 * lowercased HTML attribute name. Angular `[name]="expr"` is a DOM-PROPERTY
 * binding: `[colspan]` assigns a no-op `el['colspan']` expando — the real
 * `colSpan` property and `colspan` attribute stay at their default, so the
 * binding silently does nothing (the table cell never spans). The DOM
 * property is camelCased; emit that.
 *
 * This is the FULL set of current-spec, non-deprecated HTML attributes with a
 * simple camelCase casing mismatch — table layout, form controls, media /
 * embedding, microdata, etc. We list them all rather than only the ones an
 * example happens to exercise: a missing entry is a silent no-op footgun that
 * surfaces only at runtime, with no compile error to catch it.
 *
 * Every value is a VERIFIED standard DOM-property name — NOT a React-JSX
 * alias. React's attribute map cannot be copied wholesale: React's `srcSet` /
 * `spellCheck` / `autoComplete` are React-isms whose real DOM properties are
 * lowercase (`srcset` / `spellcheck` / `autocomplete`), so a blind copy would
 * emit NEW silent no-ops. Attributes already lowercase as DOM properties
 * (`srcset`, `spellcheck`, `autocomplete`, `autofocus`, `hreflang`, `enctype`,
 * …) are correctly absent — `[srcset]` works as-is.
 *
 * DELIBERATELY EXCLUDED:
 *   - `aria-*` / `data-*`: attribute-only (no scalar DOM property), so a
 *     dynamic `:aria-label` / `:data-x` needs Angular's `[attr.aria-label]`
 *     form — a property-vs-attribute decision, not a casing remap. Handled
 *     separately in `resolveBindingName` (which prefixes `attr.`), NOT via
 *     this casing map.
 *   - Deprecated/obsolete attrs (`cellpadding`, `frameborder`, `bgcolor`,
 *     `valign`, `marginwidth`, …) — out of scope for modern target frameworks.
 *   - `popovertarget` — reflects to an *element* reference, not a string;
 *     not a simple casing remap.
 *
 * STATIC attributes are unaffected — `colspan="3"` emits as a plain HTML
 * attribute, which the browser reflects onto `colSpan` natively. Property
 * binding (not `[attr.]`) is also why this map is correct for the boolean
 * members (`readonly`, `ismap`, `nomodule`, `novalidate`, `formnovalidate`,
 * `playsinline`, `allowfullscreen`, `itemscope`): `[attr.readonly]="false"`
 * leaves `readonly="false"` present (still readonly), whereas `[readOnly]=
 * "false"` correctly clears it.
 */
const HTML_ATTR_CASING: Readonly<Record<string, string>> = {
  // Table layout
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  // Global / accessibility
  tabindex: 'tabIndex',
  contenteditable: 'contentEditable',
  accesskey: 'accessKey',
  inputmode: 'inputMode',
  enterkeyhint: 'enterKeyHint',
  // Form controls
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  for: 'htmlFor',
  novalidate: 'noValidate',
  formaction: 'formAction',
  formenctype: 'formEnctype',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  acceptcharset: 'acceptCharset',
  dirname: 'dirName',
  // Media / embedding
  crossorigin: 'crossOrigin',
  referrerpolicy: 'referrerPolicy',
  fetchpriority: 'fetchPriority',
  usemap: 'useMap',
  ismap: 'isMap',
  playsinline: 'playsInline',
  allowfullscreen: 'allowFullscreen',
  nomodule: 'noModule',
  // Time
  datetime: 'dateTime',
  // Microdata
  itemid: 'itemId',
  itemprop: 'itemProp',
  itemref: 'itemRef',
  itemscope: 'itemScope',
  itemtype: 'itemType',
};

/**
 * Resolve the Angular binding name for an attribute bound on the current
 * element. Component/self tags camelCase kebab names (Angular `@Input`
 * convention). HTML elements keep the name verbatim EXCEPT casing-mismatched
 * DOM-property attributes (see HTML_ATTR_CASING), which must bind to the
 * camelCase property or the binding is a silent no-op.
 */
function resolveBindingName(name: string, ctx: EmitAttrCtx): string {
  if (isComponentTag(ctx)) return kebabToCamel(name);
  // `aria-*` / `data-*` have no scalar DOM property — Angular's default
  // `[name]` is a DOM-PROPERTY binding, so `[aria-label]="x"` assigns a no-op
  // `el['aria-label']` expando and the real attribute is never set. The
  // attribute-binding form `[attr.aria-label]="x"` sets it correctly. Every
  // `binding` / `interpolated` emit path wraps this return value as
  // `[<name>]="…"`, so returning `attr.aria-label` here yields a valid
  // `[attr.aria-label]` target. (STATIC `aria-`/`data-` attributes bypass this
  // — they emit as plain HTML attributes via the `attr.kind === 'static'`
  // branch — and component tags never reach this line.)
  if (name.startsWith('aria-') || name.startsWith('data-')) {
    return `attr.${name}`;
  }
  return HTML_ATTR_CASING[name] ?? name;
}

/** Render interpolated segments as the inside of a JS template literal. */
function renderInterpolatedTemplateLiteral(
  segments: Array<
    | { kind: 'static'; text: string }
    | { kind: 'binding'; expression: t.Expression; deps: unknown }
  >,
  ctx: EmitAttrCtx,
): string {
  let out = '';
  for (const seg of segments) {
    if (seg.kind === 'static') {
      out += seg.text
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${');
    } else {
      out += '${' + rewriteTemplateExpression(seg.expression, ctx.ir, {
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
      }) + '}';
    }
  }
  return out;
}

/**
 * Test whether an attribute should map to `[(ngModel)]` rather than the
 * generic `[r-model]="..."` shape. r-model on form input/select/textarea is
 * the v1 contract.
 */
function isFormInputTag(tagName: string): boolean {
  const lc = tagName.toLowerCase();
  return lc === 'input' || lc === 'select' || lc === 'textarea';
}

/**
 * Phase 12 — partition a resolved `r-model` modifier list into the pieces the
 * Angular emitter needs:
 *   - `valueTransforms`: ordered `$v`-placeholder fragments (D-07-canonical).
 *   - `isLazy`: whether any modifier declares `eventSwap: 'change'` (`.lazy`).
 */
function partitionAngularModelModifiers(
  modifiers:
    | { name: string; descriptor: { valueTransform?: string; eventSwap?: 'change' } }[]
    | undefined,
): { valueTransforms: string[]; isLazy: boolean } {
  const valueTransforms: string[] = [];
  let isLazy = false;
  for (const m of modifiers ?? []) {
    if (m.descriptor.valueTransform) valueTransforms.push(m.descriptor.valueTransform);
    if (m.descriptor.eventSwap === 'change') isLazy = true;
  }
  return { valueTransforms, isLazy };
}

/**
 * Phase 12 / CR-02 (12-REVIEW) — substitute the reserved `$v` value-access
 * placeholder token in a `valueTransform` fragment. Token-aware: only `$v`
 * appearing as a standalone token (not part of a longer identifier such as
 * `$value` or `__$v_tmp`) is replaced, so a chain step whose intermediate
 * output contains the literal substring `$v` cannot be double-substituted by
 * a later iteration. `$` is a JS identifier character, so the lookbehind
 * excludes both `\w` and `$` and the lookahead excludes `\w`.
 */
function substituteValuePlaceholder(
  fragment: string,
  replacement: string,
): string {
  return fragment.replace(/(?<![\w$])\$v(?!\w)/g, `(${replacement})`);
}

/**
 * Phase 12 — splice the resolved `valueTransform` fragments into a value-access
 * expression STRING. Each fragment carries the literal `$v` placeholder (D-03);
 * substitute `$v` with the current expression text and chain. Empty list ⇒ the
 * input string is returned unchanged.
 */
function applyValueTransformsString(
  valueAccess: string,
  valueTransforms: string[],
): string {
  let current = valueAccess;
  for (const fragment of valueTransforms) {
    current = substituteValuePlaceholder(fragment, current);
  }
  return current;
}

/**
 * Resolve a writable signal-backed LHS to its signal identifier name.
 *
 * Returns the bare signal name when `expr` is `$data.X` (where X is a declared
 * state signal) or `$props.X` (where X is a declared model prop). Returns null
 * for any other shape — caller falls back to a one-way binding.
 *
 * Shared by the `r-model` form-input branch (emits `[ngModel]`/`(ngModelChange)`)
 * and the Phase 07.3 consumer-side two-way binding branch (emits
 * `[prop]`/`(propChange)` per D-01 long-form). Both call sites historically
 * inlined the same logic; extracted here for parity. Behaviour preserved
 * byte-for-byte — the existing form-input snapshot lock is unaffected.
 */
function resolveSignalNameForLValue(
  expr: t.Expression,
  ir: IRComponent,
): string | null {
  if (expr.type !== 'MemberExpression') return null;
  const me = expr;
  if (
    me.computed ||
    me.property.type !== 'Identifier' ||
    me.object.type !== 'Identifier'
  ) {
    return null;
  }
  const dataNames = new Set(ir.state.map((s) => s.name));
  const modelProps = new Set(
    ir.props.filter((p) => p.isModel).map((p) => p.name),
  );
  if (me.object.name === '$data' && dataNames.has(me.property.name)) {
    return me.property.name;
  }
  if (me.object.name === '$props' && modelProps.has(me.property.name)) {
    return me.property.name;
  }
  return null;
}

/**
 * Lower a single bound-attribute expression to a template-binding string.
 *
 * When the expression reads the SAME `$props.X` / `$data.X` accessor 2+ times
 * in a guard-and-use shape, synthesise a single-read getter class member
 * (registered on `ctx.scriptInjections`) and return the bare getter name so
 * the attribute binds to it — Angular `strictTemplates` cannot narrow a
 * signal-call result across two independent `X()` calls (Uppy's
 * `:accept="$props.allowedFileTypes ? $props.allowedFileTypes.join(',') : null"`).
 *
 * Falls back to the normal `rewriteTemplateExpression` path when no double-read
 * accessor is present — reference examples are byte-stable.
 */
function lowerBoundAttrExpression(
  expr: t.Expression,
  ctx: EmitAttrCtx,
  attrName: string,
): string {
  if (ctx.scriptInjections !== undefined) {
    const taken = new Set(ctx.scriptInjections.map((si) => si.name));
    const hoist = hoistTemplateDoubleReadAccessor(expr, ctx.ir, attrName, taken, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
    });
    if (hoist !== null) {
      ctx.scriptInjections.push({ name: hoist.memberName, decl: hoist.decl });
      return hoist.memberName;
    }
  }
  return rewriteTemplateExpression(expr, ctx.ir, {
    collisionRenames: ctx.collisionRenames,
    loopBindings: ctx.loopBindings,
  });
}

/**
 * Plan 14-05 R6 — keys that must never reach the emitted object from an
 * author-controlled `r-bind` LITERAL. Mirrors the React/Solid/Vue/Svelte
 * `FORBIDDEN_SPREAD_KEYS` set + the Phase 02 `collectPropDecls` write-time
 * guard (T-14-11 — prototype-pollution).
 */
const FORBIDDEN_SPREAD_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Read an ObjectProperty's static key name, or null when the key is not a
 * statically-knowable Identifier / StringLiteral (computed expressions etc.).
 */
function staticSpreadPropKey(prop: t.ObjectProperty): string | null {
  if (t.isIdentifier(prop.key) && !prop.computed) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  return null;
}

/**
 * Plan 14-05 R6 — split an `r-bind` LITERAL object into (classValue, styleValue,
 * rest). The `class`/`style` keys are extracted so they can be fed into the
 * existing multi-source class/style merge paths (Angular `[ngClass]`/`[ngStyle]`);
 * `rest` is the object with those keys removed, ready for the `applyAttrs`
 * effect. Returns null entries when a key is absent. T-14-11:
 * `__proto__`/`constructor`/`prototype` keys are dropped from the literal
 * entirely (mirrors the React/Solid/Vue/Svelte compile-time pollution guard).
 *
 * Operates on Angular HTML attribute names verbatim — no key remap is applied
 * here (D-03 is React/Solid-only; Angular wants HTML names through).
 */
function splitClassStyleFromAngularLiteral(obj: t.ObjectExpression): {
  classValue: t.Expression | null;
  styleValue: t.Expression | null;
  rest: t.ObjectExpression;
} {
  let classValue: t.Expression | null = null;
  let styleValue: t.Expression | null = null;
  const restProps: t.ObjectExpression['properties'] = [];
  for (const prop of obj.properties) {
    if (t.isObjectProperty(prop)) {
      const keyName = staticSpreadPropKey(prop);
      // T-14-11 — drop a pollution-vector literal key entirely.
      if (keyName !== null && FORBIDDEN_SPREAD_KEYS.has(keyName)) continue;
      if (keyName === 'class' && t.isExpression(prop.value)) {
        classValue = prop.value;
        continue;
      }
      if (keyName === 'style' && t.isExpression(prop.value)) {
        styleValue = prop.value;
        continue;
      }
    }
    restProps.push(prop);
  }
  const rest = t.objectExpression(restProps);
  return { classValue, styleValue, rest };
}

/**
 * Extract a `class`/`style` value from an `r-bind` LITERAL so it can be folded
 * into the element's `[ngClass]`/`[ngStyle]` merge. Returns null entries when
 * the spread is not a literal (dynamic spreads / `$attrs` — keys unknowable;
 * see KNOWN LIMITATION at the `emitSpreadBinding` call site).
 */
function extractLiteralClassStyleFromAngularSpread(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
): { classValue: t.Expression | null; styleValue: t.Expression | null } {
  if (!t.isObjectExpression(attr.expression)) {
    return { classValue: null, styleValue: null };
  }
  const { classValue, styleValue } = splitClassStyleFromAngularLiteral(
    attr.expression,
  );
  return { classValue, styleValue };
}

/**
 * Plan 14-05 / D-01 — the SHARED `__rozieApplyAttrs` private class-field IIFE
 * diff helper. One per component (deduplicated via `ctx.scriptInjections`).
 * Diffs `prevKeys` between renders so a key dropped from the object is removed
 * from the DOM (T-14-10 stale-attribute prevention). `inject(Renderer2)` lives
 * in the field initializer (a class-field initializer IS injection context —
 * Phase 05 Pitfall 8 mitigation).
 *
 * `null` / `false` values trigger `removeAttribute`; everything else routes
 * through `setAttribute(String(v))` — the same contract as the Lit
 * `rozieSpread` directive (cross-target parity).
 */
const APPLY_ATTRS_FIELD_NAME = '__rozieApplyAttrs';

function applyAttrsHelperDecl(): string {
  return [
    `private ${APPLY_ATTRS_FIELD_NAME} = (() => {`,
    `  const renderer = inject(Renderer2);`,
    `  let prevKeys: string[] = [];`,
    `  return (el: HTMLElement, obj: Record<string, unknown>) => {`,
    `    for (const k of prevKeys) {`,
    `      if (!(k in obj)) renderer.removeAttribute(el, k);`,
    `    }`,
    `    for (const [k, v] of Object.entries(obj)) {`,
    `      if (v === null || v === false) renderer.removeAttribute(el, k);`,
    `      else renderer.setAttribute(el, k, String(v));`,
    `    }`,
    `    prevKeys = Object.keys(obj);`,
    `  };`,
    `})();`,
  ].join('\n');
}

/**
 * Plan 14-05 / D-01 — emit the per-element machinery for ONE `spreadBinding`:
 *   - a `#rozieSpread_<N>` template-ref attribute (returned for splicing
 *     onto the open tag),
 *   - a `viewChild<ElementRef>('rozieSpread_<N>')` private field (pushed onto
 *     `ctx.scriptInjections`),
 *   - the SHARED `__rozieApplyAttrs` IIFE field (pushed once per component),
 *   - a `private __rozieSpread_<N>_effect = effect(() => { ... });` field
 *     initializer that guards `nativeElement` (Pitfall 7) and feeds the
 *     rewritten expression into the diff helper.
 *
 * The diff helper is in a field initializer (injection context — Phase 05
 * Pitfall 8). The `effect()` call also lives in a field initializer (the
 * effect signal subscribes to reactive reads in its body — `inject` /
 * `effect` must both be in injection context, which a field initializer IS).
 *
 * KNOWN LIMITATION (RESEARCH OQ1 / A4 / Option a) — for a DYNAMIC `r-bind`
 * object the keys are NOT known at compile time, so a `class`/`style` key
 * inside a dynamic spread CANNOT be extracted into the class/style merge
 * path. `applyAttrs` sets all object keys imperatively, so a dynamic `class`
 * inside the spread overwrites rather than merges with an explicit `class`/
 * `[ngClass]` sibling. The R6 acceptance fixture uses a LITERAL `r-bind`,
 * so the literal path is the mandatory one and is fully merge-correct.
 */
function emitSpreadBinding(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
  ctx: EmitAttrCtx,
  /** When the element has an explicit class/style binding, the literal's
   *  class/style is extracted upstream — emit only the `rest`. */
  hasExplicitClassOrStyle: boolean,
): string {
  // Allocate a fresh ref name. Use the shared injection counter when present;
  // otherwise start fresh (test path / standalone wrapper).
  const counter = ctx.injectionCounter ?? { next: 0 };
  const idx = counter.next++;
  const refName = `rozieSpread_${idx}`;
  const effectFieldName = `__rozieSpread_${idx}_effect`;

  // Build the spread expression: when an explicit class/style sibling exists,
  // drop class/style from the LITERAL object — the extracted values are fed
  // into the Angular [ngClass]/[ngStyle] merge path by emitAttributes.
  let exprNode: t.Expression;
  if (
    hasExplicitClassOrStyle &&
    t.isObjectExpression(attr.expression)
  ) {
    const { rest } = splitClassStyleFromAngularLiteral(attr.expression);
    exprNode = rest;
  } else if (t.isObjectExpression(attr.expression)) {
    // LITERAL spread without an explicit class/style sibling — apply the
    // T-14-11 pollution guard, then re-attach scrubbed class/style so they
    // flow through the spread (no merge target exists). Mirrors Vue/Svelte.
    const { rest, classValue, styleValue } = splitClassStyleFromAngularLiteral(
      attr.expression,
    );
    const restProps = [...rest.properties];
    if (classValue !== null) {
      restProps.push(t.objectProperty(t.identifier('class'), classValue));
    }
    if (styleValue !== null) {
      restProps.push(t.objectProperty(t.identifier('style'), styleValue));
    }
    exprNode = t.objectExpression(restProps);
  } else {
    // DYNAMIC spread or bare `$attrs` Identifier — pass through.
    exprNode = attr.expression;
  }

  // The spread expression is evaluated inside a CLASS-FIELD INITIALIZER's
  // `effect()` body, NOT inside an Angular template binding. Pass
  // `prefixThis: true` so `$data.X` lowers to `this.X()` (signal call on the
  // class member), `$props.Y` to `this.Y()`, etc. — Angular templates have
  // implicit-this resolution at the binding level, but a class-body
  // initializer has no such implicit binding and tsc requires the explicit
  // `this.` qualifier (TS2663). Mirrors the slot-invocation / class-body
  // pattern in this file.
  const exprText = rewriteTemplateExpression(exprNode, ctx.ir, {
    collisionRenames: ctx.collisionRenames,
    loopBindings: ctx.loopBindings,
    prefixThis: true,
  });

  // Push the viewChild query for the spread target.
  if (ctx.scriptInjections !== undefined) {
    ctx.scriptInjections.push({
      name: refName,
      decl: `private ${refName} = viewChild<ElementRef>('${refName}');`,
    });

    // Push the shared applyAttrs IIFE — only once per component.
    const helperAlreadyPushed = ctx.scriptInjections.some(
      (si) => si.name === APPLY_ATTRS_FIELD_NAME,
    );
    if (!helperAlreadyPushed) {
      ctx.scriptInjections.push({
        name: APPLY_ATTRS_FIELD_NAME,
        decl: applyAttrsHelperDecl(),
      });
    }

    // Push the per-spread `effect()` field initializer. The guard
    // (`viewChild()?.nativeElement` is undefined before first render) makes
    // the effect a no-op until the element exists (Pitfall 7).
    const effectDecl = [
      `private ${effectFieldName} = effect(() => {`,
      `  const el = this.${refName}()?.nativeElement;`,
      `  if (!el) return;`,
      `  this.${APPLY_ATTRS_FIELD_NAME}(el, ${exprText});`,
      `});`,
    ].join('\n');
    ctx.scriptInjections.push({
      name: effectFieldName,
      decl: effectDecl,
    });
  }

  // Signal to emitAngular that the new @angular/core imports are needed.
  if (ctx.hasSpreadBinding !== undefined) {
    ctx.hasSpreadBinding.value = true;
  }

  // The template attribute is the template-ref declaration `#rozieSpread_<N>`.
  // AUTO-FALLTHROUGH TARGET (resolves CONTEXT.md A1 for Angular): the
  // synthesized `$attrs` spreadBinding from Plan 14-02 lowers through the
  // SAME effect()+Renderer2 path and lands on the template-root element
  // (the `<button>` the author wrote), NOT the Angular host element. The
  // host element receives consumer attributes natively via Angular's
  // attribute forwarding, but cross-target parity requires fallthrough to
  // land on the inner element.
  return `#${refName}`;
}

/**
 * Emit a single attribute. Returns null when the attribute should be dropped
 * (e.g., r-html, which gets emitted later as `[innerHTML]="..."` by the
 * element emitter).
 */
export function emitSingleAttr(
  attr: AttributeBinding,
  ctx: EmitAttrCtx,
  elementTagName: string,
): string | null {
  // Phase 14 R2 / D-07 / D-01 / Plan 14-05 — the bare-spread `r-bind="<expr>"`
  // form (and the synthesized `$attrs` auto-fallthrough spread). Angular has
  // NO native attribute-object spread; D-01 / 14-RESEARCH Pattern 3 specifies
  // an `effect()` + `Renderer2` imperative diff helper. The shared
  // `__rozieApplyAttrs` IIFE inlines per Phase 05 OQ A8/A9 (no
  // `@rozie/runtime-angular` package); `effect()` lives in a field initializer
  // and guards `viewChild()?.nativeElement` (Pitfall 7). See
  // `emitSpreadBinding` for the full mechanism.
  if (attr.kind === 'spreadBinding') {
    return emitSpreadBinding(attr, ctx, /* hasExplicitClassOrStyle */ false);
  }

  // r-html handled at the element level.
  if (attr.name === 'r-html') return null;

  // Phase 07.3 Wave 3 Plan 07.3-05 — consumer-side r-model:propName= two-way
  // binding. Emits Angular LONG-FORM `[propName]="X()" (propNameChange)="X.set($event)"`
  // (NOT the `[(propName)]` banana sugar) per RESEARCH §Landmines — some
  // Angular 19.x point releases mis-recognise WritableSignal LHS under the
  // banana-in-a-box form. Mirrors the existing `r-model` form-input branch
  // below which uses the same long-form for `[ngModel]`/`(ngModelChange)`.
  //
  // Signal target detection uses the shared resolveSignalNameForLValue
  // helper. The validator (validateTwoWayBindings — ROZ950/951) has already
  // gated empty propName, non-component targets, and non-writable LHS by the
  // time we reach this emit.
  if (attr.kind === 'twoWayBinding') {
    const signalName = resolveSignalNameForLValue(attr.expression, ctx.ir);
    const bindingName = resolveBindingName(attr.name, ctx);
    if (signalName !== null) {
      return `[${bindingName}]="${signalName}()" (${bindingName}Change)="${signalName}.set($event)"`;
    }
    // Non-signal fallback — rare-case degrade to one-way binding (the
    // change-output half is lost). Per Plan 07.3-05 task: "lossy on the
    // change-output half, planner accepts as rare-case degrade".
    const expr = rewriteTemplateExpression(attr.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
    });
    return `[${bindingName}]="${expr}"`;
  }

  if (attr.kind === 'static') {
    if (attr.name === 'ref') {
      const refNames = new Set(ctx.ir.refs.map((r) => r.name));
      if (refNames.has(attr.value)) {
        return `#${attr.value}`;
      }
    }
    return `${attr.name}="${escapeAttrValue(attr.value)}"`;
  }

  if (attr.kind === 'binding') {
    // r-model on form input → [ngModel]/(ngModelChange) long form because
    // signal-typed targets require explicit `.set($event)` (Angular's
    // `[(ngModel)]` shorthand requires an LValue, not a signal getter call).
    // For `r-model="$data.query"`, emit:
    //   [ngModel]="query()" (ngModelChange)="query.set($event)"
    // For non-signal LValues (rare; user typed `r-model="someObj.field"`),
    // fall back to the shorthand form.
    if (attr.name === 'r-model' && isFormInputTag(elementTagName)) {
      // Detect simple signal-target shape: $data.X or $props.X (model:true).
      // Plan 07.3-05 extracted this into resolveSignalNameForLValue so the
      // consumer-side r-model:propName= twoWayBinding branch above can reuse
      // it. Behaviour is byte-identical — the existing SearchInput snapshot
      // shape-lock in emitTemplate.test.ts is unaffected.
      const signalName = resolveSignalNameForLValue(attr.expression, ctx.ir);

      if (signalName !== null) {
        // Phase 12 — the resolved `r-model` modifier chain. `.number`/`.trim`
        // hand-emit a value coercion spliced into the change-handler
        // expression; `.lazy` swaps the bound event from `(ngModelChange)` to
        // `(change)` (D-08). Both are empty/absent for bare `r-model`, so its
        // emit stays byte-identical to pre-phase.
        const { valueTransforms, isLazy } = partitionAngularModelModifiers(
          attr.modifiers,
        );
        // `(ngModelChange)` receives the value directly; the native `(change)`
        // DOM event (used for `.lazy`) carries an Event, so the value access
        // differs. The `$v` placeholder is substituted with the appropriate
        // access expression and the resolved transforms are chained in D-07
        // list order.
        const valueAccess = isLazy ? '$event.target.value' : '$event';
        const committedValue = applyValueTransformsString(
          valueAccess,
          valueTransforms,
        );
        const eventBinding = isLazy ? 'change' : 'ngModelChange';
        // [ngModelOptions]="{standalone:true}" prevents NG01352 when this input
        // is nested inside a <form> — Angular would otherwise require a `name`
        // attribute to register the control with the parent FormGroup. Rozie
        // manages state via signals, so we always opt out of the forms model.
        return `[ngModel]="${signalName}()" (${eventBinding})="${signalName}.set(${committedValue})" [ngModelOptions]="{standalone: true}"`;
      }
      // Non-signal target — fall back to bare [(ngModel)] with rewritten expression.
      const expr = rewriteTemplateExpression(attr.expression, ctx.ir, {
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
      });
      return `[(ngModel)]="${expr}" [ngModelOptions]="{standalone: true}"`;
    }
    const bindingName = resolveBindingName(attr.name, ctx);
    const expr = lowerBoundAttrExpression(attr.expression, ctx, bindingName);
    return `[${bindingName}]="${expr}"`;
  }

  // interpolated: simplify single-binding-segment to direct property binding.
  if (attr.segments.length === 1 && attr.segments[0]!.kind === 'binding') {
    const seg = attr.segments[0]! as { kind: 'binding'; expression: t.Expression; deps: unknown };
    const bindingName = resolveBindingName(attr.name, ctx);
    const expr = lowerBoundAttrExpression(seg.expression, ctx, bindingName);
    return `[${bindingName}]="${expr}"`;
  }

  // Multi-segment — render as Angular property-binding with template literal.
  const lit = renderInterpolatedTemplateLiteral(attr.segments, ctx);
  const bindingName = resolveBindingName(attr.name, ctx);
  return `[${bindingName}]="\`${lit}\`"`;
}

function isComponentTag(ctx: EmitAttrCtx): boolean {
  return ctx.elementTagKind === 'component' || ctx.elementTagKind === 'self';
}

/**
 * Convert a single AttributeBinding into a JS expression string suitable for
 * inclusion in an array (used by class merge below).
 */
function attrToArraySegment(attr: AttributeBinding, ctx: EmitAttrCtx): string {
  // Phase 07.3 Wave 3 stub — twoWayBinding never participates in class/style
  // array merge (it's a component-prop binding, not an attribute aggregator).
  if (attr.kind === 'twoWayBinding') {
    throw new Error(
      `Angular target: twoWayBinding not valid in class/style array context (Phase 07.3 Wave 3 Plan 07.3-05).`,
    );
  }
  if (attr.kind === 'static') {
    return JSON.stringify(attr.value);
  }
  if (attr.kind === 'binding') {
    return rewriteTemplateExpression(attr.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
    });
  }
  if (attr.kind === 'spreadBinding') {
    // Phase 14 — `spreadBinding` is the name-less kind: it never reaches a
    // class/style merge (no name to coalesce on). Unreachable; mirrors the
    // `twoWayBinding` guard above.
    throw new Error(
      `Angular target: spreadBinding not valid in class/style array context (Phase 14).`,
    );
  }
  if (attr.segments.length === 1 && attr.segments[0]!.kind === 'binding') {
    const seg = attr.segments[0]! as { kind: 'binding'; expression: t.Expression; deps: unknown };
    return rewriteTemplateExpression(seg.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
    });
  }
  return '`' + renderInterpolatedTemplateLiteral(attr.segments, ctx) + '`';
}

/**
 * Emit ALL attributes on an element as a single space-separated string.
 * Handles class/style merge for multi-attr cases via Angular's `[ngClass]`
 * binding that accepts an object/array.
 */
export function emitAttributes(
  attrs: AttributeBinding[],
  ctx: EmitAttrCtx,
  elementTagName: string,
): string {
  if (attrs.length === 0) return '';

  // Group by name to detect class/style merges. Phase 14 — `spreadBinding`
  // is the name-less kind: it never participates in class/style merging, so
  // it is excluded from the duplicate-name count.
  const counts = new Map<string, number>();
  for (const a of attrs) {
    if (a.kind === 'spreadBinding') continue;
    if (a.name === 'r-html') continue;
    counts.set(a.name, (counts.get(a.name) ?? 0) + 1);
  }

  // Plan 14-05 R6 — does the element have an explicit `class`/`style` binding?
  // When so, a `class`/`style` key inside an `r-bind` LITERAL must be folded
  // into the [ngClass]/[ngStyle] merge path (not spread via applyAttrs, which
  // would imperatively overwrite the explicit class/style on every effect run).
  const hasExplicitClass = (counts.get('class') ?? 0) > 0;
  const hasExplicitStyle = (counts.get('style') ?? 0) > 0;

  // Plan 14-05 R6 — synthesise extra `class`/`style` AttributeBindings from any
  // `r-bind` LITERAL that carries those keys, so the existing class/style merge
  // path sees both the explicit binding(s) AND the literal's value as merge
  // sources. Mirrors the Vue/Svelte 14-04 pattern; preserves positional
  // last-wins (Pitfall 2) by adopting the spread's source position.
  const literalClassBindings = new Map<AttributeBinding, AttributeBinding>();
  const literalStyleBindings = new Map<AttributeBinding, AttributeBinding>();
  for (const a of attrs) {
    if (a.kind !== 'spreadBinding') continue;
    const { classValue, styleValue } = extractLiteralClassStyleFromAngularSpread(a);
    if (hasExplicitClass && classValue !== null) {
      literalClassBindings.set(a, {
        kind: 'binding',
        name: 'class',
        expression: classValue,
        deps: [],
        sourceLoc: a.sourceLoc,
      });
      counts.set('class', (counts.get('class') ?? 0) + 1);
    }
    if (hasExplicitStyle && styleValue !== null) {
      literalStyleBindings.set(a, {
        kind: 'binding',
        name: 'style',
        expression: styleValue,
        deps: [],
        sourceLoc: a.sourceLoc,
      });
      counts.set('style', (counts.get('style') ?? 0) + 1);
    }
  }

  const out: string[] = [];
  const consumed = new WeakSet<AttributeBinding>();

  for (const a of attrs) {
    if (consumed.has(a)) continue;

    // Plan 14-05 — the name-less `spreadBinding` goes straight to
    // `emitSingleAttr` (which lowers it via the effect()+Renderer2 mechanism),
    // bypassing the class/style name-merge logic that would read its absent
    // `.name`. When a sibling explicit class/style exists, the literal's
    // class/style is folded into the merge below; `emitSpreadBinding` drops
    // those keys from the spread's `rest` (so applyAttrs doesn't apply them).
    if (a.kind === 'spreadBinding') {
      const dropClass = literalClassBindings.has(a);
      const dropStyle = literalStyleBindings.has(a);
      const rendered = emitSpreadBinding(a, ctx, dropClass || dropStyle);
      out.push(rendered);
      consumed.add(a);
      continue;
    }

    if (a.name === 'r-html') continue;

    // class= merge: multiple class attrs combine via Angular's [ngClass].
    // Plan 14-05 R6 — includes synthetic bindings extracted from r-bind
    // LITERAL spreads.
    if (a.name === 'class' && (counts.get('class') ?? 0) > 1) {
      const sameName: AttributeBinding[] = [];
      for (const src of attrs) {
        if (src.kind === 'spreadBinding') {
          const synthetic = literalClassBindings.get(src);
          if (synthetic) sameName.push(synthetic);
        } else if (src.name === 'class') {
          sameName.push(src);
          consumed.add(src);
        }
      }
      // Static classes stay as `class="..."`; dynamic merges to `[ngClass]`.
      const staticParts: string[] = [];
      const dynamicParts: string[] = [];
      for (const x of sameName) {
        if (x.kind === 'static') {
          staticParts.push(x.value);
        } else {
          dynamicParts.push(attrToArraySegment(x, ctx));
        }
      }
      if (staticParts.length > 0) {
        out.push(`class="${escapeAttrValue(staticParts.join(' '))}"`);
      }
      if (dynamicParts.length > 0) {
        // Multiple dynamic class bindings — merge into Angular's [ngClass].
        // The merged value is an Angular expression; emit it VERBATIM into the
        // double-quoted attribute, exactly as the single-binding path does
        // (emitSingleAttr emits `[${bindingName}]="${expr}"` with no escaping).
        // attrToArraySegment produces single-quoted string literals
        // (`{ 'is-readonly': … }`), so the value never collides with the `"`
        // attribute delimiter.
        //
        // Earlier revisions escaped this value — first HTML-entity (`&quot;`),
        // then backslash (`\'`, "WR-06"). Both were wrong: a `"`-delimited HTML
        // attribute needs NO escaping of `'`, and `\'` is invalid in an Angular
        // expression — the object key `{ 'is-readonly': … }` became
        // `{ \'is-readonly\': … }` → Angular template parse error → the
        // component fell back to a runtime `@Component` decorator (no AOT
        // `ɵcmp`) → "JIT compiler unavailable" at runtime (TipTap/Uppy·angular).
        if (dynamicParts.length === 1) {
          out.push(`[ngClass]="${dynamicParts[0]!}"`);
        } else {
          out.push(`[ngClass]="[${dynamicParts.join(', ')}]"`);
        }
      }
      continue;
    }

    // style= merge similarly via [ngStyle].
    // Plan 14-05 R6 — includes synthetic bindings extracted from r-bind
    // LITERAL spreads.
    if (a.name === 'style' && (counts.get('style') ?? 0) > 1) {
      const sameName: AttributeBinding[] = [];
      for (const src of attrs) {
        if (src.kind === 'spreadBinding') {
          const synthetic = literalStyleBindings.get(src);
          if (synthetic) sameName.push(synthetic);
        } else if (src.name === 'style') {
          sameName.push(src);
          consumed.add(src);
        }
      }
      const staticParts: string[] = [];
      const dynamicParts: string[] = [];
      for (const x of sameName) {
        if (x.kind === 'static') {
          staticParts.push(x.value);
        } else {
          dynamicParts.push(attrToArraySegment(x, ctx));
        }
      }
      if (staticParts.length > 0) {
        out.push(`style="${escapeAttrValue(staticParts.join(';'))}"`);
      }
      if (dynamicParts.length > 0) {
        // Emit the merged [ngStyle] expression verbatim — same rationale as the
        // [ngClass] block above (no escaping; the value is a single-quoted
        // Angular expression that never collides with the `"` delimiter).
        if (dynamicParts.length === 1) {
          out.push(`[ngStyle]="${dynamicParts[0]!}"`);
        } else {
          out.push(`[ngStyle]="[${dynamicParts.join(', ')}]"`);
        }
      }
      continue;
    }

    const rendered = emitSingleAttr(a, ctx, elementTagName);
    if (rendered !== null) out.push(rendered);
    consumed.add(a);
  }

  return out.join(' ');
}

/** Detect r-html attribute on an element. */
export function findRHtml(
  attrs: AttributeBinding[],
): { expression: t.Expression } | null {
  for (const a of attrs) {
    // Phase 14 — `spreadBinding` is the name-less kind; skip before `.name`.
    if (a.kind === 'spreadBinding') continue;
    if (a.name !== 'r-html') continue;
    if (a.kind === 'binding') return { expression: a.expression };
  }
  return null;
}

/** Detect r-show attribute. Returns the expression node or null. */
export function findRShow(
  attrs: AttributeBinding[],
): { expression: t.Expression } | null {
  for (const a of attrs) {
    // Phase 14 — `spreadBinding` is the name-less kind; skip before `.name`.
    if (a.kind === 'spreadBinding') continue;
    if (a.name !== 'r-show') continue;
    if (a.kind === 'binding') return { expression: a.expression };
  }
  return null;
}
