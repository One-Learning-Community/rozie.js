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
  ListenerSpreadIR,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import type { ModifierRegistry } from '@rozie/core';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { ScriptInjection } from './emitTemplateEvent.js';

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
  /**
   * Phase 15 — optional script-injection sink for the dynamic
   * `r-on="<expr>"` listener-spread path. When the emitter routes a
   * non-literal listener spread through `v-on="normalizeListeners(<expr>)"`,
   * it pushes a `ScriptInjection` with `import: { from: '@rozie/runtime-vue',
   * name: 'normalizeListeners' }` here so the shell threads the import
   * (zero `decl` — the import is the only contribution; `mergeScriptInjections`
   * dedupes by `import.from + import.name`).
   */
  scriptInjections?: ScriptInjection[];
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
 * Phase 14 R6 — keys that must never reach the emitted object from an
 * author-controlled `r-bind` LITERAL. Mirrors the React/Solid `FORBIDDEN_SPREAD_KEYS`
 * set and the Phase 02 `collectPropDecls` write-time guard (T-14-06).
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
function staticPropKey(prop: t.ObjectProperty): string | null {
  if (t.isIdentifier(prop.key) && !prop.computed) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  return null;
}

/**
 * Phase 14 R6 — split an `r-bind` LITERAL object into (class-value, style-value,
 * rest). The `class`/`style` keys are extracted so they can be fed into the
 * existing multi-source class/style merge paths; `rest` is the object with those
 * keys removed, ready for a `v-bind` spread. Returns null entries when a key is
 * absent. T-14-06: `__proto__`/`constructor`/`prototype` keys are dropped from
 * the literal entirely (mirrors the React/Solid compile-time pollution guard).
 *
 * Operates on Vue HTML attribute names verbatim — no key remap is applied here
 * (D-03 is React/Solid-only; Vue/Svelte want HTML names through).
 */
function splitClassStyleFromVueLiteral(obj: t.ObjectExpression): {
  classValue: t.Expression | null;
  styleValue: t.Expression | null;
  rest: t.ObjectExpression;
} {
  let classValue: t.Expression | null = null;
  let styleValue: t.Expression | null = null;
  const restProps: t.ObjectExpression['properties'] = [];
  for (const prop of obj.properties) {
    if (t.isObjectProperty(prop)) {
      const keyName = staticPropKey(prop);
      // T-14-06 — drop a pollution-vector literal key entirely.
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
 * Phase 14 R6 — extract a `class`/`style` value from an `r-bind` LITERAL so it
 * can be folded into the element's class/style merge. Returns null entries when
 * the spread is not a literal (dynamic spreads / `$attrs` — keys unknowable;
 * see `emitSingleAttr` KNOWN LIMITATION).
 */
function extractLiteralClassStyleFromSpread(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
): { classValue: t.Expression | null; styleValue: t.Expression | null } {
  if (!t.isObjectExpression(attr.expression)) {
    return { classValue: null, styleValue: null };
  }
  const { classValue, styleValue } = splitClassStyleFromVueLiteral(attr.expression);
  return { classValue, styleValue };
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
    // Phase 14 R6 — a `spreadBinding` reaches this array-segment helper ONLY
    // when its LITERAL object carries a `class`/`style` key that has been
    // extracted upstream as a synthetic class/style binding. The synthetic
    // binding has kind='binding', not kind='spreadBinding', so a real
    // `spreadBinding` never lands here. Unreachable — mirrors the
    // `twoWayBinding` guard above.
    throw new Error(
      `Vue target: spreadBinding not valid in class/style array context (Phase 14).`,
    );
  }
  // interpolated
  return '`' + renderInterpolatedTemplateLiteralSafe(attr.segments, ir) + '`';
}

/**
 * Phase 14 R2 / D-07 — render an `r-bind` spread for the Vue target. Vue's
 * native attribute-spread idiom is argument-less `v-bind="<obj>"` — every own
 * enumerable key of the object becomes an attribute on the host element. No
 * key normalization is applied: Vue wants HTML attribute names verbatim (D-03
 * is React/Solid-only).
 *
 * `$attrs` is Vue's NATIVE template magic accessor (Vue auto-binds the
 * consumer's non-prop attributes to it). A bare `r-bind="$attrs"` emits
 * `v-bind="$attrs"` straight through — `rewriteTemplateExpression` leaves the
 * bare `$attrs` Identifier alone (no `$props`/`$data`/`$refs` member match), so
 * Vue's own `$attrs` proxy is the runtime source. No additional rewrite is
 * needed in Vue's `rewriteTemplateExpression` for `$attrs`.
 *
 * KNOWN LIMITATION (RESEARCH Open Question 1 / Assumption A4 / Option a) — for
 * a DYNAMIC `r-bind` object the keys are NOT known at compile time, so a
 * `class`/`style` key inside a dynamic spread CANNOT be extracted into the
 * class/style merge path. Vue's own `v-bind` merge order applies (a later
 * `v-bind` overrides an earlier `:class` for the same key). The R6 acceptance
 * fixture uses a LITERAL `r-bind`, so the literal path is the mandatory one
 * and is fully merge-correct.
 */
function emitSpread(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
  ir: IRComponent,
  /** When the element has an explicit `class`/`style` binding, the literal's
   *  class/style is extracted upstream — emit only the `rest`. */
  hasExplicitClassOrStyle: boolean,
): string {
  if (
    hasExplicitClassOrStyle &&
    t.isObjectExpression(attr.expression)
  ) {
    // R6 — LITERAL spread with class/style extracted into the merge path; only
    // spread the remaining keys.
    const { rest } = splitClassStyleFromVueLiteral(attr.expression);
    const expr = rewriteTemplateExpression(rest, ir);
    return `v-bind="${expr}"`;
  }
  if (t.isObjectExpression(attr.expression)) {
    // LITERAL spread without an explicit class/style sibling — still apply the
    // T-14-06 pollution guard so a `__proto__`/`constructor`/`prototype`
    // literal key never reaches the emitted object.
    const { rest, classValue, styleValue } = splitClassStyleFromVueLiteral(attr.expression);
    // No explicit sibling means class/style flow through `v-bind` normally —
    // re-attach the extracted keys onto `rest` after the pollution scrub.
    const restProps = [...rest.properties];
    if (classValue !== null) {
      restProps.push(t.objectProperty(t.identifier('class'), classValue));
    }
    if (styleValue !== null) {
      restProps.push(t.objectProperty(t.identifier('style'), styleValue));
    }
    const scrubbed = t.objectExpression(restProps);
    const expr = rewriteTemplateExpression(scrubbed, ir);
    return `v-bind="${expr}"`;
  }
  // DYNAMIC spread or bare `$attrs` Identifier — pass through verbatim. Vue
  // handles attribute-object spread natively with `v-bind="<obj>"`.
  const expr = rewriteTemplateExpression(attr.expression, ir);
  return `v-bind="${expr}"`;
}

/**
 * Emit a single non-class/style binding/static attribute as one attribute pair.
 */
function emitSingleAttr(attr: AttributeBinding, ctx: EmitAttrCtx): string {
  const ir = ctx.ir;
  if (attr.kind === 'spreadBinding') {
    // Phase 14 R2 / D-07 — bare-spread emit. The R6 class/style merge is
    // handled in `emitMergedAttributes`; this single-attr fallback path is
    // reached when no explicit class/style sibling exists.
    return emitSpread(attr, ir, /* hasExplicitClassOrStyle */ false);
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
 * Phase 15 D-19 — bare `$listeners` Identifier predicate. The auto-fallthrough
 * push (lowerTemplate.ts `synthesizeListenersFallthrough`) and an author-
 * written `r-on="$listeners"` both lower to a bare `$listeners` Identifier;
 * the emitter cannot (and need not) distinguish them. Mirrors the Phase 14
 * `$attrs` D-04 exemption.
 */
function isListenersIdentifier(expr: t.Expression): boolean {
  return t.isIdentifier(expr, { name: '$listeners' });
}

/**
 * Phase 15 — emit a single `ListenerSpreadIR` for Vue as one Vue-template
 * attribute string (the `v-on="..."` object form). The LITERAL path is NOT
 * routed through this helper — literal-key spreads are decomposed into
 * synthetic `Listener` entries and run through the existing per-event emit
 * (so modifier-bearing keys like `'click.stop'` reuse `emitTemplateEvent`'s
 * modifier-pipeline emit; Pitfall A5: Vue's `v-on="<obj>"` does NOT support
 * modifiers).
 *
 * Two cases (the literal third case is handled at the per-element walker):
 *
 *   - bare `$listeners` (D-19 exempt) → `v-on="$listeners"` — no
 *     `normalizeListeners` wrap (consumer's `$listeners` already carries
 *     target-native lowercase keys; A1 / Pitfall 8 — Vue native-element
 *     `v-on` is lowercase).
 *
 *   - DYNAMIC expression                → `v-on="normalizeListeners(<expr>)"`,
 *     plus a `ScriptInjection` pushed onto `ctx.scriptInjections` so the
 *     shell threads `import { normalizeListeners } from '@rozie/runtime-vue';`.
 *
 * R6 same-event merge for the mixed (literal + dynamic) case is handled by
 * Vue's DOM-level `addEventListener` stacking — native `@click=` directives
 * and `v-on="<obj>"` both attach via `addEventListener`, so both fire
 * automatically (Vue divergence from React/Solid; no runtime `mergeListeners`
 * helper for Vue).
 */
export function emitListenerSpread(
  spread: ListenerSpreadIR,
  ctx: EmitAttrCtx,
): string {
  if (isListenersIdentifier(spread.expression)) {
    // D-19 — bare $listeners; pass through unwrapped.
    const expr = rewriteTemplateExpression(spread.expression, ctx.ir);
    return `v-on="${expr}"`;
  }
  // Dynamic spread — runtime key-pass-through (FORBIDDEN_KEYS skip).
  if (ctx.scriptInjections) {
    ctx.scriptInjections.push({
      wrapName: 'normalizeListeners',
      import: { from: '@rozie/runtime-vue', name: 'normalizeListeners' },
      decl: '',
    });
  }
  const expr = rewriteTemplateExpression(spread.expression, ctx.ir);
  return `v-on="normalizeListeners(${expr})"`;
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

  // Phase 14 R6 — does the element have an explicit `class`/`style` binding?
  // When so, a `class`/`style` key inside an `r-bind` LITERAL must be folded
  // into the class/style merge path (not spread as a separate `:class`/`:style`,
  // which Vue's `v-bind` would last-wins-overwrite the explicit one).
  const hasExplicitClass = (buckets.get('class')?.length ?? 0) > 0;
  const hasExplicitStyle = (buckets.get('style')?.length ?? 0) > 0;

  // Phase 14 R6 — synthesise extra `class`/`style` AttributeBindings from any
  // `r-bind` LITERAL that carries those keys, so `emitClassOrStyleArrayMerge`
  // sees both the explicit `:class`/`:style` and the literal's value as merge
  // sources. The synthetic bindings adopt the spread's source position so the
  // existing positional last-wins semantics are preserved.
  const literalClassBindings = new Map<AttributeBinding, AttributeBinding>();
  const literalStyleBindings = new Map<AttributeBinding, AttributeBinding>();
  for (const a of attrs) {
    if (a.kind !== 'spreadBinding') continue;
    const { classValue, styleValue } = extractLiteralClassStyleFromSpread(a);
    if (hasExplicitClass && classValue !== null) {
      literalClassBindings.set(a, {
        kind: 'binding',
        name: 'class',
        expression: classValue,
        deps: [],
        sourceLoc: a.sourceLoc,
      });
    }
    if (hasExplicitStyle && styleValue !== null) {
      literalStyleBindings.set(a, {
        kind: 'binding',
        name: 'style',
        expression: styleValue,
        deps: [],
        sourceLoc: a.sourceLoc,
      });
    }
  }

  for (const a of attrs) {
    if (consumed.has(a)) continue;

    // Phase 14 — `spreadBinding` is the name-less kind (D-07): it never
    // participates in class/style name-bucketing. Emit it directly via
    // `emitSpread` (→ `v-bind="<expr>"`). When a sibling explicit
    // `class`/`style` exists, the literal's class/style is folded into the
    // class/style merge path below (consumed.add'd into the synthesized
    // bindings) and `emitSpread` drops those keys from the spread's `rest`.
    if (a.kind === 'spreadBinding') {
      const dropClass = literalClassBindings.has(a);
      const dropStyle = literalStyleBindings.has(a);
      out.push(emitSpread(a, ctx.ir, dropClass || dropStyle));
      consumed.add(a);
      continue;
    }

    const sameNameAttrs = buckets.get(a.name) ?? [a];

    // R6 — when an explicit `class`/`style` binding coexists with an `r-bind`
    // LITERAL carrying that same key, build the merge input from BOTH sources
    // walked in source order so positional last-wins is preserved.
    if (a.name === 'class' || a.name === 'style') {
      const literalMap = a.name === 'class' ? literalClassBindings : literalStyleBindings;
      const hasLiteralMerge = literalMap.size > 0;
      if (sameNameAttrs.length > 1 || hasLiteralMerge) {
        // Walk the FULL attrs list in source order, picking out the
        // same-named bindings + any synthesised binding extracted from an
        // `r-bind` LITERAL at its source position.
        const merged: AttributeBinding[] = [];
        for (const src of attrs) {
          if (src.kind === 'spreadBinding') {
            const synthetic = literalMap.get(src);
            if (synthetic) merged.push(synthetic);
          } else if (src.name === a.name) {
            merged.push(src);
          }
        }
        if (merged.length > 1) {
          out.push(emitClassOrStyleArrayMerge(a.name, merged, ctx.ir));
          for (const x of sameNameAttrs) consumed.add(x);
          continue;
        }
      }
    }

    // Single attr (or non-class/style multi which we don't merge).
    out.push(emitSingleAttr(a, ctx));
    consumed.add(a);
  }

  return out.join(' ');
}
