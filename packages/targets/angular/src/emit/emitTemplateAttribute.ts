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
 * Emit a single attribute. Returns null when the attribute should be dropped
 * (e.g., r-html, which gets emitted later as `[innerHTML]="..."` by the
 * element emitter).
 */
export function emitSingleAttr(
  attr: AttributeBinding,
  ctx: EmitAttrCtx,
  elementTagName: string,
): string | null {
  // Phase 14 R2 / D-07 / D-01 — the bare-spread `r-bind="<expr>"` form (and the
  // synthesized `$attrs` auto-fallthrough spread). Angular has NO native
  // attribute-object spread; D-01 / 14-RESEARCH Pattern 3 specifies an
  // `effect()` + `Renderer2` imperative diff helper. That bespoke mechanism is
  // Wave 3 (Plan 14-03) work — RESEARCH §Recommendation explicitly scopes
  // "Angular + Lit bespoke mechanisms" to a later wave than the four
  // near-native targets. Until then, skip the spread (emit nothing) so the IR
  // can carry the synthesized `$attrs` spreadBinding without crashing the
  // Angular emitter. KNOWN STUB — resolved by Plan 14-03.
  if (attr.kind === 'spreadBinding') return null;

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

  const out: string[] = [];
  const consumed = new WeakSet<AttributeBinding>();

  for (const a of attrs) {
    if (consumed.has(a)) continue;

    // Phase 14 — the name-less `spreadBinding` goes straight to `emitSingleAttr`
    // (which skips it — Angular D-01 spread is Wave 3 / Plan 14-03), bypassing
    // the class/style name-merge logic that would read its absent `.name`.
    if (a.kind === 'spreadBinding') {
      const rendered = emitSingleAttr(a, ctx, elementTagName);
      if (rendered !== null) out.push(rendered);
      consumed.add(a);
      continue;
    }

    if (a.name === 'r-html') continue;

    // class= merge: multiple class attrs combine via Angular's [ngClass].
    if (a.name === 'class' && (counts.get('class') ?? 0) > 1) {
      const sameName = attrs.filter(
        (x) => x.kind !== 'spreadBinding' && x.name === 'class',
      );
      for (const x of sameName) consumed.add(x);
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
    if (a.name === 'style' && (counts.get('style') ?? 0) > 1) {
      const sameName = attrs.filter(
        (x) => x.kind !== 'spreadBinding' && x.name === 'style',
      );
      for (const x of sameName) consumed.add(x);
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
