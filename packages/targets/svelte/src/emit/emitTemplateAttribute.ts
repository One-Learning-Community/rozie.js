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
  ListenerSpreadIR,
} from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface EmitAttrCtx {
  ir: IRComponent;
  /**
   * Phase 06.2 — the tagKind of the host element. When 'component' or 'self'
   * the attribute is a Svelte component prop binding; kebab-case attribute
   * names like `on-close` MUST be converted to camelCase (`onClose`) to match
   * the producer's declared prop. Bare HTML elements (kind 'html') keep the
   * kebab-case form so `aria-*` / `data-*` pass through unchanged.
   */
  elementTagKind?: 'html' | 'component' | 'self';
  /**
   * 260519 linechart-watch-recreate step 5 — the host element's static `type`
   * attribute value, lowercased, when the host is an `<input>`. `r-model` on a
   * `<input type="checkbox">` must emit `bind:checked` (Svelte's checkbox
   * two-way primitive); every other input type uses `bind:value`. emitAttributes
   * resolves this from the sibling static `type` attribute and threads it here
   * so the per-attribute emit can pick the right `bind:` directive. Undefined
   * for non-input hosts or inputs with no static type (Svelte defaults
   * `<input>` to text — `bind:value` is correct there).
   */
  inputType?: string;
  /**
   * Pre-Phase-16 cleanup Item-2-residual — true when the host element ALSO
   * carries a bare-`$attrs` `spreadBinding` (attribute auto-fallthrough is
   * active). When this is set, `:style="{...}"` object-literal lowering
   * switches from `style:<prop>={value}` directives to a string-form
   * `style="prop: value; ..."` attribute. Background: Svelte's compiled
   * output places per-property `style:` directive state under a Symbol-keyed
   * slot processed AFTER any spread inside the generated props object, so
   * `style:` directives intentionally win over spread `style` — the OPPOSITE
   * precedence the other 5 targets implement for the auto-fallthrough case.
   * Re-emitting the wrapper's `:style` defaults as a string attribute lets
   * the consumer's spread `style="..."` value overwrite them via
   * `setAttribute('style', ...)`, restoring cross-target parity. Wrapper's
   * un-overridden defaults survive via the `var(--prop, fallback)` CSS
   * fallback the wrappers idiomatically already declare.
   */
  hasFallthroughSpread?: boolean;
  /**
   * Phase 26 (D-01/D-06) — the template walk's `@rozie/runtime-svelte` import
   * accumulator. When an attribute-binding or class interpolation wraps in
   * `rozieDisplay` (`wrapForDisplay` true), the emitter adds `'rozieDisplay'`
   * here so `emitSvelte` folds the runtime import line in. Optional so legacy
   * call sites (no wrap possible) stay unaffected.
   */
  runtimeImports?: Set<string>;
}

/**
 * HTML attributes whose Svelte JSX-element prop type is `boolean`. A valueless
 * boolean attribute in `.rozie` source (`<input multiple>`) arrives at the
 * static emit branch with `attr.value === ''` — emitting `multiple=""` (a
 * string) fails Svelte's `boolean | null | undefined`-typed prop. Quick task
 * 260520-w18 bug class 4 (extended to Svelte — the inventory only named
 * React/Vue, but Svelte hits the identical mismatch). Emit the bare valueless
 * attribute `multiple` instead.
 */
/** Form-input value/checked attrs that are controlled-input props (no wrap). */
const FORM_INPUT_VALUE_ATTRS: ReadonlySet<string> = new Set(['value', 'checked']);

/**
 * Phase 26 — does a `wrapForDisplay`-flagged attribute binding render as
 * attribute TEXT (where `[object Object]` would surface)? Component/self-tag
 * prop bindings and form-input value/checked props are exempt (twin of React's
 * `shouldWrapAttrBinding`). `inputType` is only set for `<input>` hosts.
 */
function shouldWrapSvelteAttrBinding(
  name: string,
  expr: t.Expression,
  ctx: EmitAttrCtx,
): boolean {
  if (ctx.elementTagKind === 'component' || ctx.elementTagKind === 'self') return false;
  // CR-02 — Boolean HTML attrs are not display text; wrapping feeds a string
  // into a boolean prop (TS2322 + "false"-is-truthy flip) and diverges from
  // Lit/Angular which keep boolean-attr bindings raw. Always raw, matching them.
  if (BOOLEAN_HTML_ATTRS.has(name.toLowerCase())) return false;
  if (ctx.inputType !== undefined && FORM_INPUT_VALUE_ATTRS.has(name)) return false;
  // `style` is structural (Svelte lowers `:style` objects to `style:` directives
  // / handles string style natively) — never display text.
  if (name === 'style') return false;
  // An object-form binding (`:class="{ active: x }"`) is a clsx-style structural
  // object Svelte handles natively — never display text. Wrapping would
  // JSON-stringify it and break the conditional class/attr.
  if (t.isObjectExpression(expr)) return false;
  return true;
}

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
 * Convert kebab-case to camelCase for component property bindings.
 *   `on-close` → `onClose`
 * HTML-natural kebab-case attribute names (`aria-*`, `data-*`) MUST stay
 * kebab-case so they survive `$$restProps` and reach the wrapper's root
 * element as proper HTML attributes — a wrapper's `$attrs` spread (= Svelte
 * `$$restProps`) preserves the key shape verbatim, so a camelCased
 * `ariaLabel` would land on the DOM as `arialabel` (or be dropped) rather
 * than the desired `aria-label`. Same story for `data-*` and the locator
 * tests that depend on `[data-testid="…"]`.
 */
function isHtmlNaturalKebabName(name: string): boolean {
  // Phase 14 — HTML-attribute-style kebab names that must NOT be camelCased
  // when emitted on a Svelte component invocation. Producer-side, a wrapper
  // using `inherit-attrs` (default) re-emits `$$restProps` onto its root
  // element; receivers spread keys verbatim. Camel-mangling these would
  // strand them as bogus camel-cased HTML attributes on the rendered DOM.
  const lower = name.toLowerCase();
  return (
    lower.startsWith('aria-') ||
    lower.startsWith('data-') ||
    lower === 'role' ||
    lower === 'class' ||
    lower === 'style' ||
    lower === 'id' ||
    lower === 'title' ||
    lower === 'lang' ||
    lower === 'dir' ||
    lower === 'tabindex'
  );
}

function kebabToCamel(name: string): string {
  if (!name.includes('-')) return name;
  return name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

/**
 * Resolve the emitted attribute name given the host tag kind.
 *
 * On Svelte component invocations, only `on-foo`-style author-defined prop
 * names get camelCased (so a `:on-close` binding lands on the producer's
 * declared `onClose` prop). HTML-natural attribute names — `aria-*`,
 * `data-*`, plus a small set of plain HTML attrs (`role`, `class`, `style`,
 * etc.) — pass through unchanged so the producer's `$$restProps` spread
 * reaches the root element as legal HTML attributes.
 *
 * Bare HTML element hosts ALWAYS keep kebab-case verbatim (the caller
 * passes `elementTagKind: 'html'`).
 */
function resolveAttrName(name: string, ctx: EmitAttrCtx): string {
  if (ctx.elementTagKind !== 'component' && ctx.elementTagKind !== 'self') {
    return name;
  }
  if (isHtmlNaturalKebabName(name)) return name;
  return kebabToCamel(name);
}

/** Minimal HTML attribute-value escape. */
function escapeAttrValue(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Phase 12 — partition a resolved `r-model` modifier list into the pieces the
 * Svelte emitter needs:
 *   - `valueTransforms`: ordered `$v`-placeholder fragments (D-07-canonical).
 *   - `isLazy`: whether any modifier declares `eventSwap: 'change'` (`.lazy`).
 *   - `hasAny`: whether the chain carries at least one modifier — when true the
 *     emit drops Svelte's `bind:value` two-way sugar (which cannot carry a
 *     value coercion) for an explicit `value={…}` + handler form.
 */
function partitionSvelteModelModifiers(
  modifiers:
    | { name: string; descriptor: { valueTransform?: string; eventSwap?: 'change' } }[]
    | undefined,
): { valueTransforms: string[]; isLazy: boolean; hasAny: boolean } {
  const valueTransforms: string[] = [];
  let isLazy = false;
  const list = modifiers ?? [];
  for (const m of list) {
    if (m.descriptor.valueTransform) valueTransforms.push(m.descriptor.valueTransform);
    if (m.descriptor.eventSwap === 'change') isLazy = true;
  }
  return { valueTransforms, isLazy, hasAny: list.length > 0 };
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
 * Convert a JS object-property key (camelCase or already-kebab) to
 * kebab-case for use as a Svelte 5 `style:<prop>={value}` directive name.
 *
 *   backgroundColor → background-color
 *   background      → background
 *   borderTopWidth  → border-top-width
 *   --custom-prop   → --custom-prop   (leading-dash preserved; vendor / CSS-var)
 *   WebkitTransform → -webkit-transform   (leading capital → leading dash)
 *
 * Idempotent on already-kebab inputs.
 */
function kebabizeStyleKey(key: string): string {
  // CSS custom properties (`--foo-bar`) pass through verbatim.
  if (key.startsWith('--')) return key;
  // Replace each uppercase letter with `-<lower>`; if the FIRST char is
  // uppercase (vendor prefix like Webkit/Moz/O/Ms) the leading dash is correct.
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/**
 * Render an ObjectExpression's property KEY as a plain string. Accepts
 * Identifier (`background`), StringLiteral (`'background'`), or
 * NumericLiteral (rare — `123` style keys). Returns null for shapes we
 * cannot safely lower (computed keys, spreads, methods).
 */
function objectPropertyKeyAsString(
  prop: t.ObjectProperty,
): string | null {
  if (prop.computed) return null;
  if (t.isIdentifier(prop.key)) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  if (t.isNumericLiteral(prop.key)) return String(prop.key.value);
  return null;
}

/**
 * Lower `:style="{ key: value, ... }"` (literal object expression) into a
 * series of Svelte-5 `style:<kebab(key)>={<value>}` directives — one per
 * property — joined by spaces.
 *
 * Returns null when the attribute is NOT a binding-kind `:style` with a
 * literal ObjectExpression, OR when any property is a spread / method /
 * computed-key / non-property-shape (we bail out and let the caller fall
 * through to the existing `style={<expr>}` passthrough, which is what
 * Svelte 5's `style:` directive form requires anyway — the string form
 * works natively).
 *
 * Spike 004 — Svelte subset. Per-key `style:` directives have per-key
 * reactivity in Svelte 5; this is actually more efficient than the
 * (rejected) object passthrough, which serializes via toString and
 * produces `[object Object]`.
 */
function tryEmitStyleObjectLiteral(
  attr: AttributeBinding,
  ir: IRComponent,
  ctx?: EmitAttrCtx,
): string | null {
  if (attr.kind !== 'binding') return null;
  if (attr.name !== 'style') return null;
  if (!t.isObjectExpression(attr.expression)) return null;

  // Pre-Phase-16 Item-2-residual — when auto-fallthrough is active on this
  // element, the consumer's spread `style="..."` value would otherwise lose
  // to the wrapper's `style:<prop>=` directives (Svelte's STYLES_KEY runs
  // after spread by design). Emit the wrapper's defaults as a string-form
  // `style="prop: value; ..."` attribute instead — the spread's
  // setAttribute then overwrites it cleanly, restoring cross-target
  // consumer-wins precedence. Bail to null (caller falls through to the
  // generic `style={<expr>}` passthrough) if any property value is too
  // complex to safely serialise to a CSS declaration string.
  if (ctx?.hasFallthroughSpread) {
    const parts: string[] = [];
    for (const prop of attr.expression.properties) {
      if (!t.isObjectProperty(prop)) return null;
      const keyName = objectPropertyKeyAsString(prop);
      if (keyName === null) return null;
      if (!t.isExpression(prop.value)) return null;
      const cssProp = kebabizeStyleKey(keyName);
      // String-literal value → splice the value text verbatim (no quoting in
      // CSS — declarations are not JS).
      if (t.isStringLiteral(prop.value)) {
        parts.push(`${cssProp}: ${prop.value.value}`);
        continue;
      }
      // Numeric-literal value → splice as bare number (matches Svelte's
      // implicit `${n}px`-less serialization; for CSS custom properties the
      // value is a number-literal which is valid).
      if (t.isNumericLiteral(prop.value)) {
        parts.push(`${cssProp}: ${prop.value.value}`);
        continue;
      }
      // Dynamic value → Svelte template-literal interpolation in the
      // attribute string: `style="--btn-bg: {bgExpr}"`. Reuse the standard
      // template-expression rewriter (handles $props.X, $data.X, etc.).
      const exprCode = rewriteTemplateExpression(prop.value, ir);
      parts.push(`${cssProp}: {${exprCode}}`);
    }
    if (parts.length === 0) return 'style=""';
    return `style="${parts.join('; ')}"`;
  }

  const directives: string[] = [];
  for (const prop of attr.expression.properties) {
    // Bail on spreads / methods / computed keys — caller falls through to
    // the existing single-attribute passthrough.
    if (!t.isObjectProperty(prop)) return null;
    const keyName = objectPropertyKeyAsString(prop);
    if (keyName === null) return null;
    // ObjectProperty.value is PatternLike | Expression — for literal-object
    // attribute values we expect Expression. Pattern shapes (RestElement etc.)
    // would have been spreads, already rejected above; still defensive here.
    if (!t.isExpression(prop.value)) return null;
    const valueText = rewriteTemplateExpression(prop.value, ir);
    directives.push(`style:${kebabizeStyleKey(keyName)}={${valueText}}`);
  }

  // Empty object — `:style="{}"` — nothing to emit. Return empty string so
  // the caller treats this as "successfully lowered to nothing" rather than
  // falling through to a stale `style={ }` passthrough.
  return directives.join(' ');
}

/**
 * Phase 14 R6 — keys that must never reach the emitted object from an
 * author-controlled `r-bind` LITERAL. Mirrors the React/Solid/Vue
 * `FORBIDDEN_SPREAD_KEYS` set and the Phase 02 `collectPropDecls` guard
 * (T-14-06).
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
 * rest). The `class`/`style` keys are extracted so they can be fed into Svelte's
 * `class={[...]}` / `style={[...]}` merge paths; `rest` is the object with those
 * keys removed, ready for a `{...obj}` spread. Returns null entries when a key
 * is absent. T-14-06: `__proto__`/`constructor`/`prototype` keys are dropped
 * from the literal entirely.
 *
 * Operates on Svelte HTML attribute names verbatim — no key remap is applied
 * (D-03 is React/Solid-only; Svelte wants HTML names through).
 */
function splitClassStyleFromSvelteLiteral(obj: t.ObjectExpression): {
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
  const { classValue, styleValue } = splitClassStyleFromSvelteLiteral(
    attr.expression,
  );
  return { classValue, styleValue };
}

/**
 * Phase 14 R6 — Svelte opaque-spread class merge.
 *
 * Svelte 5's compiled output for `<el class={[...]} {...spread}>` is a single
 * props object `{ class: [...], ...spread }` — the spread is *last-wins* per
 * key, so a consumer-passed `class="extra-variant"` inside the spread silently
 * overwrites the wrapper's class array. For an OPAQUE spread (`$attrs` from
 * auto-fallthrough, or a dynamic `r-bind="obj"`) we cannot extract the spread's
 * `class` at compile time, so instead we append a read of the spread's `class`
 * to the tail of the explicit class array — Svelte's array-class syntax filters
 * falsy entries and joins truthy strings, so an absent consumer class is a
 * harmless `undefined`.
 *
 * Returns the source-level expression code to read `class` from at runtime, or
 * null for a LITERAL spread (handled by `extractLiteralClassStyleFromSpread`).
 *
 * `$attrs`             → `__rozieAttrs?.class`
 * Dynamic `r-bind`     → `(<rewritten expr>)?.class`
 * LITERAL `r-bind`     → null (literal class is extracted at compile time)
 */
function opaqueSpreadClassReadExpr(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
  ir: IRComponent,
): string | null {
  if (t.isObjectExpression(attr.expression)) return null;
  // `rewriteTemplateExpression` rewrites bare `$attrs` → `__rozieAttrs`, and
  // any other dynamic expression passes through with $data./$props. prefix
  // stripping applied. We always wrap in parens + `?.class` so the read is
  // null-safe whether the spread evaluates to undefined or an object.
  const exprCode = rewriteTemplateExpression(attr.expression, ir);
  return `(${exprCode})?.class`;
}

// NOTE on style: Svelte 5's compiled output places per-property `style:` directive
// state under a Symbol-keyed slot (STYLES_KEY) AFTER any spread inside the
// generated props object — i.e. `{ class: […], …spread, [STYLES_KEY]: { … } }`.
// This means an opaque spread's `style` key is already last-wins-overwritten by
// the per-property directives in our existing emit (see Spike 004 `:style`-as-
// directives lowering). No opaque-style merge is needed.

/**
 * Render interpolated segments as the inside of a JS template literal
 * (without the surrounding backticks). E.g.,
 *   [{static:'card '}, {binding: variant}] → 'card ${variant}'
 */
function renderInterpolatedTemplateLiteral(
  segments: Array<
    | { kind: 'static'; text: string }
    | { kind: 'binding'; expression: t.Expression; deps: unknown; wrapForDisplay?: boolean }
  >,
  ir: IRComponent,
  // Phase 26 — runtime-import accumulator so a wrapped class/attr interpolation
  // can register `rozieDisplay` (SPEC-4).
  runtimeImports?: Set<string>,
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
      // Phase 26 (D-06/SPEC-4) — wrap a non-primitive interpolated segment.
      const segCode = rewriteTemplateExpression(seg.expression, ir);
      if (seg.wrapForDisplay) {
        runtimeImports?.add('rozieDisplay');
        out += '${rozieDisplay(' + segCode + ')}';
      } else {
        out += '${' + segCode + '}';
      }
    }
  }
  return out;
}

/**
 * Phase 14 R2 / D-07 — render an `r-bind` spread for the Svelte target.
 * Svelte 5's native attribute-spread idiom is the `{...<obj>}` directive —
 * every own enumerable key of the object becomes an attribute on the host
 * element. No key normalization is applied: Svelte wants HTML attribute names
 * verbatim (D-03 is React/Solid-only).
 *
 * Per-target $attrs lowering: `rewriteTemplateExpression` rewrites a bare
 * `$attrs` Identifier → `$$restProps`, Svelte's native rest-attributes object
 * that captures every consumer-passed prop not destructured from `$props()`.
 * The rewrite is observable here via manual `r-bind="$attrs"` fixtures;
 * synthesis of the auto-fallthrough spread lands in Plan 14-05.
 *
 * KNOWN LIMITATION (RESEARCH Open Question 1 / Assumption A4 / Option a) — for
 * a DYNAMIC `r-bind` object the keys are NOT known at compile time, so a
 * `class`/`style` key inside a dynamic spread CANNOT be extracted into the
 * class/style merge path. Svelte's own `{...obj}` last-wins applies (a later
 * `{...obj}` overrides an earlier `class={...}` for the same key). The R6
 * acceptance fixture uses a LITERAL `r-bind`, so the literal path is the
 * mandatory one and is fully merge-correct.
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
    const { rest } = splitClassStyleFromSvelteLiteral(attr.expression);
    const expr = rewriteTemplateExpression(rest, ir);
    return `{...${expr}}`;
  }
  if (t.isObjectExpression(attr.expression)) {
    // LITERAL spread without an explicit class/style sibling — still apply the
    // T-14-06 pollution guard so a `__proto__`/`constructor`/`prototype`
    // literal key never reaches the emitted object.
    const { rest, classValue, styleValue } = splitClassStyleFromSvelteLiteral(
      attr.expression,
    );
    const restProps = [...rest.properties];
    if (classValue !== null) {
      restProps.push(t.objectProperty(t.identifier('class'), classValue));
    }
    if (styleValue !== null) {
      restProps.push(t.objectProperty(t.identifier('style'), styleValue));
    }
    const scrubbed = t.objectExpression(restProps);
    const expr = rewriteTemplateExpression(scrubbed, ir);
    return `{...${expr}}`;
  }
  // DYNAMIC spread or bare `$attrs` Identifier — pass through verbatim.
  // `rewriteTemplateExpression` rewrites `$attrs` → `$$restProps`.
  const expr = rewriteTemplateExpression(attr.expression, ir);
  return `{...${expr}}`;
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
  ctx: EmitAttrCtx,
): string | null {
  // r-html is handled at the element level, not as an attribute.
  if (attr.kind !== 'spreadBinding' && attr.name === 'r-html') return null;

  const ir = ctx.ir;

  // Phase 14 R2 / D-07 — bare-spread emit. The R6 class/style merge is handled
  // in `emitAttributes`; this single-attr fallback path is reached when no
  // explicit class/style sibling exists.
  if (attr.kind === 'spreadBinding') {
    return emitSpread(attr, ir, /* hasExplicitClassOrStyle */ false);
  }

  if (attr.kind === 'static') {
    // ref="<refName>" → bind:this={refName} (Svelte 5 idiom).
    if (attr.name === 'ref') {
      const refNames = new Set(ir.refs.map((r) => r.name));
      if (refNames.has(attr.value)) {
        return `bind:this={${attr.value}}`;
      }
    }
    const outName = resolveAttrName(attr.name, ctx);
    // Valueless boolean HTML attribute (`<input multiple>`) — emit the bare
    // attribute `multiple` (not `multiple=""`, a string Svelte's boolean prop
    // type rejects). Quick task 260520-w18 bug class 4.
    if (attr.value === '' && BOOLEAN_HTML_ATTRS.has(attr.name.toLowerCase())) {
      return outName;
    }
    return `${outName}="${escapeAttrValue(attr.value)}"`;
  }

  if (attr.kind === 'binding') {
    // r-model="<expr>" on form input → bind:value={<expr>}, EXCEPT a
    // `<input type="checkbox">` which requires Svelte's `bind:checked`
    // two-way primitive (`bind:value` silently no-ops on a checkbox — the
    // box renders unchecked and toggling never writes back). React, Vue,
    // Angular, Lit, and Solid already special-case checkbox; Svelte was the
    // only target still emitting `bind:value` unconditionally
    // (260519 linechart-watch-recreate step 5). Radio inputs (`bind:group`)
    // are out of scope — checkbox only.
    if (attr.name === 'r-model') {
      const expr = rewriteTemplateExpression(attr.expression, ir);
      // A `<input type="checkbox">` always uses `bind:checked` — the built-in
      // value modifiers (`.number`/`.trim`) need a string value access and
      // `.lazy`'s change-swap is meaningless for a checkbox (its `change` IS
      // the commit event). So a checkbox keeps pre-phase behaviour.
      if (ctx.inputType === 'checkbox') {
        return `bind:checked={${expr}}`;
      }
      // Phase 12 — the resolved `r-model` modifier chain. Svelte's `bind:value`
      // two-way sugar cannot carry a value coercion, so when ANY modifier is
      // present the emit drops to an explicit `value={…}` plus an event
      // handler. The handler event is `oninput` normally, `onchange` when
      // `.lazy` is in the chain (D-08). The Svelte 5 ATTRIBUTE form
      // (`oninput=`/`onchange=`) is used — NOT the deprecated `on:input`
      // directive — so the emit never mixes old + new event syntax with a
      // sibling `oninput` handler on the same element (Svelte 5 forbids
      // mixing; emitTemplateEvent.ts already emits the `on<event>=` form).
      // The handler body assigns the transformed value back — chaining each
      // `valueTransform` fragment in D-07 list order (the resolved list
      // arrives already canonicalized).
      const { valueTransforms, isLazy, hasAny } = partitionSvelteModelModifiers(
        attr.modifiers,
      );
      if (!hasAny) {
        // Bare `r-model` (no modifier) — `bind:value` byte-identical to
        // pre-phase.
        return `bind:value={${expr}}`;
      }
      const committedValue = applyValueTransformsString(
        '$event.currentTarget.value',
        valueTransforms,
      );
      const eventName = isLazy ? 'onchange' : 'oninput';
      return `value={${expr}} ${eventName}={($event) => ${expr} = ${committedValue}}`;
    }
    // Spike 004 (Svelte subset) — `:style="{ key: value, ... }"` lowers to
    // per-key `style:<kebab(key)>={value}` directives so Svelte 5 doesn't
    // serialize the object via toString() to `[object Object]`. Falls
    // through to the default attribute emit for non-literal-object exprs
    // (string form is handled natively by Svelte).
    const styleObjectLowered = tryEmitStyleObjectLiteral(attr, ir, ctx);
    if (styleObjectLowered !== null) return styleObjectLowered;
    const expr = rewriteTemplateExpression(attr.expression, ir);
    const outName = resolveAttrName(attr.name, ctx);
    // Phase 26 (D-06/SPEC-4) — attribute-binding wrap on an HTML host attribute
    // text position only. Component/self-tag prop bindings pass the value
    // structurally (no wrap), and `value`/`checked` on a form input are
    // controlled-input props (no wrap). A non-primitive value renders portable
    // JSON; raw otherwise (SPEC-3).
    // 260620-kby — a non-provably-string single `:class` binding (array/
    // identifier/member/call/conditional — `wrapForDisplay=true`, NOT an
    // object literal which Svelte handles natively) is normalized through
    // `rozieClass` so an array/object class value renders a valid space-joined
    // string instead of `String()`-ing it to `a,b`. `rozieClass(...)` stays the
    // DIRECT binding-site value (never a hoisted const) so Svelte 5 rune
    // reactivity re-reads it. This precedes the generic `rozieAttr` wrap below.
    if (
      attr.name === 'class' &&
      attr.wrapForDisplay &&
      !t.isObjectExpression(attr.expression) &&
      shouldWrapSvelteAttrBinding(attr.name, attr.expression, ctx)
    ) {
      ctx.runtimeImports?.add('rozieClass');
      return `${outName}={rozieClass(${expr})}`;
    }
    if (attr.wrapForDisplay && shouldWrapSvelteAttrBinding(attr.name, attr.expression, ctx)) {
      // 260608-sya — whole-value attribute binding (`attr.kind === 'binding'`):
      // route through `rozieAttr` so a nullish value DROPS the attribute
      // (returns `undefined` → Svelte 5 omits it) instead of rendering
      // `attr=""`, matching Vue's `:attr` semantics. `false` still stringifies
      // (preserves aria-/data- a11y). The interpolated single-segment branch
      // below stays on `rozieDisplay` — a null segment inside a composed string
      // is `''`, matching Vue interpolation-in-attr.
      ctx.runtimeImports?.add('rozieAttr');
      return `${outName}={rozieAttr(${expr})}`;
    }
    return `${outName}={${expr}}`;
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
    const seg = attr.segments[0]! as {
      kind: 'binding';
      expression: t.Expression;
      deps: unknown;
      wrapForDisplay?: boolean;
    };
    const outName = resolveAttrName(attr.name, ctx);
    const segCode = rewriteTemplateExpression(seg.expression, ir);
    // Phase 26 (D-06/SPEC-4) — wrap a non-primitive single-segment attribute
    // interpolation on an HTML host attribute text position only. Raw otherwise
    // (SPEC-3).
    if (seg.wrapForDisplay && shouldWrapSvelteAttrBinding(attr.name, seg.expression, ctx)) {
      ctx.runtimeImports?.add('rozieDisplay');
      return `${outName}={rozieDisplay(${segCode})}`;
    }
    return `${outName}={${segCode}}`;
  }

  // Multi-segment — render as Svelte template literal: `name={`...${...}...`}`.
  const lit = renderInterpolatedTemplateLiteral(attr.segments, ir, ctx.runtimeImports);
  const outName = resolveAttrName(attr.name, ctx);
  return `${outName}={\`${lit}\`}`;
}

/**
 * Convert a single AttributeBinding into a JS expression string suitable for
 * inclusion in an array (used by class/style merge below).
 */
function attrToArraySegment(
  attr: AttributeBinding,
  ir: IRComponent,
  runtimeImports?: Set<string>,
  // 260620-kby — true when this segment belongs to a `class` merge (vs a
  // `style` merge). Only a class member swaps the non-object wrap from
  // `rozieDisplay` to `rozieClass`; the style merge keeps `rozieDisplay`.
  isClass = false,
): string {
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
    const code = rewriteTemplateExpression(attr.expression, ir);
    // Phase 26 (D-06/SPEC-4) — wrap a non-primitive plain `:class` binding so a
    // class merge entry renders portable JSON instead of `[object Object]`.
    // EXCEPTION: an object-form `:class="{ active: x }"` is a clsx-style
    // class-condition object that Svelte's array-class syntax handles natively
    // — wrapping it would JSON-stringify the conditions and break the toggle.
    if (attr.wrapForDisplay && !t.isObjectExpression(attr.expression)) {
      // 260620-kby — a class merge member normalizes an array/object class
      // value through `rozieClass` (valid space-joined string) instead of
      // `rozieDisplay` (which JSON-stringified an array). The style merge keeps
      // `rozieDisplay`.
      if (isClass) {
        runtimeImports?.add('rozieClass');
        return `rozieClass(${code})`;
      }
      runtimeImports?.add('rozieDisplay');
      return `rozieDisplay(${code})`;
    }
    return code;
  }
  if (attr.kind === 'spreadBinding') {
    // Phase 14 — `spreadBinding` is the name-less kind: it never reaches a
    // class/style merge (it has no name to coalesce on). Unreachable; mirrors
    // the `twoWayBinding` guard above.
    throw new Error(
      `Svelte target: spreadBinding not valid in class/style array context (Phase 14).`,
    );
  }
  // interpolated
  if (attr.segments.length === 1 && attr.segments[0]!.kind === 'binding') {
    const seg = attr.segments[0]! as {
      kind: 'binding';
      expression: t.Expression;
      deps: unknown;
      wrapForDisplay?: boolean;
    };
    const code = rewriteTemplateExpression(seg.expression, ir);
    if (seg.wrapForDisplay) {
      runtimeImports?.add('rozieDisplay');
      return `rozieDisplay(${code})`;
    }
    return code;
  }
  return '`' + renderInterpolatedTemplateLiteral(attr.segments, ir, runtimeImports) + '`';
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

  // Spike 004 (Svelte subset) — a literal-object `:style="{...}"` lowers to
  // multiple `style:<kebab>={value}` directives, NOT a `style={...}` attribute.
  // Excluding it from the duplicate-name count below ensures the merge path
  // doesn't try to coalesce it with a sibling static-string `style=` (which
  // would re-introduce the `[object Object]` serialization path).
  const isLiteralStyleObjectBinding = (a: AttributeBinding): boolean =>
    a.kind === 'binding' &&
    a.name === 'style' &&
    t.isObjectExpression(a.expression);

  // Group by name to detect class/style merges. Phase 14 — `spreadBinding`
  // is the name-less kind: it never participates in class/style merging, so
  // it is excluded from the duplicate-name count.
  const counts = new Map<string, number>();
  for (const a of attrs) {
    if (a.kind === 'spreadBinding') continue;
    if (a.name === 'r-html') continue;
    if (isLiteralStyleObjectBinding(a)) continue;
    counts.set(a.name, (counts.get(a.name) ?? 0) + 1);
  }

  // Phase 14 R6 — does the element have an explicit `class`/`style` binding?
  // When so, a `class`/`style` key inside an `r-bind` LITERAL must be folded
  // into the class/style merge path (not spread as a separate `class={…}`,
  // which Svelte's `{...obj}` would last-wins-overwrite the explicit one).
  const hasExplicitClass = (counts.get('class') ?? 0) > 0;
  const hasExplicitStyle = (counts.get('style') ?? 0) > 0;

  // Phase 14 R6 — synthesise extra `class`/`style` AttributeBindings from any
  // `r-bind` LITERAL that carries those keys, so the merge path sees both the
  // explicit `class`/`style` and the literal's value as merge sources. The
  // synthetic bindings adopt the spread's source position so positional
  // last-wins is preserved (Pitfall 2).
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

  // Phase 14 R6 — OPAQUE-spread class merge (Round 3, ThemedButton fix). When
  // the host element carries BOTH an explicit `class` AND an OPAQUE spread
  // (`$attrs` from auto-fallthrough, or any non-literal `r-bind="<expr>"`),
  // Svelte 5's compiled props-object reorders to `{ class: […], …spread, … }`
  // — the spread is *last-wins* per key, so the consumer's `class="extra"`
  // silently overwrites the wrapper's class array. Compile-time class extraction
  // is impossible for an opaque spread (keys unknown), so we append a runtime
  // read of `(spread)?.class` to the tail of the explicit class array; Svelte's
  // array-class syntax filters falsy entries and joins truthy strings, so a
  // consumer who passed no class lands `undefined` (harmless).
  const opaqueSpreadClassReads: string[] = [];
  for (const a of attrs) {
    if (a.kind !== 'spreadBinding') continue;
    if (literalClassBindings.has(a)) continue; // LITERAL — class already extracted.
    const readExpr = opaqueSpreadClassReadExpr(a, ctx.ir);
    if (readExpr !== null) opaqueSpreadClassReads.push(readExpr);
  }
  const needsOpaqueSpreadClassMerge =
    hasExplicitClass && opaqueSpreadClassReads.length > 0;

  const out: string[] = [];
  const consumed = new WeakSet<AttributeBinding>();

  // Phase 14.1 — when an opaque spread sits alongside an explicit class
  // (or style) that needs merging, the explicit attribute MUST emit AFTER
  // the spread in source order. Svelte 5's compiled props object is built
  // left-to-right, so `class={[…]} {...spread}` produces
  // `{class:[…], …spread}` — and `…spread.class` (last key in the object
  // literal) silently overrides the array. Deferring the merged class/style
  // until after every other attribute emits inverts the compiled order to
  // `{…spread, class:[merged + (spread)?.class]}`, which lets the array win.
  // Mirrors the Solid R6 reorder shipped in round 3.
  const deferredMergedClassStyle: string[] = [];

  for (const a of attrs) {
    if (consumed.has(a)) continue;

    // Phase 14 R2 / D-07 — emit the name-less `spreadBinding` directly via
    // `emitSpread` (→ `{...<expr>}`). When a sibling explicit `class`/`style`
    // exists AND the spread is a LITERAL carrying that key, the literal's
    // value is folded into the class/style merge below; `emitSpread` drops
    // those keys from the spread's `rest`.
    if (a.kind === 'spreadBinding') {
      const dropClass = literalClassBindings.has(a);
      const dropStyle = literalStyleBindings.has(a);
      out.push(emitSpread(a, ctx.ir, dropClass || dropStyle));
      consumed.add(a);
      continue;
    }

    if (a.name === 'r-html') continue;

    if (a.name === 'class' || a.name === 'style') {
      const literalMap = a.name === 'class' ? literalClassBindings : literalStyleBindings;
      const hasOpaqueMerge =
        a.name === 'class' && needsOpaqueSpreadClassMerge;
      const totalCount = (counts.get(a.name) ?? 0) + literalMap.size;
      if (totalCount > 1 || hasOpaqueMerge) {
        // Walk the FULL attrs list in source order, picking out the
        // same-named bindings + any synthesised binding extracted from an
        // `r-bind` LITERAL at its source position. Preserves positional
        // last-wins between explicit `class`/`style` and the literal.
        const merged: AttributeBinding[] = [];
        for (const src of attrs) {
          if (src.kind === 'spreadBinding') {
            const synthetic = literalMap.get(src);
            if (synthetic) merged.push(synthetic);
          } else if (src.name === a.name && !isLiteralStyleObjectBinding(src)) {
            merged.push(src);
          }
        }
        for (const x of merged) consumed.add(x);
        const segments = merged.map((x) =>
          attrToArraySegment(x, ctx.ir, ctx.runtimeImports, a.name === 'class'),
        );
        // R6 opaque-spread class merge: append a `(spread)?.class` read for
        // every opaque spread to the array tail. Svelte's array-class syntax
        // filters falsy entries, so a consumer who passed no class contributes
        // a harmless `undefined`.
        if (hasOpaqueMerge) {
          for (const readExpr of opaqueSpreadClassReads) {
            segments.push(readExpr);
          }
        }
        // Phase 14.1 — defer the merged class output to AFTER every spread
        // so the compiled props-object lands as `{…spread, class:[…]}` and
        // the array (with the appended `(spread)?.class` read) wins. Without
        // this reorder the round-3 fix is no-op against an opaque spread.
        if (hasOpaqueMerge) {
          deferredMergedClassStyle.push(`${a.name}={[${segments.join(', ')}]}`);
        } else {
          out.push(`${a.name}={[${segments.join(', ')}]}`);
        }
        continue;
      }
    }

    const rendered = emitSingleAttr(a, ctx);
    if (rendered !== null) out.push(rendered);
    consumed.add(a);
  }

  out.push(...deferredMergedClassStyle);
  return out.join(' ');
}

/**
 * Phase 15 D-19 — bare `$listeners` Identifier predicate. Both the
 * auto-fallthrough push (lowerTemplate.ts `synthesizeListenersFallthrough`)
 * and an author-written `r-on="$listeners"` lower to a bare `$listeners`
 * Identifier; the emitter cannot (and need not) distinguish them. Mirrors
 * the Phase 14 `$attrs` D-04 exemption.
 */
function isListenersIdentifier(expr: t.Expression): boolean {
  return t.isIdentifier(expr, { name: '$listeners' });
}

/**
 * Phase 15 — emit a single `ListenerSpreadIR` for Svelte as a
 * `use:applyListeners={<expr>}` action invocation. Svelte 5 has NO Vue-3-
 * style `v-on="<obj>"` syntax — the only idiomatic way to attach a dynamic
 * key-keyed event-listener object to a node is a Svelte 5 action (D-11
 * lock). The action's `applyListeners` body provides the per-key
 * attach/detach lifecycle + FORBIDDEN_KEYS prototype-pollution guard
 * (T-15-V5-03) at runtime.
 *
 * The LITERAL path is NOT routed through this helper — literal-key spreads
 * are decomposed into synthetic `Listener` entries spliced into the events
 * list (so modifier-bearing keys like `'click.stop'` reuse Svelte's
 * existing `emitTemplateEvent.ts` modifier-pipeline emit; the per-element
 * walker's same-event grouping in `emitTemplateNode.ts::emitEvents` handles
 * R6 collision merge automatically).
 *
 * Two cases handled here:
 *
 *   - bare `$listeners` (D-19): emits `use:applyListeners={$listeners}` —
 *     the action still runs because Svelte has no object-form listener
 *     directive (the action provides the lifecycle); the consumer's
 *     $listeners object is passed UNWRAPPED, the action's per-instance
 *     FORBIDDEN_KEYS skip is the runtime guard.
 *
 *   - DYNAMIC expression: emits `use:applyListeners={<expr>}` — same shape.
 *
 * `runtimeImports` (when provided) collects the `'applyListeners'` runtime-
 * import marker so the SFC shell threads
 * `import { applyListeners } from '@rozie/runtime-svelte';`.
 */
export function emitListenerSpread(
  spread: ListenerSpreadIR,
  ctx: EmitAttrCtx,
  runtimeImports?: Set<string>,
): string {
  // Bare $listeners and dynamic expressions both lower to the same action-
  // invocation shape — Svelte has no native object-form listener directive.
  // The D-19 distinction is semantic, not syntactic; the
  // `rewriteTemplateExpression` for a bare `$listeners` Identifier passes
  // through unchanged (no $-prefix rewrite — `$listeners` is in the
  // STABLE_IDENTIFIERS set per Plan 15-01).
  if (runtimeImports !== undefined) {
    runtimeImports.add('applyListeners');
  }
  if (isListenersIdentifier(spread.expression)) {
    // D-19 — bare $listeners, passed unwrapped to the action (the consumer's
    // $listeners already carries lowercase target-native keys; A1 / Pitfall 8).
    const expr = rewriteTemplateExpression(spread.expression, ctx.ir);
    return `use:applyListeners={${expr}}`;
  }
  // Dynamic spread — the action handles per-key attach/detach + cleanup.
  const expr = rewriteTemplateExpression(spread.expression, ctx.ir);
  return `use:applyListeners={${expr}}`;
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
    // Phase 14 — `spreadBinding` is the name-less kind; skip before `.name`.
    if (a.kind === 'spreadBinding') continue;
    if (a.name !== 'r-html') continue;
    if (a.kind === 'binding') return { expression: a.expression };
  }
  return null;
}
