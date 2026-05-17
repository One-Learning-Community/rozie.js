/**
 * emitTemplateAttribute — Phase 3 Plan 03 Task 2.
 *
 * Renders an element's AttributeBinding[] as a Vue-template attribute string.
 * Implements D-37 mustache-in-attribute lowering and the Pitfall 7 array-merge
 * for `class` (and `style`) when both static and binding forms appear on the
 * same element.
 *
 * Three AttributeBinding kinds:
 *   - 'static'       — `class="counter"` (HTML-escape value)
 *   - 'binding'      — `:class="{...}"`
 *   - 'interpolated' — segments[]; D-37 mustache-in-attribute
 *
 * For `class` and `style` specifically (Pitfall 7):
 *   - One source of values → emit the natural form
 *   - Multiple sources → merge into a single `:class="[...]"` array binding;
 *     each segment becomes either a string literal (static), an expression
 *     (binding), or a template literal (interpolated mixed)
 *
 * For other attribute names:
 *   - kind='static': name="HTML-escaped value"
 *   - kind='binding': :name="rewriteTemplateExpression(expression)"
 *   - kind='interpolated': single binding segment → :name="<expr>"; otherwise
 *     :name=`template literal with ${segment}` form
 *
 * Names beginning with `r-model` (preserved by Phase 2 lowerTemplate.ts) are
 * rewritten here to `v-model` form (D-36 1:1 lowering).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type {
  IRComponent,
  AttributeBinding,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface EmitAttrCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
}

/**
 * Minimal HTML attribute-value escape: replace `"` with `&quot;` and `&` with
 * `&amp;`. Sufficient for the v1 surface; @babel/generator handles JS-string
 * escapes for binding values.
 */
function escapeAttrValue(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Render a static text segment as a JS-string literal suitable for inclusion
 * in an array (`'counter'`, `'card '`).
 */
function staticSegmentLiteral(text: string): string {
  // Escape backticks/single-quotes as needed; safest approach: JSON.stringify
  // gives a double-quoted JS literal. We use single quotes for visual clarity.
  return JSON.stringify(text).replace(/^"(.*)"$/, "'$1'").replace(/\\"/g, '"');
}

/**
 * Render an interpolated AttributeBinding's segments as a template literal
 * inner contents (without the surrounding backticks). E.g.,
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
      // Backtick-safe escape: escape `\`, backtick, and `$`.
      out += seg.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      // But \${...} would be wrongly escaped — reverse if directly preceding `{`:
      // simpler: only escape backticks and backslashes; leave $ alone since we
      // emit the binding via `${...}` ourselves and any literal $ in static text
      // would also need escaping. Re-do conservatively:
    } else {
      out += '${' + rewriteTemplateExpression(seg.expression, ir) + '}';
    }
  }
  return out;
}

/**
 * Conservative re-implementation: render segments correctly. Static text gets
 * minimal escape (backtick + backslash + dollar-only-when-followed-by-brace).
 */
function renderInterpolatedTemplateLiteralSafe(
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
 * For class-array merge (Pitfall 7): convert each AttributeBinding to a single
 * array element string.
 */
function attrToArraySegment(attr: AttributeBinding, ir: IRComponent): string {
  if (attr.kind === 'twoWayBinding') {
    // Phase 07.3 Wave 3 stub — twoWayBinding never valid in class/style merge.
    throw new Error(
      `Vue target: twoWayBinding not valid in class/style array context (Phase 07.3 Wave 3 Plan 07.3-03).`,
    );
  }
  if (attr.kind === 'static') {
    return staticSegmentLiteral(attr.value);
  }
  if (attr.kind === 'binding') {
    return rewriteTemplateExpression(attr.expression, ir);
  }
  // interpolated
  return '`' + renderInterpolatedTemplateLiteralSafe(attr.segments, ir) + '`';
}

/**
 * Emit a single non-class/style binding/static attribute as one attribute pair.
 */
function emitSingleAttr(attr: AttributeBinding, ir: IRComponent): string {
  if (attr.kind === 'twoWayBinding') {
    // Phase 07.3 Wave 3 stub — Plan 07.3-03 replaces this with the Vue
    // `v-model:propName="<expr>"` emit.
    throw new Error(
      `Vue target: r-model:${attr.name}= consumer-side two-way binding not yet implemented (Phase 07.3 Wave 3 Plan 07.3-03).`,
    );
  }

  // Special r-model directive (Phase 2 lowerer keeps it as binding name=`r-model`).
  const name = attr.kind !== 'static' && attr.name === 'r-model' ? 'v-model' : attr.kind === 'static' ? attr.name : attr.name;

  if (attr.kind === 'static') {
    // r-* directives in static form would not appear; pass through.
    // Special-case: `ref="panelEl"` must align with the script-side rename
    // `panelEl → panelElRef` (Pitfall 4 suffix). Vue 3.4 `<script setup>`
    // resolves `ref="<name>"` against a setup binding of the SAME name; if
    // the emitter uses `panelElRef` in script we must emit `ref="panelElRef"`
    // in the template too. Otherwise `panelElRef.value` stays undefined and
    // useOutsideClick / panelEl-bearing logic silently breaks at runtime.
    if (attr.name === 'ref') {
      const refNames = new Set(ir.refs.map((r) => r.name));
      if (refNames.has(attr.value)) {
        return `ref="${attr.value}Ref"`;
      }
    }
    return `${name}="${escapeAttrValue(attr.value)}"`;
  }

  if (attr.kind === 'binding') {
    // r-model rewrites to v-model directive form (NOT :v-model).
    if (attr.name === 'r-model') {
      const expr = rewriteTemplateExpression(attr.expression, ir);
      return `v-model="${expr}"`;
    }
    const expr = rewriteTemplateExpression(attr.expression, ir);
    return `:${name}="${expr}"`;
  }

  // interpolated: if exactly one binding segment, simplify to `:name="<expr>"`.
  if (attr.segments.length === 1 && attr.segments[0]!.kind === 'binding') {
    const seg = attr.segments[0]! as { kind: 'binding'; expression: t.Expression; deps: unknown };
    return `:${name}="${rewriteTemplateExpression(seg.expression, ir)}"`;
  }

  // Multi-segment or single-static — render as template literal.
  // If exactly one static segment, that's effectively a static attribute —
  // but we preserve binding form because it came through interpolated.
  const lit = renderInterpolatedTemplateLiteralSafe(attr.segments, ir);
  return `:${name}="\`${lit}\`"`;
}

/**
 * Bucket attributes by name. Returns lists keyed by name.
 */
function bucket(attrs: AttributeBinding[]): Map<string, AttributeBinding[]> {
  const map = new Map<string, AttributeBinding[]>();
  for (const a of attrs) {
    const list = map.get(a.name) ?? [];
    list.push(a);
    map.set(a.name, list);
  }
  return map;
}

/**
 * Merge multiple attrs sharing the same name (`class` / `style`) into ONE
 * array-form binding. Vue auto-filters falsy values from arrays in :class.
 */
function emitClassOrStyleArrayMerge(
  name: string,
  attrs: AttributeBinding[],
  ir: IRComponent,
): string {
  const segments = attrs.map((a) => attrToArraySegment(a, ir));
  return `:${name}="[${segments.join(', ')}]"`;
}

/**
 * Emit the merged attribute string for an element. Keeps the original IR
 * order in the output where possible; class/style merges are emitted in the
 * position of the FIRST class/style attr in the source.
 */
export function emitMergedAttributes(
  attrs: AttributeBinding[],
  ctx: EmitAttrCtx,
): string {
  if (attrs.length === 0) return '';

  const buckets = bucket(attrs);
  const out: string[] = [];
  const consumed = new Set<AttributeBinding>();

  for (const a of attrs) {
    if (consumed.has(a)) continue;

    const sameNameAttrs = buckets.get(a.name) ?? [a];

    if ((a.name === 'class' || a.name === 'style') && sameNameAttrs.length > 1) {
      // Merge all attrs sharing this name into one :class array binding.
      out.push(emitClassOrStyleArrayMerge(a.name, sameNameAttrs, ctx.ir));
      for (const x of sameNameAttrs) consumed.add(x);
      continue;
    }

    // Single attr (or non-class/style multi which we don't merge).
    out.push(emitSingleAttr(a, ctx.ir));
    consumed.add(a);
  }

  return out.join(' ');
}
