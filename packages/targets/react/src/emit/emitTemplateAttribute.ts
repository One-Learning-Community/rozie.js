/**
 * emitTemplateAttribute — Plan 04-03 Task 1 (React target).
 *
 * Renders an element's AttributeBinding[] as JSX-attribute strings.
 * Implements:
 *
 *   - D-55 — `class=` rewrites to `className=` (React idiom)
 *   - D-53 — single static class → `className={styles.X}` (CSS Module lookup)
 *   - D-54 — multi-static class → backtick template literal with styles[X] lookups
 *   - D-37 — mustache-in-attribute → backtick template literal with bracket lookups
 *   - Pitfall 7 carryover — class + :class on same element merge into one className
 *   - Object-form `:class="{ active: x }"` → `className={clsx({ [styles.active]: x })}`
 *     (auto-imports clsx from @rozie/runtime-react)
 *   - Pure-binding `:class="someExpr"` → `className={someExpr}` (NO styles lookup,
 *     NO clsx — emitted as-is for v1)
 *   - kebab-case `:prop` → camelCase JSX attribute
 *   - r-* directives (r-if/r-else/r-else-if/r-for/r-show/r-html/r-text/r-model)
 *     are CONSUMED by emitTemplateElement, NOT emitted as attributes
 *   - @event attributes are CONSUMED by emitTemplateEvent, NOT emitted here
 *
 * Per RESEARCH Pattern 6 lines 699-718 (className composition cases).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import postcss from 'postcss';
import type {
  IRComponent,
  AttributeBinding,
  RefDecl,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { resolveTwoWayTarget } from './resolveTwoWayTarget.js';

// CJS interop normalization.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

function flattenInlineCode(code: string): string {
  return code.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

export interface EmitAttrCtx {
  ir: IRComponent;
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector };
}

/**
 * Whether the component has a scoped <style> block. When false, `styles` is
 * not imported in the .tsx output and class tokens must be emitted as plain
 * string literals (not `styles.X` lookups, which would be runtime ReferenceErrors).
 */
function hasModuleCss(ir: IRComponent): boolean {
  return (ir.styles?.scopedRules?.length ?? 0) > 0;
}

/**
 * Names that are CONSUMED upstream and never emitted as JSX attributes:
 *   - r-* control-flow directives (consumed by emitTemplateElement / emitConditional / emitLoop)
 *   - r-html / r-show / r-text / r-model (consumed by emitTemplateElement special-cases)
 *   - @event* (consumed by emitTemplateEvent)
 *   - :key (consumed by emitTemplateLoop's key= injection)
 */
function isConsumedAttribute(name: string): boolean {
  if (name.startsWith('@')) return true;
  if (name === 'r-if' || name === 'r-else-if' || name === 'r-else') return true;
  if (name === 'r-for' || name === 'r-show' || name === 'r-html' || name === 'r-text') return true;
  if (name === 'r-model') return true;
  if (name === 'key' || name === ':key') return true;
  return false;
}

/**
 * Map of HTML attribute names that React expects in non-standard casing.
 * Covers the long-tail of DOM attrs whose JSX prop name does NOT match the
 * lowercased HTML name 1:1 (React has historically followed JS DOM property
 * naming for these). Aria-* and data-* attributes are preserved hyphenated
 * and not listed here.
 */
const HTML_TO_JSX_ATTR: Readonly<Record<string, string>> = {
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  for: 'htmlFor',
  class: 'className',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  autofocus: 'autoFocus',
  autocomplete: 'autoComplete',
  autocapitalize: 'autoCapitalize',
  inputmode: 'inputMode',
  enterkeyhint: 'enterKeyHint',
  formaction: 'formAction',
  formenctype: 'formEnctype',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  novalidate: 'noValidate',
  crossorigin: 'crossOrigin',
  referrerpolicy: 'referrerPolicy',
  srcset: 'srcSet',
  usemap: 'useMap',
  rowspan: 'rowSpan',
  colspan: 'colSpan',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  frameborder: 'frameBorder',
  marginheight: 'marginHeight',
  marginwidth: 'marginWidth',
  allowfullscreen: 'allowFullScreen',
  acceptcharset: 'acceptCharset',
  itemprop: 'itemProp',
  itemscope: 'itemScope',
  itemtype: 'itemType',
  itemid: 'itemID',
  itemref: 'itemRef',
  hreflang: 'hrefLang',
  longdesc: 'longDesc',
  datetime: 'dateTime',
  defaultchecked: 'defaultChecked',
  defaultvalue: 'defaultValue',
};

/**
 * HTML attribute names whose value should be coerced to a JSX numeric
 * expression rather than a string literal. e.g., `tabindex="-1"` → `tabIndex={-1}`.
 */
const NUMERIC_HTML_ATTRS: ReadonlySet<string> = new Set([
  'tabindex',
  'maxlength',
  'minlength',
  'rowspan',
  'colspan',
  'size',
  'cols',
  'rows',
  'span',
  'start',
]);

/**
 * HTML attributes whose JSX prop type is `boolean`. A valueless boolean
 * attribute in `.rozie` source (`<input multiple>`) arrives at the static
 * emit branch with `attr.value === ''` — emitting `multiple=""` (a string)
 * fails React's `boolean`-typed JSX prop (TS2322 `'string'` vs `'boolean'`).
 * Quick task 260520-w18 bug class 4 — emit the JSX boolean form `multiple={true}`.
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
 * Translate a bare DOM attribute name (lowercased) to its React JSX prop
 * name. For non-mapped names, returns the input unchanged.
 */
function htmlAttrToJsxName(name: string): string {
  const lower = name.toLowerCase();
  return HTML_TO_JSX_ATTR[lower] ?? name;
}

/**
 * kebab-case to camelCase for JSX prop name conversion.
 *   'aria-label' → 'aria-label' (preserved — JSX accepts hyphenated DOM aria/data attrs)
 *   'on-something' → not encountered (handled by emitTemplateEvent)
 *   ':my-prop' → 'myProp' (custom-component prop)
 *
 * For DOM elements, hyphenated `aria-*` and `data-*` are preserved. For
 * everything else, the colon-prefixed form is converted to camelCase.
 * Then the HTML→JSX attribute alias map is applied for special-cased names.
 */
function colonPropToJsxName(name: string): string {
  // strip the leading ':' if present
  const bare = name.startsWith(':') ? name.slice(1) : name;
  // Preserve aria-/data- hyphenated form
  if (bare.startsWith('aria-') || bare.startsWith('data-')) return bare;
  // Convert kebab to camel
  let out = bare;
  if (out.includes('-')) {
    out = out.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  }
  // Apply HTML→JSX special-case alias (tabindex → tabIndex, etc.).
  return htmlAttrToJsxName(out);
}

/**
 * Minimal HTML attribute-value escape for static attribute literals.
 * JSX accepts string literals in the same shape as HTML. We escape `"` and
 * backslashes; other characters pass through.
 */
function escapeJsxAttrLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Render a Babel Expression for embedding inside a JSX expression container.
 * Same as rewriteTemplateExpression but the caller decides on the wrapping.
 */
function renderExpr(
  expr: t.Expression,
  ir: IRComponent,
): string {
  return rewriteTemplateExpression(expr, ir);
}

/**
 * Quick task 260520-w18 — `:attr` binding `null`-fallback normalization.
 *
 * A `.rozie` author writes the Vue idiom `:accept="x ? x.join(',') : null"`,
 * where `null` means "remove the attribute". React's optional HTML-attribute
 * JSX props are typed `string | undefined` (NOT `string | null`), so a
 * `null`-yielding ternary branch is a TS2322. React treats `undefined`
 * identically to `null` at runtime ("attribute absent"), so translating a
 * branch-position `null` literal to `undefined` is the faithful cross-target
 * mapping. Returns a cloned expression with branch-position `NullLiteral`
 * nodes replaced — the IR node is never mutated.
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
 * Detect whether an expression's source-text is an object-literal expression
 * (e.g., `{ active: isActive }`). Used to route :class={...} to the
 * `clsx({...})` form per RESEARCH Pattern 6 line 713.
 */
function isObjectLiteralExpression(expr: t.Expression): boolean {
  return t.isObjectExpression(expr);
}

/**
 * Phase 14 D-04 — the magic accessor whose `r-bind` spread is EXEMPT from key
 * normalization. A `$attrs` cluster already carries target-native keys (the
 * consumer wrote `className`, not `class`), so it is spread verbatim.
 */
function isAttrsIdentifier(expr: t.Expression): boolean {
  return t.isIdentifier(expr, { name: '$attrs' });
}

/**
 * Phase 14 SECURITY (T-14-06) — keys that must never reach the emitted object
 * from an author-controlled `r-bind` literal. Mirrors the runtime
 * `normalizeAttrs` `FORBIDDEN_KEYS` set and the Phase 02 `collectPropDecls`
 * guard.
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
 * Phase 14 D-03 — compile-time key remap of an `r-bind` LITERAL object for the
 * React target. Returns a NEW ObjectExpression (the IR node is never mutated)
 * with HTML-shape keys renamed to React-DOM naming (`class`→`className`, …) and
 * `__proto__`/`constructor`/`prototype` keys SKIPPED (T-14-06). Spread / method
 * / computed-key properties pass through verbatim — only statically-named
 * data properties are remappable.
 */
function remapObjectKeysReact(obj: t.ObjectExpression): t.ObjectExpression {
  const cloned = t.cloneNode(obj, true, false) as t.ObjectExpression;
  const kept: t.ObjectExpression['properties'] = [];
  for (const prop of cloned.properties) {
    if (!t.isObjectProperty(prop)) {
      // SpreadElement / ObjectMethod — pass through; not key-remappable.
      kept.push(prop);
      continue;
    }
    const keyName = staticPropKey(prop);
    if (keyName !== null && FORBIDDEN_SPREAD_KEYS.has(keyName)) {
      // SECURITY (T-14-06) — drop a pollution-vector literal key entirely.
      continue;
    }
    if (keyName !== null) {
      const mapped = htmlAttrToJsxName(keyName);
      if (mapped !== keyName) {
        prop.key = t.identifier(mapped);
        prop.computed = false;
      }
    }
    kept.push(prop);
  }
  cloned.properties = kept;
  return cloned;
}

/**
 * Phase 14 R6 — split an `r-bind` LITERAL into (class-value, style-value, rest).
 * The `class`/`style` keys are extracted so they can be fed into the existing
 * multi-source class/style merge paths; `rest` is the object with those keys
 * removed, ready for a `{...rest}` spread. Returns null entries when a key is
 * absent. Operates on the ALREADY-REMAPPED object (key is `className`/`style`).
 */
function splitClassStyleFromLiteral(obj: t.ObjectExpression): {
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
      if (keyName === 'className' && t.isExpression(prop.value)) {
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
 * Render an object-literal expression's properties as a clsx-compatible
 * object expression that maps `styles.X` for known CSS module class keys.
 *
 *   { hovering: $data.hovering }  →  { [styles.hovering]: hovering }
 *   { 'foo-bar': x }              →  { [styles['foo-bar']]: x }
 */
function renderObjectFormForClsx(
  expr: t.ObjectExpression,
  ir: IRComponent,
): string {
  const propStrings: string[] = [];
  for (const prop of expr.properties) {
    if (!t.isObjectProperty(prop)) {
      // Spread / method properties — passthrough as-is via generator.
      const code = generate(prop, GEN_OPTS).code;
      propStrings.push(flattenInlineCode(code));
      continue;
    }
    // Get the key name as a string.
    let keyText: string;
    if (t.isIdentifier(prop.key) && !prop.computed) {
      keyText = prop.key.name;
    } else if (t.isStringLiteral(prop.key)) {
      keyText = prop.key.value;
    } else {
      // Fall back to generator output if we don't recognise the key.
      const code = generate(prop, GEN_OPTS).code;
      propStrings.push(flattenInlineCode(code));
      continue;
    }

    // Render the value via rewriteTemplateExpression.
    if (!t.isExpression(prop.value)) {
      const code = generate(prop, GEN_OPTS).code;
      propStrings.push(flattenInlineCode(code));
      continue;
    }
    const valueText = renderExpr(prop.value, ir);

    // When a scoped <style> block exists, use computed-key form
    // `[styles.<key>]: value`. For keys with hyphens, bracket-quote:
    // `[styles['key-name']]`. When no scoped block exists, emit the
    // plain key (quoted if non-identifier) without a styles lookup.
    if (!hasModuleCss(ir)) {
      const keyOut = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(keyText)
        ? keyText
        : JSON.stringify(keyText);
      propStrings.push(`${keyOut}: ${valueText}`);
    } else {
      const stylesLookup = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(keyText)
        ? `styles.${keyText}`
        : `styles[${JSON.stringify(keyText)}]`;
      propStrings.push(`[${stylesLookup}]: ${valueText}`);
    }
  }
  return `{ ${propStrings.join(', ')} }`;
}

/**
 * Render a value as `styles.X` lookup (single static class) or as a
 * template literal segment for multi-static / interpolated classes.
 */
function renderStaticClassLookup(className: string, ir: IRComponent): string {
  // No scoped <style> block → emit plain string literal (no `styles` symbol in scope).
  if (!hasModuleCss(ir)) {
    return JSON.stringify(className);
  }
  // Identifier-safe class name → `styles.X`; else bracket-quote.
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(className)) {
    return `styles.${className}`;
  }
  return `styles[${JSON.stringify(className)}]`;
}

/**
 * Compose a className value for a class-bucket of attributes (one or more
 * sources, kinds: static / binding / interpolated).
 *
 * Returns the JSX expression contents WITHOUT surrounding `{...}` braces;
 * caller wraps as `className={...}`.
 *
 * Cases (per RESEARCH Pattern 6 lines 699-718):
 *   - 1 static, 1 token   → styles.X
 *   - 1 static, N tokens  → `${styles.X} ${styles.Y}`
 *   - 1 binding (object)  → clsx({ [styles.X]: cond, ... })
 *   - 1 binding (other)   → expr (passthrough; no styles lookup)
 *   - 1 interpolated      → backtick template literal w/ bracket lookup
 *   - mixed (static + bind/etc.) → clsx(...)
 */
function composeClassName(
  attrs: AttributeBinding[],
  ctx: EmitAttrCtx,
): string {
  const ir = ctx.ir;

  // Inline interpolated-segment shape (matches AttributeBinding's
  // 'interpolated' kind body without recreating the discriminator).
  type InterpolatedSeg =
    | { kind: 'static'; text: string }
    | { kind: 'binding'; expression: t.Expression; deps: unknown };

  // Categorize each attribute
  const segments: Array<
    | { kind: 'staticTokens'; tokens: string[] }
    | { kind: 'objectBinding'; expr: t.ObjectExpression }
    | { kind: 'plainBinding'; expr: t.Expression }
    | { kind: 'interpolated'; segments: InterpolatedSeg[] }
  > = [];

  for (const a of attrs) {
    if (a.kind === 'twoWayBinding') {
      // Phase 07.3 Wave 3 stub — twoWayBinding never appears in a class merge.
      throw new Error(
        `React target: twoWayBinding not valid in class array context (Phase 07.3 Wave 3 Plan 07.3-06).`,
      );
    } else if (a.kind === 'static') {
      const tokens = a.value.split(/\s+/).filter(Boolean);
      segments.push({ kind: 'staticTokens', tokens });
    } else if (a.kind === 'binding') {
      if (isObjectLiteralExpression(a.expression)) {
        segments.push({ kind: 'objectBinding', expr: a.expression as t.ObjectExpression });
      } else {
        segments.push({ kind: 'plainBinding', expr: a.expression });
      }
    } else if (a.kind === 'spreadBinding') {
      // Phase 14 — `spreadBinding` is the name-less kind: `bucket()` skips it
      // so it never reaches a `class` merge. Unreachable; mirrors the
      // `twoWayBinding` guard above.
      throw new Error(
        `React target: spreadBinding not valid in class array context (Phase 14).`,
      );
    } else {
      // interpolated
      segments.push({ kind: 'interpolated', segments: a.segments as InterpolatedSeg[] });
    }
  }

  // CASE A: Single static segment
  if (segments.length === 1 && segments[0]!.kind === 'staticTokens') {
    const seg = segments[0]! as { kind: 'staticTokens'; tokens: string[] };
    if (seg.tokens.length === 0) return '""';
    if (seg.tokens.length === 1) {
      return renderStaticClassLookup(seg.tokens[0]!, ir);
    }
    // No styles → emit as a single quoted string literal.
    if (!hasModuleCss(ir)) {
      return JSON.stringify(seg.tokens.join(' '));
    }
    // Multi static → backtick template literal
    const parts = seg.tokens.map((tok) => '${' + renderStaticClassLookup(tok, ir) + '}').join(' ');
    return '`' + parts + '`';
  }

  // CASE B: Single object-form binding
  if (segments.length === 1 && segments[0]!.kind === 'objectBinding') {
    ctx.collectors.runtime.add('clsx');
    const objExpr = (segments[0]! as { kind: 'objectBinding'; expr: t.ObjectExpression }).expr;
    return `clsx(${renderObjectFormForClsx(objExpr, ir)})`;
  }

  // CASE C: Single plain binding (e.g., :class="someComputed")
  if (segments.length === 1 && segments[0]!.kind === 'plainBinding') {
    const seg = segments[0]! as { kind: 'plainBinding'; expr: t.Expression };
    // A plain-binding `:class` whose expression is a statically-shaped string
    // — a string literal or a template literal — IS tokenisable at compile
    // time, so route each class token through the CSS-Modules `styles` lookup.
    // Without this, `:class="`badge badge-${x}`"` emits the verbatim literal
    // `className={`badge badge-${x}`}`, which never matches the hashed
    // `._badge_<hash>` selector in the sibling `.module.css` — the consumer
    // styling is silently dropped. (React is the only target affected: it
    // hashes class NAMES via CSS Modules; Vue/Svelte/Angular/Solid/Lit use
    // attribute-scoping, which preserves literal class names so a dynamic
    // class string just works.) Non-decomposable expressions (identifiers,
    // calls, members) still pass through as-is — a documented v1 limitation.
    const staticSegs = decomposeStaticClassExpr(seg.expr);
    if (staticSegs) {
      return renderInterpolatedClass(staticSegs, ir);
    }
    return renderExpr(seg.expr, ir);
  }

  // CASE D: Single interpolated (mustache-in-attribute)
  if (segments.length === 1 && segments[0]!.kind === 'interpolated') {
    const seg = segments[0]! as {
      kind: 'interpolated';
      segments: Array<
        | { kind: 'static'; text: string }
        | { kind: 'binding'; expression: t.Expression; deps: unknown }
      >;
    };
    return renderInterpolatedClass(seg.segments, ir);
  }

  // CASE E: Multi-source (mixed) — use clsx aggregator
  ctx.collectors.runtime.add('clsx');
  const clsxArgs: string[] = [];
  for (const s of segments) {
    if (s.kind === 'staticTokens') {
      // Each static token becomes a styles.X arg (or a string literal when no <style>).
      for (const tok of s.tokens) {
        clsxArgs.push(renderStaticClassLookup(tok, ir));
      }
    } else if (s.kind === 'objectBinding') {
      clsxArgs.push(renderObjectFormForClsx(s.expr, ir));
    } else if (s.kind === 'plainBinding') {
      clsxArgs.push(renderExpr(s.expr, ir));
    } else {
      // interpolated → render as a backtick template literal
      const interpSegs = (s as unknown as {
        segments: Array<
          | { kind: 'static'; text: string }
          | { kind: 'binding'; expression: t.Expression; deps: unknown }
        >;
      }).segments;
      clsxArgs.push(renderInterpolatedClass(interpSegs, ir));
    }
  }
  return `clsx(${clsxArgs.join(', ')})`;
}

/**
 * Decompose a statically-shaped class expression — a string literal or a
 * template literal — into the `{ static | binding }` segment stream consumed
 * by `renderInterpolatedClass`. This lets a plain-binding `:class` whose
 * value is a template literal (e.g. `` `badge badge-${value}` ``) route its
 * class tokens through the CSS-Modules `styles` lookup, identically to a
 * `{{ }}`-interpolated `class` attribute.
 *
 * Returns null for any other expression shape (identifier, member, call, …)
 * which cannot be statically tokenised — those keep the as-is passthrough.
 */
function decomposeStaticClassExpr(
  expr: t.Expression,
):
  | Array<
      | { kind: 'static'; text: string }
      | { kind: 'binding'; expression: t.Expression; deps: unknown }
    >
  | null {
  if (t.isStringLiteral(expr)) {
    return [{ kind: 'static', text: expr.value }];
  }
  if (t.isTemplateLiteral(expr)) {
    const segs: Array<
      | { kind: 'static'; text: string }
      | { kind: 'binding'; expression: t.Expression; deps: unknown }
    > = [];
    // A TemplateLiteral interleaves `quasis` (n+1 static chunks) and
    // `expressions` (n interpolations): quasi[0] expr[0] quasi[1] … quasi[n].
    for (let i = 0; i < expr.quasis.length; i++) {
      const cooked = expr.quasis[i]!.value.cooked ?? expr.quasis[i]!.value.raw;
      if (cooked.length > 0) segs.push({ kind: 'static', text: cooked });
      const e = expr.expressions[i];
      if (e && t.isExpression(e)) {
        segs.push({ kind: 'binding', expression: e, deps: undefined });
      }
    }
    return segs;
  }
  return null;
}

/**
 * Render an interpolated attribute's segments for a class attribute. Static
 * text is split on whitespace and each token becomes a styles[token] lookup;
 * binding segments interpolate as `styles[<expr>]` IF the surrounding static
 * text indicates a class-name context (e.g., `card--{{variant}}` becomes
 * `styles[\`card--\${variant}\`]`).
 *
 * For the v1 simple case we render the entire segment list as a backtick
 * template literal where each non-bound static token is wrapped in
 * `${styles.X}` and each bound segment is interpolated as a bracket lookup
 * if it appears as part of a class-name token, else inlined.
 *
 * Strategy: split static segments on whitespace; for each token, if it
 * contains a `${...}` placeholder (i.e., the token spans static + binding
 * segments), render the FULL token as `styles[\`<token-template>\`]`;
 * otherwise render as `styles.X`.
 */
function renderInterpolatedClass(
  segments: Array<
    | { kind: 'static'; text: string }
    | { kind: 'binding'; expression: t.Expression; deps: unknown }
  >,
  ir: IRComponent,
): string {
  // Build a token-stream where each token is either:
  //   { kind: 'static'; text: string }                  // a complete class token
  //   { kind: 'composite'; parts: Array<...> }          // a token spanning binding+static
  //
  // Walk the segments left-to-right, splitting static text on whitespace and
  // accumulating composite tokens that contain a binding segment.
  type Part = { kind: 'static'; text: string } | { kind: 'binding'; code: string };
  type Token = { parts: Part[] };

  const tokens: Token[] = [];
  let current: Token | null = null;

  function pushTextRun(text: string) {
    // Split on whitespace; runs of whitespace separate tokens.
    const re = /(\S+)|\s+/g;
    let m: RegExpExecArray | null = re.exec(text);
    while (m !== null) {
      if (m[0].trim().length === 0) {
        // whitespace boundary — close current token
        if (current && current.parts.length > 0) {
          tokens.push(current);
          current = null;
        }
      } else {
        if (!current) current = { parts: [] };
        current.parts.push({ kind: 'static', text: m[1]! });
      }
      m = re.exec(text);
    }
  }

  for (const seg of segments) {
    if (seg.kind === 'static') {
      pushTextRun(seg.text);
    } else {
      const code = renderExpr(seg.expression, ir);
      if (!current) current = { parts: [] };
      current.parts.push({ kind: 'binding', code });
    }
  }
  if (current && current.parts.length > 0) tokens.push(current);

  if (tokens.length === 0) return '""';

  const noStyles = !hasModuleCss(ir);

  // Build template-literal-friendly representations
  const renderedTokens = tokens.map((tok) => {
    // Pure-static token → styles.X lookup (or plain text when no <style>).
    if (tok.parts.length === 1 && tok.parts[0]!.kind === 'static') {
      return '${' + renderStaticClassLookup(tok.parts[0]!.text, ir) + '}';
    }
    // Composite token (mix of static + binding).
    const inner = tok.parts
      .map((p) => {
        if (p.kind === 'static') {
          // Backtick-escape: \, `, and ${
          return p.text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
        }
        return '${' + p.code + '}';
      })
      .join('');
    // No <style> → emit the composite token as a plain backtick segment.
    return noStyles ? inner : '${styles[`' + inner + '`]}';
  });

  // Join tokens with single spaces
  return '`' + renderedTokens.join(' ') + '`';
}

/**
 * Group attributes by name, returning a Map for lookup.
 *
 * Phase 14 — `spreadBinding` is the name-less `AttributeBinding` kind (D-07):
 * it binds an open-ended object, not a single named attribute, so it never
 * participates in class name-bucketing and is skipped here. `emitAttributes`
 * emits it directly as a JSX spread (`{...<expr>}`).
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
 * Determine the React DOM event-handler arg shape based on the ref's element
 * tag. Used for `ref={X}` in JSX.
 */
function inferRefDomType(refName: string, refs: RefDecl[]): string {
  const r = refs.find((x) => x.name === refName);
  if (!r) return 'HTMLElement';
  switch (r.elementTag.toLowerCase()) {
    case 'input':
      return 'HTMLInputElement';
    case 'textarea':
      return 'HTMLTextAreaElement';
    case 'select':
      return 'HTMLSelectElement';
    case 'button':
      return 'HTMLButtonElement';
    case 'form':
      return 'HTMLFormElement';
    case 'div':
      return 'HTMLDivElement';
  }
  return 'HTMLElement';
}

/**
 * Convert a kebab-case CSS property name to a React style-object key.
 * Mirrors `@rozie/runtime-react`'s `toStyleObjectKey` — kept as a small
 * self-contained emitter local (per the emitter's self-contained style;
 * no shared home for a ~10-line converter).
 *
 *   background-color  →  backgroundColor
 *   -webkit-mask      →  WebkitMask
 *   --custom-prop     →  --custom-prop  (CSS custom properties pass through)
 */
function cssPropToStyleKey(prop: string): string {
  if (prop.startsWith('--')) return prop;
  if (prop.startsWith('-')) {
    const stripped = prop.slice(1);
    const camel = stripped.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Lower a string-LITERAL `style` value at compile time. PostCSS-parses the
 * declaration list and renders a JSX object-expression — byte-identical in
 * shape to object-form `:style`. When a declaration carries `!important`,
 * a ROZ083 WARN is collected (React's object form silently drops it).
 *
 * Called from BOTH the `:style="'literal'"` binding path and the bare
 * `style="literal"` static-attribute path — React requires `style` to be an
 * object at runtime; a bare string-literal `style` attribute that survives
 * to JSX throws "Style prop value must be an object" and unmounts the
 * subtree (Phase 14-06 cross-target divergence: ThemedButtonConsumer's
 * `style="--btn-bg: #ef4444"`).
 *
 * Spike 004 locked decision #8: v1 is syntactic-parse only — a malformed
 * style string surfaces as a ROZ080 diagnostic (caught here, never a raw
 * PostCSS throw); no CSS property-name validation.
 */
function lowerStringLiteralStyle(
  sourceLoc: AttributeBinding['sourceLoc'],
  literal: string,
): { jsx: string; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const props: string[] = [];
  let root: ReturnType<typeof postcss.parse>;
  try {
    root = postcss.parse(literal);
  } catch (err) {
    // Malformed inline-style literal (e.g. an unclosed `url(` or stray brace).
    // Surface a ROZ080 rather than letting the raw PostCSS exception abort the
    // whole compile; fall back to an empty style object so the emitted
    // component still type-checks.
    diagnostics.push({
      code: RozieErrorCode.STYLE_PARSE_ERROR,
      severity: 'error',
      message:
        `Could not parse inline \`style\` string ${JSON.stringify(literal)}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      loc: sourceLoc,
    });
    return { jsx: 'style={{}}', diagnostics };
  }
  root.walkDecls((decl) => {
    const key = cssPropToStyleKey(decl.prop);
    const keyOut = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    if (decl.important) {
      diagnostics.push({
        code: RozieErrorCode.STYLE_IMPORTANT_DROPPED_IN_STYLE_OBJECT,
        severity: 'warning',
        message:
          `\`!important\` on \`${decl.prop}\` is dropped by React's style-object form. ` +
          `React silently ignores \`!important\` in inline style objects.`,
        loc: sourceLoc,
      });
    }
    props.push(`${keyOut}: ${JSON.stringify(decl.value)}`);
  });
  const objBody = props.length > 0 ? `{ ${props.join(', ')} }` : '{}';
  return { jsx: `style={${objBody}}`, diagnostics };
}

/**
 * Emit a single non-class attribute as a JSX attribute pair.
 * Returns the rendered attribute string (e.g., `onClick={handler}`).
 */
function emitNonClassAttribute(
  attr: AttributeBinding,
  ctx: EmitAttrCtx,
): { jsx: string; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  // ref="name" — special-case → `ref={name}`
  if (attr.kind === 'static' && attr.name === 'ref') {
    const refNames = new Set(ctx.ir.refs.map((r) => r.name));
    if (refNames.has(attr.value)) {
      // The ref local is the same name (Plan 04-02 emitScript declares `const X = useRef<...>`).
      void inferRefDomType; // (type is already in the useRef declaration)
      return { jsx: `ref={${attr.value}}`, diagnostics };
    }
    // Unknown ref — pass through as a plain string attribute (rare).
  }

  // 'class' static → 'className' static
  if (attr.kind === 'static' && attr.name === 'class') {
    return { jsx: `className="${escapeJsxAttrLiteral(attr.value)}"`, diagnostics };
  }
  // bare `style="k1: v1; k2: v2"` static → object form. React requires `style`
  // to be an object at runtime; a string-literal `style` JSX prop throws
  // "Style prop value must be an object" and unmounts the subtree (Phase
  // 14-06 ThemedButtonConsumer divergence). Mirror the `:style="'literal'"`
  // binding-path lowering so a static and bound string literal emit identically.
  if (attr.kind === 'static' && attr.name === 'style') {
    return lowerStringLiteralStyle(attr.sourceLoc, attr.value);
  }
  if (attr.kind === 'static') {
    // Apply HTML→JSX alias for special-cased names (tabindex → tabIndex, etc.)
    const jsxName = htmlAttrToJsxName(attr.name);
    // Valueless boolean HTML attribute (`<input multiple>`) — emit the JSX
    // boolean form `multiple={true}` (not `multiple=""`, which is a string
    // and fails React's boolean-typed JSX prop, TS2322). Quick task
    // 260520-w18 bug class 4.
    if (attr.value === '' && BOOLEAN_HTML_ATTRS.has(attr.name.toLowerCase())) {
      return { jsx: `${jsxName}={true}`, diagnostics };
    }
    // Coerce known-numeric DOM attrs to JSX expression form: tabindex="-1" → tabIndex={-1}
    if (NUMERIC_HTML_ATTRS.has(attr.name.toLowerCase()) && /^-?\d+(?:\.\d+)?$/.test(attr.value)) {
      return { jsx: `${jsxName}={${attr.value}}`, diagnostics };
    }
    return { jsx: `${jsxName}="${escapeJsxAttrLiteral(attr.value)}"`, diagnostics };
  }

  if (attr.kind === 'binding') {
    // `:style` special-case (Spike 004 string-form `:style` lowering).
    //   - ObjectExpression → leave to the generic binding emit below (React
    //     accepts object-form `style` natively; 260518-e2t object passthrough).
    //   - String LITERAL → PostCSS-parse at compile time, emit the object
    //     form (`style={{ ... }}`) — identical shape to object-form `:style`.
    //   - Dynamic (any other expr) → `style={parseInlineStyle(<expr>)}` +
    //     register the runtime helper import.
    if (attr.name === 'style') {
      if (t.isStringLiteral(attr.expression)) {
        return lowerStringLiteralStyle(attr.sourceLoc, attr.expression.value);
      }
      if (!t.isObjectExpression(attr.expression)) {
        ctx.collectors.runtime.add('parseInlineStyle');
        const exprCode = renderExpr(attr.expression, ctx.ir);
        return { jsx: `style={parseInlineStyle(${exprCode})}`, diagnostics };
      }
      // ObjectExpression falls through to the generic binding emit.
    }
    // ':name="expr"' → camelCased JSX name + expression value.
    // A `null`-fallback ternary (`x ? … : null`) is normalized to yield
    // `undefined` so React's `string | undefined` attr types accept it
    // (quick task 260520-w18). `style`/`class` already handled above.
    const jsxName = colonPropToJsxName(attr.name);
    const exprCode = renderExpr(
      normalizeNullAttrBinding(attr.expression),
      ctx.ir,
    );
    return { jsx: `${jsxName}={${exprCode}}`, diagnostics };
  }

  if (attr.kind === 'twoWayBinding') {
    // Phase 07.3 Plan 07.3-06 — D-01 React consumer-side two-way binding.
    // Emits the JSX attribute-pair `<propName>={local} on<Cap>Change={setter}`
    // where {local, setter} are resolved via resolveTwoWayTarget. The
    // propName casing is preserved (camelCase passes through colonPropToJsxName
    // unchanged when there are no hyphens / aria-/data- prefixes).
    const { local, setter } = resolveTwoWayTarget(attr.expression, ctx.ir);
    const propName = colonPropToJsxName(attr.name);
    const eventProp = `on${propName.charAt(0).toUpperCase()}${propName.slice(1)}Change`;
    return {
      jsx: `${propName}={${local}} ${eventProp}={${setter}}`,
      diagnostics,
    };
  }

  // Phase 14 — `spreadBinding` is handled in `emitAttributes` before this
  // function is ever called (the JSX `{...obj}` spread has no name to render
  // as a pair). This guard is for TS exhaustiveness only.
  if (attr.kind === 'spreadBinding') {
    return { jsx: `{...${renderExpr(attr.expression, ctx.ir)}}`, diagnostics };
  }

  // interpolated
  const jsxName = colonPropToJsxName(attr.name);
  // Build a backtick template literal directly without class-token splitting
  let lit = '';
  for (const seg of attr.segments) {
    if (seg.kind === 'static') {
      lit += seg.text
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${');
    } else {
      lit += '${' + renderExpr(seg.expression, ctx.ir) + '}';
    }
  }
  return { jsx: `${jsxName}={\`${lit}\`}`, diagnostics };
}

export interface EmitAttributesResult {
  jsx: string;
  diagnostics: Diagnostic[];
}

/**
 * Phase 14 D-03/D-04/R6 — render an `r-bind` spread for the React target.
 *
 * Three cases:
 *   - `$attrs` (bare Identifier) → `{...attrs}` — EXEMPT from key normalization
 *     (D-04). `rewriteTemplateExpression` rewrites the `$attrs` accessor.
 *   - LITERAL ObjectExpression  → keys remapped at compile time
 *     (`class`→`className`, …); `__proto__`/`constructor`/`prototype` skipped.
 *     R6: when the element ALSO has an explicit `class` binding, the literal's
 *     `className` key is extracted (see `extractLiteralClassExpr`) and only the
 *     `rest` keys are spread here.
 *   - DYNAMIC (any other expr)  → `{...normalizeAttrs(<expr>)}` + the runtime
 *     import is collected.
 *
 * KNOWN LIMITATION (RESEARCH Open Question 1 / Assumption A4) — for a DYNAMIC
 * `r-bind` object the keys are NOT known at compile time, so a `class`/`style`
 * key inside a dynamic spread CANNOT be extracted into the class/style merge.
 * Per RESEARCH Option (a) this is an accepted v1 limitation: React's own JSX
 * `{...obj}` last-wins ordering applies (a later `{...obj}` overrides an
 * earlier `className`). The R6 acceptance fixture uses a LITERAL `r-bind`, so
 * the literal path is the mandatory one and is fully merge-correct.
 */
function emitSpread(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
  ctx: EmitAttrCtx,
  /** When the element has an explicit `class` binding, the literal's class is
   *  extracted upstream — emit only the `rest`. */
  hasExplicitClass: boolean,
): string {
  if (isAttrsIdentifier(attr.expression)) {
    // D-04 — $attrs spread, no key normalization.
    return `{...${renderExpr(attr.expression, ctx.ir)}}`;
  }
  if (t.isObjectExpression(attr.expression)) {
    // D-03 LITERAL — compile-time key remap, zero runtime cost.
    const remapped = remapObjectKeysReact(attr.expression);
    if (hasExplicitClass) {
      // R6 — `className`/`style` already extracted into the merge paths; only
      // spread the remaining keys.
      const { rest } = splitClassStyleFromLiteral(remapped);
      return `{...${renderExpr(rest, ctx.ir)}}`;
    }
    return `{...${renderExpr(remapped, ctx.ir)}}`;
  }
  // D-03 DYNAMIC — runtime key remap.
  ctx.collectors.runtime.add('normalizeAttrs');
  return `{...normalizeAttrs(${renderExpr(attr.expression, ctx.ir)})}`;
}

/**
 * Phase 14 R6 — extract a `class`/`className` value from an `r-bind` LITERAL so
 * it can be folded into the element's class-merge. Returns the value
 * expressions (class + style) when the spread is a literal carrying those
 * keys, else null entries. Dynamic spreads return nulls (keys unknowable —
 * see `emitSpread` KNOWN LIMITATION).
 */
function extractLiteralClassStyle(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
): { classValue: t.Expression | null; styleValue: t.Expression | null } {
  if (isAttrsIdentifier(attr.expression) || !t.isObjectExpression(attr.expression)) {
    return { classValue: null, styleValue: null };
  }
  const remapped = remapObjectKeysReact(attr.expression);
  const { classValue, styleValue } = splitClassStyleFromLiteral(remapped);
  return { classValue, styleValue };
}

/**
 * Phase 14 R6 — React-specific opaque-spread class-merge support.
 *
 * React's JSX `{...spread}` semantics are *last-wins* per key — a `className`
 * key inside the spread silently overwrites an earlier explicit `className=`
 * on the same element. For an OPAQUE spread (`$attrs` from auto-fallthrough,
 * or a dynamic `r-bind="obj"`) we cannot extract the spread's `className` at
 * compile time, so we instead need to:
 *
 *   1. Emit the spread FIRST (preserves all non-class keys reaching the DOM).
 *   2. Re-emit `className=` AFTER the spread, with `clsx(<base>, <readExpr>)`
 *      that reads the spread's `className` and appends it to our base class.
 *
 * Returns the source-level expression code to read `className` from at
 * runtime, or null for a LITERAL spread (whose class is extracted at compile
 * time elsewhere).
 *
 * `$attrs`            → `attrs.className`   (rewriteTemplateExpression already
 *                                            lowers `$attrs` → `attrs`)
 * Dynamic `r-bind`    → `normalizeAttrs(<expr>).className`  — the `class` key
 *                       in the source is remapped to `className` by
 *                       normalizeAttrs, so reading `.className` matches the
 *                       key that the JSX spread emits.
 * LITERAL `r-bind`    → null (handled by extractLiteralClassStyle path)
 */
function opaqueSpreadClassReadExpr(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
  ctx: EmitAttrCtx,
): string | null {
  if (t.isObjectExpression(attr.expression)) return null;
  if (isAttrsIdentifier(attr.expression)) {
    // `$attrs` lowers to `attrs` (the rest bucket synthesised by emitScript)
    // typed as `Record<string, unknown>`. Cast the indexed read to
    // `string | undefined` so `clsx(...)` accepts it directly — without
    // the cast, `attrs.className` widens to `unknown` and fails TS2345
    // under react-typecheck. The cast is conservative: practically every
    // consumer-passed className is a string, and clsx is happy with that
    // union without a cross-package import.
    return `(attrs.className as string | undefined)`;
  }
  // Dynamic — read `.className` off the normalized expression. normalizeAttrs
  // remaps `class` → `className` (HTML_TO_JSX_ATTR), matching the key that
  // the JSX `{...normalizeAttrs(expr)}` spread reaches the DOM with.
  ctx.collectors.runtime.add('normalizeAttrs');
  const exprCode = renderExpr(attr.expression, ctx.ir);
  return `(normalizeAttrs(${exprCode}).className as string | undefined)`;
}

/**
 * Top-level entry: emit all attributes for an element. Buckets `class` and
 * `:class` together for single-className composition, and emits other
 * attributes through emitNonClassAttribute.
 *
 * Skips attributes that are CONSUMED upstream (r-* directives, @event, :key).
 */
export function emitAttributes(
  attrs: AttributeBinding[],
  ctx: EmitAttrCtx,
): EmitAttributesResult {
  const diagnostics: Diagnostic[] = [];
  if (attrs.length === 0) return { jsx: '', diagnostics };

  const buckets = bucket(attrs);
  const out: string[] = [];
  const consumed = new Set<AttributeBinding>();
  /**
   * R6 opaque-spread merge — when set, the deferred `className={...}` is
   * appended AFTER any spreads so JSX last-write ordering keeps our
   * (already-merged) `className` winning over the spread's `className` key.
   */
  let pendingPostSpreadClassName: string | null = null;

  // Phase 14 R6 — does the element have an explicit `class` binding? When so,
  // a `class`/`className` key inside an `r-bind` LITERAL must be folded into
  // the class-merge (not spread as a separate `className`, which would clobber
  // the explicit one). A bare `class` static / `:class` binding both bucket
  // under name `class` in Phase-2 IR.
  const hasExplicitClass = (buckets.get('class')?.length ?? 0) > 0;

  // Phase 14 R6 — synthesise extra `class` AttributeBindings from any `r-bind`
  // LITERAL that carries a `class` key, so `composeClassName` merges them with
  // the explicit `:class`. The synthetic bindings adopt the spread's source
  // position so the existing positional last-wins semantics are preserved.
  const literalClassBindings = new Map<AttributeBinding, AttributeBinding>();
  if (hasExplicitClass) {
    for (const a of attrs) {
      if (a.kind !== 'spreadBinding') continue;
      const { classValue } = extractLiteralClassStyle(a);
      if (classValue !== null) {
        literalClassBindings.set(a, {
          kind: 'binding',
          name: 'class',
          expression: classValue,
          deps: [],
          sourceLoc: a.sourceLoc,
        });
      }
    }
  }

  // Phase 14 R6 — OPAQUE-spread className-merge (React-specific). React's JSX
  // `{...spread}` is last-wins per key, so a spread's `className` silently
  // overwrites our explicit `className=` unless we re-emit `className=` AFTER
  // the spread with a `clsx(<base>, attrs.className)` that reads the spread's
  // `className` and appends it to the base class. Collect the source-level
  // "read className" expression for each opaque spread (in source order) so we
  // can append it to the base class value, AND emit the className attribute
  // AFTER the spreads.
  const opaqueSpreadClassReads: string[] = [];
  if (hasExplicitClass) {
    for (const a of attrs) {
      if (a.kind !== 'spreadBinding') continue;
      if (literalClassBindings.has(a)) continue; // LITERAL — already extracted.
      const readExpr = opaqueSpreadClassReadExpr(a, ctx);
      if (readExpr !== null) opaqueSpreadClassReads.push(readExpr);
    }
  }
  const needsPostSpreadClassName = opaqueSpreadClassReads.length > 0;

  for (const a of attrs) {
    if (consumed.has(a)) continue;

    // Phase 14 R2 / D-07 — the bare-spread `r-bind="<expr>"` form (and the
    // synthesized `$attrs` auto-fallthrough spread). React's native
    // attribute-spread idiom is the JSX spread `{...<obj>}`.
    if (a.kind === 'spreadBinding') {
      out.push(emitSpread(a, ctx, literalClassBindings.has(a)));
      consumed.add(a);
      continue;
    }

    if (isConsumedAttribute(a.name)) {
      consumed.add(a);
      continue;
    }

    if (a.name === 'class') {
      // Bucket all attributes with name="class" — Phase 2 normalises both
      // `class="x"` (kind:'static') and `:class="{...}"` (kind:'binding') to
      // the same name, kind disambiguates.
      const classAttrs: AttributeBinding[] = [];
      const bucketAttrs = buckets.get('class') ?? [];
      for (const ba of bucketAttrs) {
        if (!consumed.has(ba)) {
          classAttrs.push(ba);
          consumed.add(ba);
        }
      }
      // R6 — fold in the class extracted from any `r-bind` LITERAL, in the
      // spread's source order (positional last-wins is preserved).
      const merged: AttributeBinding[] = [];
      for (const src of attrs) {
        if (src.kind === 'spreadBinding') {
          const synthetic = literalClassBindings.get(src);
          if (synthetic) merged.push(synthetic);
        } else if (classAttrs.includes(src)) {
          merged.push(src);
        }
      }
      if (merged.length === 0) continue;
      let classNameValue = composeClassName(merged, ctx);
      if (needsPostSpreadClassName) {
        // R6 opaque-spread merge: wrap the base value in `clsx(<base>,
        // <readExpr>...)` so an `extra-variant` className from `$attrs` (or a
        // dynamic spread) joins the explicit `btn primary` instead of
        // overwriting it. The className attribute is also DEFERRED past the
        // spread emission below — we hold it in pendingPostSpreadClassName and
        // append at the very end.
        ctx.collectors.runtime.add('clsx');
        const clsxArgs = [classNameValue, ...opaqueSpreadClassReads];
        classNameValue = `clsx(${clsxArgs.join(', ')})`;
        pendingPostSpreadClassName = `className={${classNameValue}}`;
      } else {
        out.push(`className={${classNameValue}}`);
      }
      continue;
    }

    const result = emitNonClassAttribute(a, ctx);
    out.push(result.jsx);
    for (const d of result.diagnostics) diagnostics.push(d);
    consumed.add(a);
  }

  // R6 opaque-spread merge: emit the deferred `className=` AFTER all
  // attrs/spreads so it wins JSX's last-write ordering.
  if (pendingPostSpreadClassName !== null) {
    out.push(pendingPostSpreadClassName);
  }

  return { jsx: out.join(' '), diagnostics };
}
