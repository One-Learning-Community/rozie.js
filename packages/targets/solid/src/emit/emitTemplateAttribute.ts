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
 * Spike 004 locked decision #8: v1 is syntactic-parse only.
 */
function lowerStringLiteralStyle(
  attr: Extract<AttributeBinding, { kind: 'binding' }>,
  literal: string,
): { jsx: string; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const props: string[] = [];
  const root = postcss.parse(literal);
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

  for (const a of attrs) {
    if (consumed.has(a)) continue;
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
      for (const ba of bucketAttrs) {
        if (consumed.has(ba)) continue;
        if (ba.kind === 'binding' && t.isObjectExpression(ba.expression)) {
          classListAttrs.push(ba);
        } else {
          classStrAttrs.push(ba);
        }
        consumed.add(ba);
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
