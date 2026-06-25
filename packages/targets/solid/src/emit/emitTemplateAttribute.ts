/**
 * emitTemplateAttribute — Solid target (P2 complete implementation).
 *
 * Renders an element's AttributeBinding[] as JSX-attribute strings for Solid.
 *
 * Key differences from React target:
 *   - `class=` stays as `class=` (Solid supports `class` natively — NO className)
 *   - `ref="foo"` → `ref={(el) => { fooRef = el; }}` (callback form, NOT useRef)
 *   - Signal reads in bindings go through rewriteTemplateExpression (which calls name())
 *   - No CSS Modules: class token lookups use plain string values (no styles.X)
 *   - Custom component props pass through normally (camelCase per D-141)
 *
 * Consumed upstream (not emitted as attributes):
 *   - r-* directives (r-if/r-else/r-else-if/r-for/r-show/r-html/r-text/r-model)
 *   - @event handlers (consumed by emitTemplateEvent)
 *   - :key (consumed by emitLoop's key expression)
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import postcss from 'postcss';
import type {
  IRComponent,
  AttributeBinding,
  ListenerSpreadIR,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { resolveTwoWayTarget } from './resolveTwoWayTarget.js';

export interface EmitAttrCtx {
  ir: IRComponent;
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector };
  /**
   * Loop-scoped accessor identifiers — see EmitNodeCtx.invokeAccessors.
   * Threaded so `:key="keyFor(item, index)"` lowers to `keyFor(item, index())`
   * inside a `<For>` loop body where `index` is a Solid Accessor.
   */
  invokeAccessors?: ReadonlySet<string> | undefined;
  /**
   * Phase 33 / REQ-26 — reactive-portal scope-accessor map, threaded from the
   * EmitNodeCtx so attribute bindings inside a reactive portal fill body
   * (`:data-selected`, `:data-label`, `:class`, …) rewrite scope-param reads to
   * `<accessor>().<prop>` (in-place re-render). Undefined everywhere else.
   */
  scopeAccessorParams?:
    | { accessorIdent: string; params: ReadonlyMap<string, string> }
    | undefined;
  /**
   * Phase 26 — host element tagKind + tagName. The `rozieDisplay` wrap (SPEC-4)
   * applies ONLY where a binding renders as attribute TEXT on an HTML host.
   * Component/self-tag prop bindings pass the value structurally (no wrap), and
   * `value`/`checked` on a form input are controlled-input props (no wrap).
   */
  elementTagKind?: 'html' | 'component' | 'self';
  tagName?: string;
}

/** Form-input tags whose `value`/`checked` are controlled-input PROPERTIES. */
const FORM_INPUT_TAGS = new Set(['input', 'textarea', 'select']);

/**
 * CR-02 — HTML attributes whose value is a `boolean` (mirror of the React/Svelte
 * sets). A boolean-attr binding is never display TEXT; wrapping it feeds a
 * string into a boolean prop ("false"-is-truthy flip) and diverges from Lit. */
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
 * Phase 26 — does a `wrapForDisplay`-flagged attribute binding render as
 * attribute TEXT (where `[object Object]` would surface)? See the React twin.
 */
function shouldWrapAttrBinding(name: string, expr: t.Expression, ctx: EmitAttrCtx): boolean {
  if (ctx.elementTagKind === 'component' || ctx.elementTagKind === 'self') return false;
  // CR-02 — Boolean HTML attrs are not display text; always raw (matches Lit).
  if (BOOLEAN_HTML_ATTRS.has(name.toLowerCase())) return false;
  if (
    (name === 'value' || name === 'checked') &&
    ctx.tagName !== undefined &&
    FORM_INPUT_TAGS.has(ctx.tagName)
  ) {
    return false;
  }
  // `style` is a structural OBJECT prop in Solid (not attribute text) — wrapping
  // would JSON-stringify the style object and break it.
  if (name === 'style') return false;
  // An object-expression binding (`:style="{...}"`, `:class="{...}"`) is
  // structural, not display text — never wrap.
  if (t.isObjectExpression(expr)) return false;
  return true;
}

/**
 * Names consumed upstream — these should never appear in emitted attrs.
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
 * Map of HTML attribute names that need special-casing in Solid JSX.
 * NOTE: Unlike React, Solid DOES support `class` directly. We still camelCase
 * most event/property-style attributes but class stays as class.
 *
 * Solid supports both `tabindex` and `tabIndex` but we normalize to the
 * JS-property form for consistency with the React target's snapshot output.
 */
const HTML_TO_SOLID_ATTR: Readonly<Record<string, string>> = {
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  for: 'for',           // Solid: <label for="..."> stays as `for`
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  autofocus: 'autofocus',
  autocomplete: 'autocomplete',
  autocapitalize: 'autocapitalize',
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

function htmlAttrToSolidName(name: string): string {
  const lower = name.toLowerCase();
  return HTML_TO_SOLID_ATTR[lower] ?? name;
}

/**
 * Phase 14 D-04 — the magic accessor whose `r-bind` spread is EXEMPT from key
 * normalization. A `$attrs` cluster already carries target-native keys.
 */
function isAttrsIdentifier(expr: t.Expression): boolean {
  return t.isIdentifier(expr, { name: '$attrs' });
}

/**
 * Phase 14 SECURITY (T-14-06) — keys that must never reach the emitted object
 * from an author-controlled `r-bind` literal.
 */
const FORBIDDEN_SPREAD_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Read an ObjectProperty's static key name, or null when the key is not a
 * statically-knowable Identifier / StringLiteral.
 */
function staticPropKey(prop: t.ObjectProperty): string | null {
  if (t.isIdentifier(prop.key) && !prop.computed) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  return null;
}

/**
 * Phase 14 D-03 — compile-time r-bind key remap for the Solid target.
 *
 * This map is INTENTIONALLY DISTINCT from `HTML_TO_SOLID_ATTR` (the generic
 * attribute-name map): for a `r-bind` LITERAL object, `for` MUST become
 * `htmlFor` to align with the runtime `normalizeAttrs` helper and with the
 * React-DOM-shared property names that Solid honors when used as a JSX
 * prop. (`HTML_TO_SOLID_ATTR.for` keeps `for` for `<label for="...">` —
 * a different code path; conflating the two would silently break consumers
 * who spread `for: 'input-id'` through `r-bind`.)
 *
 * Solid keeps `class` as `class` (Solid JSX native) — `class` is NOT in this
 * table.
 */
const RBIND_HTML_TO_SOLID_ATTR: Readonly<Record<string, string>> = {
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  crossorigin: 'crossOrigin',
  inputmode: 'inputMode',
  enterkeyhint: 'enterKeyHint',
  formaction: 'formAction',
  formenctype: 'formEnctype',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  referrerpolicy: 'referrerPolicy',
  srcset: 'srcSet',
  enctype: 'encType',
  novalidate: 'noValidate',
  usemap: 'useMap',
  acceptcharset: 'acceptCharset',
  hreflang: 'hrefLang',
  datetime: 'dateTime',
};

/**
 * Phase 14 D-03 — compile-time key remap of an `r-bind` LITERAL object for the
 * Solid target. Returns a NEW ObjectExpression (IR never mutated) with the
 * HTML-shape keys renamed to Solid-JSX naming, `class` KEPT (Solid difference),
 * and `__proto__`/`constructor`/`prototype` keys SKIPPED (T-14-06).
 */
function remapObjectKeysSolid(obj: t.ObjectExpression): t.ObjectExpression {
  const cloned = t.cloneNode(obj, true, false) as t.ObjectExpression;
  const kept: t.ObjectExpression['properties'] = [];
  for (const prop of cloned.properties) {
    if (!t.isObjectProperty(prop)) {
      kept.push(prop);
      continue;
    }
    const keyName = staticPropKey(prop);
    if (keyName !== null && FORBIDDEN_SPREAD_KEYS.has(keyName)) {
      continue;
    }
    if (keyName !== null) {
      // r-bind uses a distinct remap table — see comment on
      // RBIND_HTML_TO_SOLID_ATTR for why this is NOT htmlAttrToSolidName.
      const mapped = RBIND_HTML_TO_SOLID_ATTR[keyName.toLowerCase()] ?? keyName;
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
 * Operates on the ALREADY-REMAPPED object (Solid key for class is still `class`).
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

function colonPropToSolidName(name: string): string {
  const bare = name.startsWith(':') ? name.slice(1) : name;
  if (bare.startsWith('aria-') || bare.startsWith('data-')) return bare;
  let out = bare;
  if (out.includes('-')) {
    out = out.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  }
  return htmlAttrToSolidName(out);
}

function escapeJsxAttrLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Bundle of rewrite knobs threaded from the attribute-emit ctx into every
 * `rewriteTemplateExpression` call. `invokeAccessors` is the loop-index accessor
 * set; `scopeAccessorParams` is the Phase-33 reactive-portal scope-accessor map
 * (Solid-only; undefined on every non-reactive-portal-fill path → byte-identical
 * back-compat emit).
 */
type RenderExprOpts = {
  invokeAccessors?: ReadonlySet<string> | undefined;
  scopeAccessorParams?:
    | { accessorIdent: string; params: ReadonlyMap<string, string> }
    | undefined;
};

function renderExpr(
  expr: t.Expression,
  ir: IRComponent,
  opts?: RenderExprOpts,
): string {
  return rewriteTemplateExpression(expr, ir, {
    invokeAccessors: opts?.invokeAccessors,
    scopeAccessorParams: opts?.scopeAccessorParams,
  });
}

/**
 * Solid has no CSS Modules pipeline — class tokens are emitted as plain
 * string literals (no styles.X lookups).
 */
function renderStaticClassValue(className: string): string {
  return JSON.stringify(className);
}

/**
 * Compose class= value from one or more class attrs.
 */
function composeClassValue(
  attrs: AttributeBinding[],
  ir: IRComponent,
  exprOpts?: RenderExprOpts,
  // Phase 26 — runtime collector so a non-primitive class interpolation can
  // register the `rozieDisplay` import when it wraps (SPEC-4).
  runtime?: RuntimeSolidImportCollector,
): string {
  // Single static → plain string
  if (attrs.length === 1 && attrs[0]!.kind === 'static') {
    return renderStaticClassValue(attrs[0]!.value);
  }

  // Single binding (object-form) — emit as clsx equivalent
  if (attrs.length === 1 && attrs[0]!.kind === 'binding') {
    const a = attrs[0]!;
    if (t.isObjectExpression(a.expression)) {
      // Object form: { active: isActive } → rozieClass({ active: isActive() })
      // so it renders a space-joined string for `class=`. We never emit a
      // separate `classList=` (Solid's className setter would clobber it when a
      // static class coexists — the systemic class/classList conflict).
      runtime?.add('rozieClass');
      return `rozieClass(${renderExpr(a.expression, ir, exprOpts)})`;
    }
    // A non-provably-string single `:class` binding (array/identifier/member/
    // call/conditional — `wrapForDisplay=true`) is normalized through
    // `rozieClass` (quick task 260620-kby) so an array/object class value
    // renders a valid space-joined string instead of `a,b` / `[object Object]`.
    // `rozieClass(...)` stays the DIRECT binding-site value (never a hoisted
    // const) so Solid fine-grained reactivity re-reads it. Provably-string
    // bindings (`wrapForDisplay=false`) AND template literals (provably a
    // string — `wrapForDisplay=true` only because the IR checker doesn't model
    // template literals) stay byte-identical (raw renderExpr).
    if (a.wrapForDisplay && !t.isTemplateLiteral(a.expression)) {
      runtime?.add('rozieClass');
      return `rozieClass(${renderExpr(a.expression, ir, exprOpts)})`;
    }
    return renderExpr(a.expression, ir, exprOpts);
  }

  // Single interpolated — backtick template
  if (attrs.length === 1 && attrs[0]!.kind === 'interpolated') {
    const a = attrs[0]!;
    let lit = '';
    for (const seg of a.segments) {
      if (seg.kind === 'static') {
        lit += seg.text
          .replace(/\\/g, '\\\\')
          .replace(/`/g, '\\`')
          .replace(/\$\{/g, '\\${');
      } else {
        // Phase 26 (D-06/SPEC-4) — wrap a non-primitive class interpolation.
        const segCode = renderExpr(seg.expression, ir, exprOpts);
        if (seg.wrapForDisplay) {
          runtime?.add('rozieDisplay');
          lit += '${rozieDisplay(' + segCode + ')}';
        } else {
          lit += '${' + segCode + '}';
        }
      }
    }
    return '`' + lit + '`';
  }

  // Multi-source — join with spaces using template literal or string concat
  const parts: string[] = [];
  for (const a of attrs) {
    if (a.kind === 'twoWayBinding') {
      // Phase 07.3 Wave 3 stub — twoWayBinding never appears in a class merge.
      throw new Error(
        `Solid target: twoWayBinding not valid in class array context (Phase 07.3 Wave 3 Plan 07.3-07).`,
      );
    } else if (a.kind === 'static') {
      parts.push(renderStaticClassValue(a.value));
    } else if (a.kind === 'binding') {
      // Parenthesize the binding expression before it joins the `+ " " +`
      // string concat below. A bare `:class` expression can be any JS
      // expression — a ternary (`x ? 'a' : 'b'`), a logical-or, etc. — whose
      // operators bind LOOSER than `+`. Without the wrap,
      // `"static" + " " + node.type.name === 'x' ? 'a' : 'b'` reparses (by JS
      // precedence: + > == > ?:) as `(("static "+node.type.name)==='x') ? …`,
      // silently dropping the static class and the intended branch. The wrap
      // isolates the binding as one operand. (Single-source bindings emit via
      // the early-return path above and are already self-delimited.)
      //
      // A non-provably-string merge member (`wrapForDisplay=true`) is normalized
      // through `rozieClass` (quick task 260620-kby) — a self-delimited call, so
      // it needs no extra parens in the `+ " " +` concat. Provably-string
      // members AND template literals (provably a string) stay the
      // byte-identical parenthesized raw form.
      if ((a.wrapForDisplay || t.isObjectExpression(a.expression)) && !t.isTemplateLiteral(a.expression)) {
        // Object-form `:class` and other non-provably-string bindings normalize
        // through rozieClass (clsx-style) so they join the class string as a
        // valid space-joined token list — never a separate classList=.
        runtime?.add('rozieClass');
        parts.push(`rozieClass(${renderExpr(a.expression, ir, exprOpts)})`);
      } else {
        parts.push(`(${renderExpr(a.expression, ir, exprOpts)})`);
      }
    } else if (a.kind === 'spreadBinding') {
      // Phase 14 — `spreadBinding` is the name-less kind: it never reaches a
      // class merge (no name to coalesce on). Unreachable; mirrors the
      // `twoWayBinding` guard above.
      throw new Error(
        `Solid target: spreadBinding not valid in class array context (Phase 14).`,
      );
    } else {
      let lit = '';
      for (const seg of a.segments) {
        if (seg.kind === 'static') {
          lit += seg.text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
        } else {
          // Phase 26 (D-06/SPEC-4) — wrap a non-primitive class interpolation.
          const segCode = renderExpr(seg.expression, ir, exprOpts);
          if (seg.wrapForDisplay) {
            runtime?.add('rozieDisplay');
            lit += '${rozieDisplay(' + segCode + ')}';
          } else {
            lit += '${' + segCode + '}';
          }
        }
      }
      parts.push('`' + lit + '`');
    }
  }
  if (parts.length === 1) return parts[0]!;
  return parts.join(' + " " + ');
}

/**
 * Phase 14 — `spreadBinding` is the name-less `AttributeBinding` kind (D-07):
 * it never participates in class name-bucketing and is skipped here.
 * `emitAttributes` emits it directly as a JSX spread (`{...<expr>}`).
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
 * Convert a kebab-case CSS property name to a Solid style-object key.
 * Mirrors `@rozie/runtime-solid`'s `toStyleObjectKey` — kept as a small
 * self-contained emitter local (no shared home for a ~10-line converter).
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
 * Lower a string-LITERAL `:style` value at compile time. PostCSS-parses the
 * declaration list and renders a JSX object-expression — byte-identical in
 * shape to object-form `:style`. When a declaration carries `!important`,
 * a ROZ083 WARN is collected (Solid's object form silently drops it).
 *
 * Spike 004 locked decision #8: v1 is syntactic-parse only — a malformed
 * style string surfaces as a ROZ080 diagnostic (caught here, never a raw
 * PostCSS throw).
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
          `\`!important\` on \`${decl.prop}\` is dropped by Solid's style-object form. ` +
          `Solid silently ignores \`!important\` in inline style objects.`,
        loc: sourceLoc,
      });
    }
    props.push(`${keyOut}: ${JSON.stringify(decl.value)}`);
  });
  const objBody = props.length > 0 ? `{ ${props.join(', ')} }` : '{}';
  return { jsx: `style={${objBody}}`, diagnostics };
}

function emitNonClassAttribute(
  attr: AttributeBinding,
  ctx: EmitAttrCtx,
): { jsx: string; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  // ref="name" → ref={(el) => { fooRef = el; }}
  // Solid uses a callback ref (not useRef). The variable is declared at top of
  // component body as `let fooRef: HTMLElement | null = null;` by emitScript.
  if (attr.kind === 'static' && attr.name === 'ref') {
    const refNames = new Set(ctx.ir.refs.map((r) => r.name));
    if (refNames.has(attr.value)) {
      const varName = attr.value + 'Ref';
      return { jsx: `ref={(el) => { ${varName} = el as HTMLElement; }}`, diagnostics };
    }
    // Unknown ref — pass through as static
  }

  // bare `style="k1: v1; k2: v2"` static → object form. Mirrors React's
  // matching emit path (Phase 14-06 ThemedButtonConsumer divergence): when a
  // child component is invoked with a string-form `style="..."` attribute,
  // the consumer's prop reaches the child as a STRING. The child's auto-
  // fallthrough spread (`{...attrs}`) then routes the string through Solid's
  // dom-expressions `style()` helper, which for string values does
  // `nodeStyle.cssText = value` — REPLACING the entire inline style and
  // wiping any wrapper-set `style={{...}}` defaults (the
  // `ThemedButtonConsumer · solid` matrix VR cell residual after Item 1:
  // wrapper's `--btn-fg: #ffffff` survived only via the `var(...)` fallback,
  // not via the inline style). Converting the string to an object literal
  // here ensures the child receives `props.style` as an object; Solid's
  // `style()` helper then iterates and `setProperty`s per key, MERGING with
  // the wrapper's defaults instead of clobbering them.
  if (attr.kind === 'static' && attr.name === 'style') {
    return lowerStringLiteralStyle(attr.sourceLoc, attr.value);
  }

  if (attr.kind === 'static') {
    const jsxName = htmlAttrToSolidName(attr.name);
    if (NUMERIC_HTML_ATTRS.has(attr.name.toLowerCase()) && /^-?\d+(?:\.\d+)?$/.test(attr.value)) {
      return { jsx: `${jsxName}={${attr.value}}`, diagnostics };
    }
    return { jsx: `${jsxName}="${escapeJsxAttrLiteral(attr.value)}"`, diagnostics };
  }

  if (attr.kind === 'binding') {
    // `:style` special-case (Spike 004 string-form `:style` lowering).
    //   - ObjectExpression → leave to the generic binding emit below (Solid
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
        const exprCode = renderExpr(attr.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams });
        return { jsx: `style={parseInlineStyle(${exprCode})}`, diagnostics };
      }
      // ObjectExpression falls through to the generic binding emit.
    }
    const jsxName = colonPropToSolidName(attr.name);
    const exprCode = renderExpr(attr.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams });
    // Phase 26 (D-06/SPEC-4) — attribute-binding wrap on an HTML host attribute
    // text position only (structural component props / controlled-input props
    // are exempt). A non-primitive value renders portable JSON; raw otherwise
    // (SPEC-3). The wrap sits inside the JSX `{}` so the accessor read stays
    // tracked (A4).
    if (attr.wrapForDisplay && shouldWrapAttrBinding(attr.name, attr.expression, ctx)) {
      // 260608-sya — whole-value attribute binding: route through `rozieAttr`
      // so a nullish value DROPS the attribute (returns `undefined` → Solid
      // skips the setAttribute) instead of rendering `attr=""`, matching Vue's
      // `:attr` semantics. `false` still stringifies (preserves aria-/data-
      // a11y). Interpolated SEGMENTS stay on `rozieDisplay`.
      ctx.collectors.runtime.add('rozieAttr');
      return { jsx: `${jsxName}={rozieAttr(${exprCode})}`, diagnostics };
    }
    return { jsx: `${jsxName}={${exprCode}}`, diagnostics };
  }

  if (attr.kind === 'twoWayBinding') {
    // Phase 07.3 D-01 — consumer-side `r-model:propName="expr"` emit.
    //
    // Solid shape: `${propName}={${local}()} on${Capitalize(propName)}Change={${setter}}`
    //
    // The Accessor invocation (`local()`) is the only structural difference
    // from React's emit — Solid signals expose the current value via a
    // callable Accessor (RESEARCH §Solid lines 179-184). The Setter is
    // passed as a bare identifier; downstream `_props.on${Cap}Change?.(v)`
    // is wired by createControllableSignal (runtime), not the consumer JSX.
    //
    // Event prop name follows the project-wide `on${Capitalize(propName)}Change`
    // convention (emitPropsInterface.ts:73, RESEARCH line 177).
    //
    // The IR-time validator (validateTwoWayBindings) has already rejected
    // invalid LHS shapes (ROZ949/950/951) before emit runs. resolveTwoWayTarget
    // returning null here is a defensive guard — fall back to a bare,
    // one-way binding so the build doesn't crash if validation was skipped
    // (e.g. unplugin pipeline edge cases).
    const target = resolveTwoWayTarget(attr.expression, ctx.ir);
    if (target === null) {
      const jsxNameFallback = colonPropToSolidName(attr.name);
      const exprCodeFallback = renderExpr(attr.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams });
      return { jsx: `${jsxNameFallback}={${exprCodeFallback}}`, diagnostics };
    }
    const { local, setter } = target;
    const jsxName = colonPropToSolidName(attr.name);
    const eventProp = `on${capitalize(jsxName)}Change`;
    return {
      jsx: `${jsxName}={${local}()} ${eventProp}={${setter}}`,
      diagnostics,
    };
  }

  // Phase 14 — `spreadBinding` is handled in `emitAttributes` before this
  // function is ever called (the JSX `{...obj}` spread has no name to render
  // as a pair). This guard is for TS exhaustiveness only.
  if (attr.kind === 'spreadBinding') {
    return {
      jsx: `{...${renderExpr(attr.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams })}}`,
      diagnostics,
    };
  }

  // interpolated
  const jsxName = colonPropToSolidName(attr.name);
  let lit = '';
  for (const seg of attr.segments) {
    if (seg.kind === 'static') {
      lit += seg.text
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${');
    } else {
      // Phase 26 (D-06/SPEC-4) — per-segment wrap for attribute interpolation.
      const segCode = renderExpr(seg.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams });
      if (seg.wrapForDisplay) {
        ctx.collectors.runtime.add('rozieDisplay');
        lit += '${rozieDisplay(' + segCode + ')}';
      } else {
        lit += '${' + segCode + '}';
      }
    }
  }
  return { jsx: `${jsxName}={\`${lit}\`}`, diagnostics };
}

export interface EmitAttributesResult {
  jsx: string;
  diagnostics: Diagnostic[];
}

/**
 * Phase 14 D-03/D-04/R6 — render an `r-bind` spread for the Solid target.
 *
 * Three cases:
 *   - `$attrs` (bare Identifier) → `{...attrs}` — EXEMPT from key normalization
 *     (D-04). `rewriteTemplateExpression` rewrites the `$attrs` accessor.
 *   - LITERAL ObjectExpression  → keys remapped at compile time (`class` is
 *     KEPT for Solid; `for`→`htmlFor`, …); `__proto__`/`constructor`/`prototype`
 *     skipped. R6: when the element ALSO has an explicit `class` binding, the
 *     literal's `class` is extracted upstream and only `rest` is spread here.
 *   - DYNAMIC (any other expr)  → `{...normalizeAttrs(<expr>)}` + the runtime
 *     import is collected.
 *
 * KNOWN LIMITATION (RESEARCH Open Question 1 / Assumption A4) — for a DYNAMIC
 * `r-bind` object the keys are NOT known at compile time, so a `class`/`style`
 * key inside a dynamic spread CANNOT be extracted into the class merge. Per
 * RESEARCH Option (a) this is an accepted v1 limitation: Solid's own JSX
 * `{...obj}` last-wins ordering applies. The R6 acceptance fixture uses a
 * LITERAL `r-bind`, so the literal path is the mandatory one and is fully
 * merge-correct.
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
    return `{...${renderExpr(attr.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams })}}`;
  }
  if (t.isObjectExpression(attr.expression)) {
    // D-03 LITERAL — compile-time key remap, zero runtime cost.
    const remapped = remapObjectKeysSolid(attr.expression);
    if (hasExplicitClass) {
      const { rest } = splitClassStyleFromLiteral(remapped);
      return `{...${renderExpr(rest, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams })}}`;
    }
    return `{...${renderExpr(remapped, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams })}}`;
  }
  // D-03 DYNAMIC — runtime key remap.
  ctx.collectors.runtime.add('normalizeAttrs');
  return `{...normalizeAttrs(${renderExpr(attr.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams })})}`;
}

/**
 * Phase 15 D-19 — the magic accessor whose `r-on` spread is EXEMPT from key
 * normalization. A `$listeners` cluster already carries Solid JSX listener-
 * prop names (the consumer wrote `onClick`, not `click`), so it is spread
 * verbatim. Mirrors `isAttrsIdentifier` (Phase 14 D-04).
 *
 * Both the synthesized auto-fallthrough push and an author-written
 * `r-on="$listeners"` lower to a bare `$listeners` Identifier — the emitter
 * cannot (and need not) distinguish them.
 */
function isListenersIdentifier(expr: t.Expression): boolean {
  return t.isIdentifier(expr, { name: '$listeners' });
}

/**
 * Phase 15 — emit a single `ListenerSpreadIR` as a standalone JSX spread.
 *
 * When the per-element R6 merge logic determines that no static handler
 * collides with this spread, the spread reaches the DOM unwrapped (or
 * remapped, for dynamic). When collisions exist, the spread is instead
 * routed through a single `mergeListeners(...)` call assembled by the
 * per-element walker.
 *
 *   - bare `$listeners` (D-19 exempt)  →  `{...$listeners}` — no remap
 *   - LITERAL ObjectExpression         →  per-key dispatcher emit handles
 *                                          this entirely
 *   - DYNAMIC expression               →  `{...normalizeListeners(<expr>)}`
 *                                          + runtime import collected
 */
export function emitListenerSpread(
  spread: ListenerSpreadIR,
  ctx: EmitAttrCtx,
): string {
  if (isListenersIdentifier(spread.expression)) {
    return `{...${renderExpr(spread.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams })}}`;
  }
  ctx.collectors.runtime.add('normalizeListeners');
  return `{...normalizeListeners(${renderExpr(spread.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams })})}`;
}

/**
 * Phase 15 — produce the source-text expression that builds an `r-on`
 * partial for inclusion in a `mergeListeners(...)` call.
 *
 *   - bare `$listeners` (D-19 exempt) → `$listeners` raw (consumer's
 *      $listeners cluster already carries target-native keys)
 *   - DYNAMIC expression              → `normalizeListeners(<expr>)`
 */
export function emitListenerSpreadAsMergePartial(
  spread: ListenerSpreadIR,
  ctx: EmitAttrCtx,
): string {
  if (isListenersIdentifier(spread.expression)) {
    return renderExpr(spread.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams });
  }
  ctx.collectors.runtime.add('normalizeListeners');
  return `normalizeListeners(${renderExpr(spread.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams })})`;
}

/**
 * Phase 14 R6 — extract a `class`/`style` value from an `r-bind` LITERAL so it
 * can be folded into the element's merge paths. Returns null entries for a
 * `$attrs` spread or a dynamic spread.
 */
function extractLiteralClassStyle(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
): { classValue: t.Expression | null; styleValue: t.Expression | null } {
  if (isAttrsIdentifier(attr.expression) || !t.isObjectExpression(attr.expression)) {
    return { classValue: null, styleValue: null };
  }
  const remapped = remapObjectKeysSolid(attr.expression);
  const { classValue, styleValue } = splitClassStyleFromLiteral(remapped);
  return { classValue, styleValue };
}

/**
 * Phase 14 R6 — Solid-specific opaque-spread class-merge support.
 *
 * Solid's JSX `{...spread}` semantics are *last-wins* per key — a `class` key
 * inside the spread silently overwrites an earlier explicit `class=` on the
 * same element. For an OPAQUE spread (`$attrs` from auto-fallthrough, or a
 * dynamic `r-bind="obj"`) we cannot extract the spread's `class` at compile
 * time, so we instead need to:
 *
 *   1. Emit the spread FIRST (preserves all non-class keys reaching the DOM).
 *   2. Re-emit `class=` AFTER the spread, with a runtime concat that reads
 *      the spread's `class` and appends it to our base class string.
 *
 * Returns the source-level expression code to read `class` from at runtime, or
 * null for a LITERAL spread (whose class is extracted at compile time elsewhere).
 *
 * `$attrs`            → `attrs.class`
 * Dynamic `r-bind`    → `(<rewritten expr>).class`
 * LITERAL `r-bind`    → null (handled by extractLiteralClassStyle path)
 */
function opaqueSpreadClassReadExpr(
  attr: Extract<AttributeBinding, { kind: 'spreadBinding' }>,
  ctx: EmitAttrCtx,
): string | null {
  if (t.isObjectExpression(attr.expression)) return null;
  if (isAttrsIdentifier(attr.expression)) {
    // `$attrs` lowers to `attrs` (the rest bucket from splitProps). Solid's
    // splitProps types the rest as `Omit<TProps, …declared>` — which does
    // NOT declare a `class` field on most wrappers, so a bare `attrs.class`
    // read fails TS2339 under solid-lint. Cast through `Record<string,
    // unknown>` then to `string | undefined` to keep the runtime read
    // identical while satisfying solid-lint's `tsc --noEmit` gate.
    return `((attrs as unknown as Record<string, unknown>).class as string | undefined)`;
  }
  // Dynamic — read `.class` off the source expression. `normalizeAttrs` does
  // not alter the `class` key for Solid (SOLID_ATTR_KEY_MAP omits `class`),
  // so reading from the raw expression matches the spread's `class` key.
  const exprCode = renderExpr(attr.expression, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams });
  return `((${exprCode}) as unknown as Record<string, unknown>)?.class as string | undefined`;
}

/**
 * Top-level entry: emit all attributes for an element.
 * Buckets `class` and `:class` together for composition.
 * Skips consumed (r-* / @event / :key) attributes.
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
   * R6 opaque-spread merge — when set, deferred `class={...}` emit appended
   * after spreads so JSX last-write ordering keeps our (merged) class wins.
   */
  let pendingPostSpreadClass: string | null = null;

  // Phase 14 R6 — does the element have an explicit `class` binding?
  const hasExplicitClass = (buckets.get('class')?.length ?? 0) > 0;

  // Phase 14 R6 — synthesise extra `class` AttributeBindings from any `r-bind`
  // LITERAL that carries a `class` key, in spread source order, so the existing
  // class merge sees them.
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

  // Phase 14 R6 — OPAQUE-spread class-merge (Solid-specific). Solid's JSX
  // `{...spread}` is last-wins per key, so a spread's `class` silently
  // overwrites our explicit `class=` unless we re-emit `class=` AFTER the
  // spread with a runtime concat. Collect the source-level "read class"
  // expression for each opaque spread (in source order) so we can append it
  // to the base class value, AND emit the class attribute AFTER the spreads.
  const opaqueSpreadClassReads: string[] = [];
  if (hasExplicitClass) {
    for (const a of attrs) {
      if (a.kind !== 'spreadBinding') continue;
      if (literalClassBindings.has(a)) continue; // LITERAL — already extracted.
      const readExpr = opaqueSpreadClassReadExpr(a, ctx);
      if (readExpr !== null) opaqueSpreadClassReads.push(readExpr);
    }
  }
  const needsPostSpreadClass = opaqueSpreadClassReads.length > 0;

  for (const a of attrs) {
    if (consumed.has(a)) continue;

    // Phase 14 R2 / D-07 — the bare-spread `r-bind="<expr>"` form (and the
    // synthesized `$attrs` auto-fallthrough spread). Solid's native
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

    // Solid uses `class=` not `className=`. Bucket ALL class attrs (static,
    // interpolated, string-binding, AND object-form `:class="{ active: x }"`)
    // into a SINGLE `class=` value. We deliberately do NOT emit a separate
    // `classList=`: Solid applies `class` via `el.className = …`, which WIPES
    // any classes a sibling `classList.toggle()` set on the same element — so an
    // element carrying both a static class and an object `:class` silently lost
    // its conditional classes. Object forms are normalized through `rozieClass`
    // (clsx-style: truthy keys → space-joined string) inside composeClassValue,
    // so they merge into the one class string instead of fighting it.
    if (a.name === 'class') {
      const bucketAttrs = buckets.get('class') ?? [];
      const classStrAttrs: AttributeBinding[] = [];
      // Walk the FULL attrs list to preserve source order — at each spread
      // position with a literal class, insert the synthetic class binding so
      // the R6 positional last-wins merge matches the author's source order.
      for (const src of attrs) {
        if (src.kind === 'spreadBinding') {
          const synthetic = literalClassBindings.get(src);
          if (synthetic) classStrAttrs.push(synthetic);
          continue;
        }
        if (!bucketAttrs.includes(src)) continue;
        if (consumed.has(src)) continue;
        classStrAttrs.push(src);
        consumed.add(src);
      }
      // Emit a single `class=` for all class sources (object forms wrapped in
      // rozieClass by composeClassValue).
      if (classStrAttrs.length > 0) {
        let classValue = composeClassValue(classStrAttrs, ctx.ir, { invokeAccessors: ctx.invokeAccessors, scopeAccessorParams: ctx.scopeAccessorParams }, ctx.collectors.runtime);
        if (needsPostSpreadClass) {
          // R6 opaque-spread merge: append each opaque spread's class at the
          // tail of the value so an `extra-variant` from `$attrs` joins our
          // `btn primary` instead of overwriting it. The class attribute is
          // also DEFERRED past the spread emission below — we hold it in
          // `pendingPostSpreadClass` and append at the very end.
          for (const readExpr of opaqueSpreadClassReads) {
            classValue = `${classValue} + (${readExpr} ? " " + ${readExpr} : "")`;
          }
          pendingPostSpreadClass = `class={${classValue}}`;
        } else {
          out.push(`class={${classValue}}`);
        }
      }
      continue;
    }

    const result = emitNonClassAttribute(a, ctx);
    out.push(result.jsx);
    for (const d of result.diagnostics) diagnostics.push(d);
    consumed.add(a);
  }

  // R6 opaque-spread merge: emit the deferred `class=` AFTER all attrs/spreads
  // so it wins JSX's last-write ordering.
  if (pendingPostSpreadClass !== null) {
    out.push(pendingPostSpreadClass);
  }

  return { jsx: out.join(' '), diagnostics };
}
