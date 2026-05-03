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
import type {
  IRComponent,
  AttributeBinding,
  RefDecl,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

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
 * Detect whether an expression's source-text is an object-literal expression
 * (e.g., `{ active: isActive }`). Used to route :class={...} to the
 * `clsx({...})` form per RESEARCH Pattern 6 line 713.
 */
function isObjectLiteralExpression(expr: t.Expression): boolean {
  return t.isObjectExpression(expr);
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

    // Use computed-key form `[styles.<key>]: value`. For keys with hyphens,
    // bracket-quote: `[styles['key-name']]`.
    const stylesLookup = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(keyText)
      ? `styles.${keyText}`
      : `styles[${JSON.stringify(keyText)}]`;
    propStrings.push(`[${stylesLookup}]: ${valueText}`);
  }
  return `{ ${propStrings.join(', ')} }`;
}

/**
 * Render a value as `styles.X` lookup (single static class) or as a
 * template literal segment for multi-static / interpolated classes.
 */
function renderStaticClassLookup(className: string): string {
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
    if (a.kind === 'static') {
      const tokens = a.value.split(/\s+/).filter(Boolean);
      segments.push({ kind: 'staticTokens', tokens });
    } else if (a.kind === 'binding') {
      if (isObjectLiteralExpression(a.expression)) {
        segments.push({ kind: 'objectBinding', expr: a.expression as t.ObjectExpression });
      } else {
        segments.push({ kind: 'plainBinding', expr: a.expression });
      }
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
      return renderStaticClassLookup(seg.tokens[0]!);
    }
    // Multi static → backtick template literal
    const parts = seg.tokens.map((tok) => '${' + renderStaticClassLookup(tok) + '}').join(' ');
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
      // Each static token becomes a styles.X arg
      for (const tok of s.tokens) {
        clsxArgs.push(renderStaticClassLookup(tok));
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
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
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

  // Build template-literal-friendly representations
  const renderedTokens = tokens.map((tok) => {
    // Pure-static token → styles.X lookup
    if (tok.parts.length === 1 && tok.parts[0]!.kind === 'static') {
      return '${' + renderStaticClassLookup(tok.parts[0]!.text) + '}';
    }
    // Composite token (mix of static + binding) → styles[`<token-template>`]
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
    return '${styles[`' + inner + '`]}';
  });

  // Join tokens with single spaces
  return '`' + renderedTokens.join(' ') + '`';
}

/**
 * Group attributes by name, returning a Map for lookup.
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
  if (attr.kind === 'static') {
    // Apply HTML→JSX alias for special-cased names (tabindex → tabIndex, etc.)
    const jsxName = htmlAttrToJsxName(attr.name);
    // Coerce known-numeric DOM attrs to JSX expression form: tabindex="-1" → tabIndex={-1}
    if (NUMERIC_HTML_ATTRS.has(attr.name.toLowerCase()) && /^-?\d+(?:\.\d+)?$/.test(attr.value)) {
      return { jsx: `${jsxName}={${attr.value}}`, diagnostics };
    }
    return { jsx: `${jsxName}="${escapeJsxAttrLiteral(attr.value)}"`, diagnostics };
  }

  if (attr.kind === 'binding') {
    // ':name="expr"' → camelCased JSX name + expression value
    const jsxName = colonPropToJsxName(attr.name);
    const exprCode = renderExpr(attr.expression, ctx.ir);
    return { jsx: `${jsxName}={${exprCode}}`, diagnostics };
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

  for (const a of attrs) {
    if (consumed.has(a)) continue;

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
      if (classAttrs.length === 0) continue;
      const classNameValue = composeClassName(classAttrs, ctx);
      out.push(`className={${classNameValue}}`);
      continue;
    }

    const result = emitNonClassAttribute(a, ctx);
    out.push(result.jsx);
    for (const d of result.diagnostics) diagnostics.push(d);
    consumed.add(a);
  }

  return { jsx: out.join(' '), diagnostics };
}
