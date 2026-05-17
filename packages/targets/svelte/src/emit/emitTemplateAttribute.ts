/**
 * emitTemplateAttribute — Phase 5 Plan 02a Task 2.
 *
 * Renders an element's AttributeBinding[] as a Svelte 5 attribute string.
 *
 * Three AttributeBinding kinds:
 *   - 'static'       — `class="counter"` (HTML-escape value)
 *   - 'binding'      — `class={...}` (Svelte uses {expr} for property bindings)
 *   - 'interpolated' — segments[]; mustache-in-attribute (Pitfall 7 of Phase 1):
 *     emit as a JS template literal: `class={\`card card--${variant}\`}`.
 *
 * Special-case attribute names:
 *   - `r-model` on form input  → `bind:value={x}` (Pitfall 2 — works because
 *     the target prop was declared `model: true` and emitted `$bindable(...)`).
 *   - `ref="name"`             → `bind:this={name}` (Svelte 5 idiom).
 *   - `r-html="expr"`          → emitted as a sibling `{@html expr}` (NOT an
 *     attribute) — handled by emitTemplateNode after attribute emission. Here
 *     we filter r-html out.
 *
 * Refs in Svelte 5 use bare names (no `Ref` suffix like Vue's Pitfall 4) —
 * the script-side `let name = $state<HTMLElement>()` matches the template
 * `bind:this={name}` directly.
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
}

/** Minimal HTML attribute-value escape. */
function escapeAttrValue(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Render interpolated segments as the inside of a JS template literal
 * (without the surrounding backticks). E.g.,
 *   [{static:'card '}, {binding: variant}] → 'card ${variant}'
 */
function renderInterpolatedTemplateLiteral(
  segments: Array<
    | { kind: 'static'; text: string }
    | { kind: 'binding'; expression: t.Expression; deps: unknown }
  >,
  ir: IRComponent,
): string {
  let out = '';
  for (const seg of segments) {
    if (seg.kind === 'static') {
      // Escape backslash, backtick, and `${` sequences in static text.
      out += seg.text
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${');
    } else {
      out += '${' + rewriteTemplateExpression(seg.expression, ir) + '}';
    }
  }
  return out;
}

/**
 * Emit a single attribute. Filters r-html (handled separately by
 * emitTemplateNode as a sibling `{@html ...}`).
 *
 * Returns null when the attribute should be dropped (e.g., r-html which
 * gets emitted later as a child node).
 */
export function emitSingleAttr(
  attr: AttributeBinding,
  ir: IRComponent,
): string | null {
  // r-html is handled at the element level, not as an attribute.
  if (attr.name === 'r-html') return null;

  if (attr.kind === 'static') {
    // ref="<refName>" → bind:this={refName} (Svelte 5 idiom).
    if (attr.name === 'ref') {
      const refNames = new Set(ir.refs.map((r) => r.name));
      if (refNames.has(attr.value)) {
        return `bind:this={${attr.value}}`;
      }
    }
    return `${attr.name}="${escapeAttrValue(attr.value)}"`;
  }

  if (attr.kind === 'binding') {
    // r-model="<expr>" on form input → bind:value={<expr>}.
    if (attr.name === 'r-model') {
      const expr = rewriteTemplateExpression(attr.expression, ir);
      return `bind:value={${expr}}`;
    }
    const expr = rewriteTemplateExpression(attr.expression, ir);
    return `${attr.name}={${expr}}`;
  }

  if (attr.kind === 'twoWayBinding') {
    // Phase 07.3 Plan 04 — Svelte 5 runes-mode consumer-side two-way binding.
    //
    // The lowerer (07.3-02) produced this AttributeBinding for
    // `<Producer r-model:propName="expr"/>` on a component tag, and the
    // IR-time validator (validateTwoWayBindings) has already certified that
    // (a) the RHS is a writable lvalue (isWritableLValue / ROZ951), (b) the
    // propName resolves to a `model: true` <props> entry on the producer
    // (ROZ949), and (c) the producer is a component (ROZ950). Emit the
    // Svelte-5 bind: form so the producer's `$bindable(...)` rune sees writes
    // straight through. Template-expression rewrite handles $data./$props.
    // prefix stripping (e.g., `$data.x` → `x`, model `$props.active` →
    // `active`).
    const expr = rewriteTemplateExpression(attr.expression, ir);
    return `bind:${attr.name}={${expr}}`;
  }

  // interpolated: if exactly one binding segment, simplify to `name={<expr>}`.
  if (attr.segments.length === 1 && attr.segments[0]!.kind === 'binding') {
    const seg = attr.segments[0]! as { kind: 'binding'; expression: t.Expression; deps: unknown };
    return `${attr.name}={${rewriteTemplateExpression(seg.expression, ir)}}`;
  }

  // Multi-segment — render as Svelte template literal: `name={`...${...}...`}`.
  const lit = renderInterpolatedTemplateLiteral(attr.segments, ir);
  return `${attr.name}={\`${lit}\`}`;
}

/**
 * Convert a single AttributeBinding into a JS expression string suitable for
 * inclusion in an array (used by class/style merge below).
 */
function attrToArraySegment(attr: AttributeBinding, ir: IRComponent): string {
  if (attr.kind === 'twoWayBinding') {
    // Phase 07.3 Wave 3 stub — twoWayBinding never valid in class/style merge.
    throw new Error(
      `Svelte target: twoWayBinding not valid in class/style array context (Phase 07.3 Wave 3 Plan 07.3-04).`,
    );
  }
  if (attr.kind === 'static') {
    return JSON.stringify(attr.value);
  }
  if (attr.kind === 'binding') {
    return rewriteTemplateExpression(attr.expression, ir);
  }
  // interpolated
  if (attr.segments.length === 1 && attr.segments[0]!.kind === 'binding') {
    const seg = attr.segments[0]! as { kind: 'binding'; expression: t.Expression; deps: unknown };
    return rewriteTemplateExpression(seg.expression, ir);
  }
  return '`' + renderInterpolatedTemplateLiteral(attr.segments, ir) + '`';
}

/**
 * Emit ALL attributes on an element as a single space-separated string.
 * Filters out r-html (handled separately) + drops null returns.
 *
 * For `class` and `style` specifically, when multiple AttributeBinding
 * entries share the name, merge into a single Svelte-5 array binding:
 *   - `class="counter"` + `:class="{hovering: x}"` →
 *     `class={['counter', { hovering: x }]}`
 * Svelte 5.16+ accepts both array AND object forms in `class={...}` (clsx-like).
 */
export function emitAttributes(
  attrs: AttributeBinding[],
  ctx: EmitAttrCtx,
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

    if (
      (a.name === 'class' || a.name === 'style') &&
      (counts.get(a.name) ?? 0) > 1
    ) {
      // Merge ALL same-named class/style attrs into ONE array binding.
      const sameName = attrs.filter((x) => x.name === a.name);
      for (const x of sameName) consumed.add(x);
      const segments = sameName.map((x) => attrToArraySegment(x, ctx.ir));
      out.push(`${a.name}={[${segments.join(', ')}]}`);
      continue;
    }

    const rendered = emitSingleAttr(a, ctx.ir);
    if (rendered !== null) out.push(rendered);
    consumed.add(a);
  }

  return out.join(' ');
}

/**
 * Detect whether the element has an `r-html` attribute (used by emitTemplateNode
 * to emit `{@html expr}` as the element's content + raise ROZ620 if children
 * coexist).
 */
export function findRHtml(
  attrs: AttributeBinding[],
): { expression: t.Expression } | null {
  for (const a of attrs) {
    if (a.name !== 'r-html') continue;
    if (a.kind === 'binding') return { expression: a.expression };
  }
  return null;
}
