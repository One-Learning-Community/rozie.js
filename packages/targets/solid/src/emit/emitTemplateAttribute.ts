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
import type {
  IRComponent,
  AttributeBinding,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface EmitAttrCtx {
  ir: IRComponent;
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector };
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

function renderExpr(expr: t.Expression, ir: IRComponent): string {
  return rewriteTemplateExpression(expr, ir);
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
function composeClassValue(attrs: AttributeBinding[], ir: IRComponent): string {
  // Single static → plain string
  if (attrs.length === 1 && attrs[0]!.kind === 'static') {
    return renderStaticClassValue(attrs[0]!.value);
  }

  // Single binding (object-form) — emit as clsx equivalent
  if (attrs.length === 1 && attrs[0]!.kind === 'binding') {
    const a = attrs[0]!;
    if (t.isObjectExpression(a.expression)) {
      // Object form: { active: isActive } → keep as-is (no styles lookup)
      return renderExpr(a.expression, ir);
    }
    return renderExpr(a.expression, ir);
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
        lit += '${' + renderExpr(seg.expression, ir) + '}';
      }
    }
    return '`' + lit + '`';
  }

  // Multi-source — join with spaces using template literal or string concat
  const parts: string[] = [];
  for (const a of attrs) {
    if (a.kind === 'static') {
      parts.push(renderStaticClassValue(a.value));
    } else if (a.kind === 'binding') {
      parts.push(renderExpr(a.expression, ir));
    } else {
      let lit = '';
      for (const seg of a.segments) {
        if (seg.kind === 'static') {
          lit += seg.text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
        } else {
          lit += '${' + renderExpr(seg.expression, ir) + '}';
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
    const jsxName = colonPropToSolidName(attr.name);
    const exprCode = renderExpr(attr.expression, ctx.ir);
    return { jsx: `${jsxName}={${exprCode}}`, diagnostics };
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
        const classValue = composeClassValue(classStrAttrs, ctx.ir);
        out.push(`class={${classValue}}`);
      }
      // Emit `classList=` for each object-form `:class` binding.
      for (const cla of classListAttrs) {
        const exprCode = renderExpr((cla as Extract<AttributeBinding, { kind: 'binding' }>).expression, ctx.ir);
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
