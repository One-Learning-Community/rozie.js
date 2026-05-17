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
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface EmitAttrCtx {
  ir: IRComponent;
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  /** Loop-local bindings in scope (e.g., `item` from r-for). */
  loopBindings?: ReadonlySet<string> | undefined;
  /**
   * Phase 06.2 — element's tagKind. When 'component' or 'self', kebab-case
   * binding names are camelCased before emit (Angular component properties
   * are camelCase by convention, and Angular rejects `on-` prefix bindings
   * with NG0306 for security). HTML elements keep kebab-case so
   * `[aria-label]`, `[data-foo]`, etc. work naturally.
   */
  elementTagKind?: 'html' | 'component' | 'self';
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
 * Emit a single attribute. Returns null when the attribute should be dropped
 * (e.g., r-html, which gets emitted later as `[innerHTML]="..."` by the
 * element emitter).
 */
export function emitSingleAttr(
  attr: AttributeBinding,
  ctx: EmitAttrCtx,
  elementTagName: string,
): string | null {
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
    const bindingName = isComponentTag(ctx) ? kebabToCamel(attr.name) : attr.name;
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
        // [ngModelOptions]="{standalone:true}" prevents NG01352 when this input
        // is nested inside a <form> — Angular would otherwise require a `name`
        // attribute to register the control with the parent FormGroup. Rozie
        // manages state via signals, so we always opt out of the forms model.
        return `[ngModel]="${signalName}()" (ngModelChange)="${signalName}.set($event)" [ngModelOptions]="{standalone: true}"`;
      }
      // Non-signal target — fall back to bare [(ngModel)] with rewritten expression.
      const expr = rewriteTemplateExpression(attr.expression, ctx.ir, {
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
      });
      return `[(ngModel)]="${expr}" [ngModelOptions]="{standalone: true}"`;
    }
    const expr = rewriteTemplateExpression(attr.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
    });
    const bindingName = isComponentTag(ctx) ? kebabToCamel(attr.name) : attr.name;
    return `[${bindingName}]="${expr}"`;
  }

  // interpolated: simplify single-binding-segment to direct property binding.
  if (attr.segments.length === 1 && attr.segments[0]!.kind === 'binding') {
    const seg = attr.segments[0]! as { kind: 'binding'; expression: t.Expression; deps: unknown };
    const expr = rewriteTemplateExpression(seg.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
    });
    const bindingName = isComponentTag(ctx) ? kebabToCamel(attr.name) : attr.name;
    return `[${bindingName}]="${expr}"`;
  }

  // Multi-segment — render as Angular property-binding with template literal.
  const lit = renderInterpolatedTemplateLiteral(attr.segments, ctx);
  const bindingName = isComponentTag(ctx) ? kebabToCamel(attr.name) : attr.name;
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

  // Group by name to detect class/style merges.
  const counts = new Map<string, number>();
  for (const a of attrs) {
    if (a.name === 'r-html') continue;
    counts.set(a.name, (counts.get(a.name) ?? 0) + 1);
  }

  const out: string[] = [];
  const consumed = new WeakSet<AttributeBinding>();

  for (const a of attrs) {
    if (consumed.has(a)) continue;
    if (a.name === 'r-html') continue;

    // class= merge: multiple class attrs combine via Angular's [ngClass].
    if (a.name === 'class' && (counts.get('class') ?? 0) > 1) {
      const sameName = attrs.filter((x) => x.name === 'class');
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
        // Multiple dynamic class bindings — merge into ngClass array.
        // Use JS-safe escaping (backslash-escape single quotes) rather than
        // HTML-entity escaping (&quot;). Angular's template compiler processes
        // binding values as JS expressions — HTML entities are NOT decoded —
        // so &quot; would be passed literally to the expression evaluator.
        // Closes WR-06.
        const escapeForJsAttr = (s: string) =>
          s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        if (dynamicParts.length === 1) {
          out.push(`[ngClass]="${escapeForJsAttr(dynamicParts[0]!)}"`);
        } else {
          out.push(`[ngClass]="[${dynamicParts.map(escapeForJsAttr).join(', ')}]"`);
        }
      }
      continue;
    }

    // style= merge similarly via [ngStyle].
    if (a.name === 'style' && (counts.get('style') ?? 0) > 1) {
      const sameName = attrs.filter((x) => x.name === 'style');
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
        // Same JS-safe escaping as [ngClass] above — Angular template compiler
        // does not decode HTML entities in binding values. Closes WR-06.
        const escapeForJsAttr = (s: string) =>
          s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        if (dynamicParts.length === 1) {
          out.push(`[ngStyle]="${escapeForJsAttr(dynamicParts[0]!)}"`);
        } else {
          out.push(`[ngStyle]="[${dynamicParts.map(escapeForJsAttr).join(', ')}]"`);
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
    if (a.name !== 'r-show') continue;
    if (a.kind === 'binding') return { expression: a.expression };
  }
  return null;
}
