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
 * `aria-label` and `data-*` are NEVER passed through this helper because
 * callers gate on tagKind: 'component'|'self'. HTML element bindings keep
 * kebab-case verbatim.
 */
function kebabToCamel(name: string): string {
  if (!name.includes('-')) return name;
  return name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

/** Resolve the emitted attribute name given the host tag kind. */
function resolveAttrName(name: string, ctx: EmitAttrCtx): string {
  return ctx.elementTagKind === 'component' || ctx.elementTagKind === 'self'
    ? kebabToCamel(name)
    : name;
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
    current = fragment.split('$v').join(`(${current})`);
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
): string | null {
  if (attr.kind !== 'binding') return null;
  if (attr.name !== 'style') return null;
  if (!t.isObjectExpression(attr.expression)) return null;

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
  ctx: EmitAttrCtx,
): string | null {
  // r-html is handled at the element level, not as an attribute.
  if (attr.name === 'r-html') return null;

  const ir = ctx.ir;

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
    const styleObjectLowered = tryEmitStyleObjectLiteral(attr, ir);
    if (styleObjectLowered !== null) return styleObjectLowered;
    const expr = rewriteTemplateExpression(attr.expression, ir);
    const outName = resolveAttrName(attr.name, ctx);
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
    const seg = attr.segments[0]! as { kind: 'binding'; expression: t.Expression; deps: unknown };
    const outName = resolveAttrName(attr.name, ctx);
    return `${outName}={${rewriteTemplateExpression(seg.expression, ir)}}`;
  }

  // Multi-segment — render as Svelte template literal: `name={`...${...}...`}`.
  const lit = renderInterpolatedTemplateLiteral(attr.segments, ir);
  const outName = resolveAttrName(attr.name, ctx);
  return `${outName}={\`${lit}\`}`;
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

  // Spike 004 (Svelte subset) — a literal-object `:style="{...}"` lowers to
  // multiple `style:<kebab>={value}` directives, NOT a `style={...}` attribute.
  // Excluding it from the duplicate-name count below ensures the merge path
  // doesn't try to coalesce it with a sibling static-string `style=` (which
  // would re-introduce the `[object Object]` serialization path).
  const isLiteralStyleObjectBinding = (a: AttributeBinding): boolean =>
    a.kind === 'binding' &&
    a.name === 'style' &&
    t.isObjectExpression(a.expression);

  // Group by name to detect class/style merges.
  const counts = new Map<string, number>();
  for (const a of attrs) {
    if (a.name === 'r-html') continue;
    if (isLiteralStyleObjectBinding(a)) continue;
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

    const rendered = emitSingleAttr(a, ctx);
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
