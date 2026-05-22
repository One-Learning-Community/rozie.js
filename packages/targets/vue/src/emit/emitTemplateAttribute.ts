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
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import type { ModifierRegistry } from '@rozie/core';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface EmitAttrCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  /**
   * WR-03 (12-REVIEW) — the host element's tag name (`input`/`select`/
   * `textarea`/…). Optional so existing call sites (and the unit-test
   * harness) stay source-compatible. The custom-modifier `r-model`
   * hand-emit path needs it to distinguish `<input>` (where the
   * `$event.target.value` committed-value form is correct) from
   * `<select>`/`<textarea>` (where it cannot — e.g. `<select multiple>`'s
   * value is an array, not `$event.target.value`).
   */
  elementTagName?: string;
  /**
   * WR-03 (12-REVIEW) — optional diagnostics sink. When present, the
   * custom-modifier hand-emit path pushes a warning here for an unsupported
   * host element instead of silently producing wrong output.
   */
  diagnostics?: Diagnostic[];
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
 * HTML attributes whose Vue prop type is `Booleanish`. A valueless boolean
 * attribute in `.rozie` source (`<input multiple>`) arrives at the static
 * emit branch with `attr.value === ''` — emitting `multiple=""` (an empty
 * string) is rejected by Vue's `Booleanish` type. Quick task 260520-w18 bug
 * class 4 — emit the bare valueless attribute `multiple` instead.
 */
const BOOLEAN_HTML_ATTRS: ReadonlySet<string> = new Set([
  'multiple',
  'disabled',
  'readonly',
  'required',
  'checked',
  'selected',
  'hidden',
  'autofocus',
  'autoplay',
  'controls',
  'loop',
  'muted',
  'default',
  'open',
  'novalidate',
  'formnovalidate',
  'itemscope',
  'reversed',
]);

/**
 * Quick task 260520-w18 — `:attr` binding `null`-fallback normalization.
 *
 * A `.rozie` author writes `:accept="x ? x.join(',') : null"`, where `null`
 * means "remove the attribute". `vue-tsc`'s DOM-attribute typings type
 * optional HTML attributes as `string | undefined` (NOT `string | null`), so
 * a `null`-yielding ternary branch is a TS2322. Vue treats `undefined`
 * identically to `null` for attribute binding ("attribute absent"), so
 * translating a branch-position `null` literal to `undefined` is the faithful
 * mapping. Returns a cloned expression — the IR node is never mutated.
 */
function normalizeNullAttrBinding(expr: t.Expression): t.Expression {
  if (!t.isConditionalExpression(expr)) return expr;
  const cloned = t.cloneNode(expr, true, false) as t.ConditionalExpression;
  if (t.isNullLiteral(cloned.consequent)) {
    cloned.consequent = t.identifier('undefined');
  }
  if (t.isNullLiteral(cloned.alternate)) {
    cloned.alternate = t.identifier('undefined');
  }
  return cloned;
}

/**
 * Phase 12 — the three BUILT-IN model modifiers. Vue has a native `v-model`
 * suffix for each (`v-model.lazy.number.trim`), so a chain composed only of
 * these maps ~1:1. Any modifier NOT in this set is a CUSTOM model modifier
 * with no native Vue equivalent — its presence forces the whole `r-model`
 * attribute to be hand-emitted (`:value` + `@input`/`@change`).
 */
const VUE_NATIVE_MODEL_MODIFIERS: ReadonlySet<string> = new Set([
  'lazy',
  'number',
  'trim',
]);

/**
 * Phase 12 — partition a resolved `r-model` modifier list into the pieces the
 * Vue emitter needs:
 *   - `nativeSuffixes`: built-in modifier names (`.lazy`/`.number`/`.trim`) —
 *     emitted as native `v-model` suffixes when no custom modifier is present.
 *   - `valueTransforms`: ordered `$v`-placeholder fragments (D-07-canonical) —
 *     used when hand-emitting because a custom modifier is present.
 *   - `isLazy`: whether any modifier declares `eventSwap: 'change'` (`.lazy`).
 *   - `hasCustom`: whether any modifier is NOT a Vue native built-in.
 */
function partitionVueModelModifiers(
  modifiers:
    | { name: string; descriptor: { valueTransform?: string; eventSwap?: 'change' } }[]
    | undefined,
): {
  nativeSuffixes: string[];
  valueTransforms: string[];
  isLazy: boolean;
  hasCustom: boolean;
} {
  const nativeSuffixes: string[] = [];
  const valueTransforms: string[] = [];
  let isLazy = false;
  let hasCustom = false;
  for (const m of modifiers ?? []) {
    if (VUE_NATIVE_MODEL_MODIFIERS.has(m.name)) {
      nativeSuffixes.push(m.name);
    } else {
      hasCustom = true;
    }
    if (m.descriptor.valueTransform) valueTransforms.push(m.descriptor.valueTransform);
    if (m.descriptor.eventSwap === 'change') isLazy = true;
  }
  return { nativeSuffixes, valueTransforms, isLazy, hasCustom };
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
 * Render a static text segment as a JS-string literal suitable for inclusion
 * in an array (`'counter'`, `'card '`).
 */
function staticSegmentLiteral(text: string): string {
  // Escape backticks/single-quotes as needed; safest approach: JSON.stringify
  // gives a double-quoted JS literal. We use single quotes for visual clarity.
  return JSON.stringify(text).replace(/^"(.*)"$/, "'$1'").replace(/\\"/g, '"');
}

/**
 * Render an interpolated AttributeBinding's segments as template-literal inner
 * contents (without the surrounding backticks). E.g.,
 *   [{static:'card '}, {binding: variant}] → 'card ${variant}'
 *
 * Static text gets a minimal escape (backslash + backtick + `${` sequences).
 *
 * WR-01 (12-REVIEW) — the earlier non-`Safe` variant of this function (which
 * over-escaped a bare `$`) was dead code and has been deleted; this is the
 * single correct implementation and covers every call site.
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
  if (attr.kind === 'spreadBinding') {
    // Phase 14 — `spreadBinding` is the name-less kind: it never reaches a
    // class/style merge (no name to coalesce on). Unreachable; mirrors the
    // `twoWayBinding` guard above.
    throw new Error(
      `Vue target: spreadBinding not valid in class/style array context (Phase 14).`,
    );
  }
  // interpolated
  return '`' + renderInterpolatedTemplateLiteralSafe(attr.segments, ir) + '`';
}

/**
 * Emit a single non-class/style binding/static attribute as one attribute pair.
 */
function emitSingleAttr(attr: AttributeBinding, ctx: EmitAttrCtx): string {
  const ir = ctx.ir;
  if (attr.kind === 'spreadBinding') {
    // Phase 14 R2 / D-07 — the bare-spread `r-bind="<expr>"` form (and the
    // synthesized `$attrs` auto-fallthrough spread). Vue's native
    // attribute-spread idiom is argument-less `v-bind="<obj>"` — every own
    // enumerable key of the object becomes an attribute on the host element.
    const expr = rewriteTemplateExpression(attr.expression, ir);
    return `v-bind="${expr}"`;
  }
  if (attr.kind === 'twoWayBinding') {
    // Phase 07.3 Wave 3 Plan 07.3-03 (TWO-WAY-03) — consumer-side two-way binding.
    // Mirror native Vue 3.4+ idiom (D-01): `r-model:propName="<expr>"` lowers to
    // `v-model:<propName>="<rewritten-expr>"`. The producer-side `defineModel<T>`
    // machinery (TWO-WAY-02) is already in place; this branch wires the consumer
    // template attribute into it. The RHS is rewritten via the standard template
    // expression rewriter so $data.x → x and $props.x (model:true) → x per Vue
    // auto-unwrap conventions. PropName is preserved verbatim (camelCase
    // intentional — Vue's `v-model:argName` is camelCase-preserving).
    const expr = rewriteTemplateExpression(attr.expression, ir);
    return `v-model:${attr.name}="${expr}"`;
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
    // Valueless boolean HTML attribute (`<input multiple>`) — emit the bare
    // attribute `multiple` (not `multiple=""`, which Vue's `Booleanish` type
    // rejects). Quick task 260520-w18 bug class 4.
    if (attr.value === '' && BOOLEAN_HTML_ATTRS.has(attr.name.toLowerCase())) {
      return name;
    }
    return `${name}="${escapeAttrValue(attr.value)}"`;
  }

  if (attr.kind === 'binding') {
    // r-model rewrites to v-model directive form (NOT :v-model).
    if (attr.name === 'r-model') {
      const expr = rewriteTemplateExpression(attr.expression, ir);
      // Phase 12 — the resolved `r-model` modifier chain.
      const { nativeSuffixes, valueTransforms, isLazy, hasCustom } =
        partitionVueModelModifiers(attr.modifiers);
      if (!hasCustom) {
        // No custom modifier — every modifier (if any) is a Vue native
        // built-in. Append them as `.`-separated `v-model` suffixes. Bare
        // `r-model` (empty list) stays exactly `v-model="${expr}"`.
        const suffix =
          nativeSuffixes.length > 0 ? `.${nativeSuffixes.join('.')}` : '';
        return `v-model${suffix}="${expr}"`;
      }
      // A custom model modifier is present — Vue has no native equivalent, so
      // hand-emit. Drop `v-model` and emit an explicit `:value` plus an event
      // handler (`@input` normally, `@change` when `.lazy` is in the chain)
      // whose body assigns the transformed value back. The transformed value
      // chains each modifier's `valueTransform` fragment in D-07 list order
      // (the resolved list arrives already canonicalized).
      //
      // WR-03 (12-REVIEW) — the hand-emit committed-value form below reads
      // `$event.target.value`, which is correct for `<input>` but wrong for
      // `<select multiple>` (whose value is an array of selected options,
      // not `$event.target.value`). The custom-modifier hand-emit path is
      // therefore supported on `<input>` only; for `<select>`/`<textarea>`
      // with a custom modifier, emit a warning rather than silently shipping
      // wrong output. (`elementTagName` is optional context; when absent the
      // emitter assumes `<input>` — the overwhelmingly common host and the
      // pre-WR-03 behavior — so no false positives in legacy call sites.)
      const tagName = ctx.elementTagName?.toLowerCase();
      if (tagName === 'select' || tagName === 'textarea') {
        ctx.diagnostics?.push({
          code: RozieErrorCode.RMODEL_MODIFIER_NOT_APPLICABLE,
          severity: 'warning',
          message: `Custom r-model modifiers are not supported on <${tagName}> in the Vue target — the hand-emitted committed value reads $event.target.value, which is incorrect for <select multiple> and may misbehave for <textarea>.`,
          loc: attr.sourceLoc,
          hint: 'Use a custom r-model modifier on an <input>, or coerce the value inside the bound state instead.',
        });
      }
      const committedValue = applyValueTransformsString(
        '$event.target.value',
        valueTransforms,
      );
      const eventName = isLazy ? 'change' : 'input';
      return `:value="${expr}" @${eventName}="${expr} = ${committedValue}"`;
    }
    // A `null`-fallback ternary (`x ? … : null`) is normalized to yield
    // `undefined` so vue-tsc's `string | undefined` attr types accept it
    // (quick task 260520-w18).
    const expr = rewriteTemplateExpression(
      normalizeNullAttrBinding(attr.expression),
      ir,
    );
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
 *
 * Phase 14 — `spreadBinding` is the name-less `AttributeBinding` kind (D-07):
 * it binds an open-ended object, not a single named attribute, so it never
 * participates in class/style name-merging and is skipped here. `emitSingleAttr`
 * still emits it (as `v-bind="<expr>"`) on the `emitMergedAttributes` pass.
 */
function bucket(attrs: AttributeBinding[]): Map<string, AttributeBinding[]> {
  const map = new Map<string, AttributeBinding[]>();
  for (const a of attrs) {
    if (a.kind === 'spreadBinding') continue;
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

    // Phase 14 — `spreadBinding` is the name-less kind (D-07): it never
    // participates in class/style name-merging. Emit it directly via
    // `emitSingleAttr` (→ `v-bind="<expr>"`) and skip the name-bucket logic,
    // which would otherwise read its non-existent `.name`.
    if (a.kind === 'spreadBinding') {
      out.push(emitSingleAttr(a, ctx));
      consumed.add(a);
      continue;
    }

    const sameNameAttrs = buckets.get(a.name) ?? [a];

    if ((a.name === 'class' || a.name === 'style') && sameNameAttrs.length > 1) {
      // Merge all attrs sharing this name into one :class array binding.
      out.push(emitClassOrStyleArrayMerge(a.name, sameNameAttrs, ctx.ir));
      for (const x of sameNameAttrs) consumed.add(x);
      continue;
    }

    // Single attr (or non-class/style multi which we don't merge).
    out.push(emitSingleAttr(a, ctx));
    consumed.add(a);
  }

  return out.join(' ');
}
