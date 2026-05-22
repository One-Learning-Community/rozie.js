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

function renderExpr(
  expr: t.Expression,
  ir: IRComponent,
  invokeAccessors?: ReadonlySet<string> | undefined,
): string {
  return rewriteTemplateExpression(expr, ir, { invokeAccessors });
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
  invokeAccessors?: ReadonlySet<string> | undefined,
): string {
  // Single static → plain string
  if (attrs.length === 1 && attrs[0]!.kind === 'static') {
    return renderStaticClassValue(attrs[0]!.value);
  }

  // Single binding (object-form) — emit as clsx equivalent
  if (attrs.length === 1 && attrs[0]!.kind === 'binding') {
    const a = attrs[0]!;
    if (t.isObjectExpression(a.expression)) {
      // Object form: { active: isActive } → keep as-is (no styles lookup)
      return renderExpr(a.expression, ir, invokeAccessors);
    }
    return renderExpr(a.expression, ir, invokeAccessors);
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
        lit += '${' + renderExpr(seg.expression, ir, invokeAccessors) + '}';
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
      parts.push(renderExpr(a.expression, ir, invokeAccessors));
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
          lit += '${' + renderExpr(seg.expression, ir, invokeAccessors) + '}';
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
  attr: Extract<AttributeBinding, { kind: 'binding' }>,
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
        `Could not parse inline \`:style\` string ${JSON.stringify(literal)}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      loc: attr.sourceLoc,
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
        loc: attr.sourceLoc,
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
        return lowerStringLiteralStyle(attr, attr.expression.value);
      }
      if (!t.isObjectExpression(attr.expression)) {
        ctx.collectors.runtime.add('parseInlineStyle');
        const exprCode = renderExpr(attr.expression, ctx.ir, ctx.invokeAccessors);
        return { jsx: `style={parseInlineStyle(${exprCode})}`, diagnostics };
      }
      // ObjectExpression falls through to the generic binding emit.
    }
    const jsxName = colonPropToSolidName(attr.name);
    const exprCode = renderExpr(attr.expression, ctx.ir, ctx.invokeAccessors);
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
      const exprCodeFallback = renderExpr(attr.expression, ctx.ir, ctx.invokeAccessors);
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
      jsx: `{...${renderExpr(attr.expression, ctx.ir, ctx.invokeAccessors)}}`,
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
      lit += '${' + renderExpr(seg.expression, ctx.ir, ctx.invokeAccessors) + '}';
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
    return `{...${renderExpr(attr.expression, ctx.ir, ctx.invokeAccessors)}}`;
  }
  if (t.isObjectExpression(attr.expression)) {
    // D-03 LITERAL — compile-time key remap, zero runtime cost.
    const remapped = remapObjectKeysSolid(attr.expression);
    if (hasExplicitClass) {
      const { rest } = splitClassStyleFromLiteral(remapped);
      return `{...${renderExpr(rest, ctx.ir, ctx.invokeAccessors)}}`;
    }
    return `{...${renderExpr(remapped, ctx.ir, ctx.invokeAccessors)}}`;
  }
  // D-03 DYNAMIC — runtime key remap.
  ctx.collectors.runtime.add('normalizeAttrs');
  return `{...normalizeAttrs(${renderExpr(attr.expression, ctx.ir, ctx.invokeAccessors)})}`;
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

    // Solid uses `class=` not `className=`. Bucket all class attrs together.
    // Object-form `:class="{ active: isActive }"` → `classList={{ active: isActive() }}`
    // (Solid's classList= accepts an object; class= only accepts strings.)
    if (a.name === 'class') {
      const bucketAttrs = buckets.get('class') ?? [];
      const classListAttrs: AttributeBinding[] = [];
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
        if (src.kind === 'binding' && t.isObjectExpression(src.expression)) {
          classListAttrs.push(src);
        } else {
          classStrAttrs.push(src);
        }
        consumed.add(src);
      }
      // Emit `class=` for string/interpolated attrs.
      if (classStrAttrs.length > 0) {
        const classValue = composeClassValue(classStrAttrs, ctx.ir, ctx.invokeAccessors);
        out.push(`class={${classValue}}`);
      }
      // Emit `classList=` for each object-form `:class` binding.
      for (const cla of classListAttrs) {
        const exprCode = renderExpr((cla as Extract<AttributeBinding, { kind: 'binding' }>).expression, ctx.ir, ctx.invokeAccessors);
        out.push(`classList={${exprCode}}`);
      }
      continue;
    }

    const result = emitNonClassAttribute(a, ctx);
    out.push(result.jsx);
    for (const d of result.diagnostics) diagnostics.push(d);
    consumed.add(a);
  }

  return { jsx: out.join(' '), diagnostics };
}
