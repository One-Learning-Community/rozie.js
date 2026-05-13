/**
 * emitTemplate — Lit target (Plan 06.4-02 Task 1).
 *
 * Walks the IR template tree and produces a Lit `html\`...\`` template literal
 * body (the part that goes inside the backticks). Coordinates:
 *
 *   - `r-for` → `${repeat(items, (item, index) => html\`...\`, (item) => item.key)}`
 *   - `r-if/r-else` → `${cond ? html\`...\` : html\`...\`}` (or `nothing` for empty)
 *   - `:prop="expr"` → `.prop=${expr}` (property binding)
 *   - boolean attr → `?attr=${expr}` (Lit boolean attr sigil)
 *   - `class=` / `style=` → static "..."
 *   - `@event="fn"` → `@event=${(e) => fn(e)}` (handler binding)
 *   - r-model on form input → `.value=${this.X.value} @input=${(e) => this.X.value = e.target.value}`
 *   - composition tag `<Foo>` → `<rozie-foo>...</rozie-foo>`
 *   - `<slot>` → `<slot name="..."></slot>` with data-rozie-params transport for scoped slots
 *   - `{{ expr }}` → `${expr}` (lit-html auto-escapes by default — T-06.4-03)
 *
 * @experimental — shape may change before v1.0
 */
import * as bt from '@babel/types';
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateFragmentIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  AttributeBinding,
  Listener,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type {
  LitImportCollector,
  LitDecoratorImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { toKebabCase } from './emitDecorator.js';

export interface EmitTemplateOpts {
  lit: LitImportCollector;
  decorators: LitDecoratorImportCollector;
  runtime: RuntimeLitImportCollector;
}

export interface EmitTemplateResult {
  /** Body to embed inside `html\`...\``. */
  renderBody: string;
  /** Host-listener wiring strings (D-LIT-12) spliced into firstUpdated. */
  hostListenerWiring: string[];
  diagnostics: Diagnostic[];
}

/** True when the handler IR expression is already a function reference / arrow. */
function isHandlerLike(expr: bt.Expression): boolean {
  if (bt.isArrowFunctionExpression(expr)) return true;
  if (bt.isFunctionExpression(expr)) return true;
  if (bt.isIdentifier(expr)) return true;
  if (bt.isMemberExpression(expr)) return true; // `this.fn`
  return false;
}

const FORM_INPUT_TAGS = new Set(['input', 'textarea', 'select']);
const BOOLEAN_ATTRS = new Set([
  'disabled',
  'checked',
  'readonly',
  'required',
  'autofocus',
  'hidden',
  'open',
  'multiple',
  'selected',
]);

/**
 * For a TemplateElement with composition kind, return the tag name we emit
 * into the html`` template:
 *   - tagKind: 'html'      → tagName verbatim
 *   - tagKind: 'component' → 'rozie-<kebab>'
 *   - tagKind: 'self'      → 'rozie-<kebab-of-component-name>' (host class)
 */
function resolveTagName(node: TemplateElementIR, irName: string): string {
  if (node.tagKind === 'component') {
    return `rozie-${toKebabCase(node.tagName)}`;
  }
  if (node.tagKind === 'self') {
    return `rozie-${toKebabCase(irName)}`;
  }
  return node.tagName;
}

function emitInterpolation(
  node: TemplateInterpolationIR,
  ir: IRComponent,
): string {
  const code = rewriteTemplateExpression(node.expression, ir);
  return `\${${code}}`;
}

function emitStaticText(node: TemplateStaticTextIR): string {
  // Static text — lit-html escapes interpolated values but leaves raw HTML
  // characters in static segments alone. Preserve byte-for-byte.
  return node.text;
}

function attributeIsRModel(attr: AttributeBinding): boolean {
  return attr.name === 'r-model';
}

function emitAttribute(
  attr: AttributeBinding,
  ir: IRComponent,
  tagName: string,
): string {
  if (attr.kind === 'static') {
    // Pass through static attribute as-is.
    return `${attr.name}="${attr.value}"`;
  }

  if (attr.kind === 'binding') {
    // r-model handled separately (paired with @input + .value).
    if (attributeIsRModel(attr)) return '';

    const expr = rewriteTemplateExpression(attr.expression, ir);

    // Boolean attribute prefix.
    if (BOOLEAN_ATTRS.has(attr.name)) {
      return `?${attr.name}=\${${expr}}`;
    }

    // Property bindings: .prop = ${expr} for form-input value/checked etc.
    if (
      (attr.name === 'value' || attr.name === 'checked') &&
      FORM_INPUT_TAGS.has(tagName)
    ) {
      return `.${attr.name}=\${${expr}}`;
    }

    // Default: attribute binding (Lit auto-coerces values to string).
    return `${attr.name}=\${${expr}}`;
  }

  if (attr.kind === 'interpolated') {
    // Mix of static + binding segments → emit as a single attribute value
    // built from string concatenation interpolation.
    const parts = attr.segments.map((seg) => {
      if (seg.kind === 'static') return seg.text;
      const code = rewriteTemplateExpression(seg.expression, ir);
      return `\${${code}}`;
    });
    return `${attr.name}="${parts.join('')}"`;
  }
  return '';
}

function buildRModelBindings(
  rModelAttr: AttributeBinding,
  ir: IRComponent,
  tagName: string,
): string {
  if (rModelAttr.kind !== 'binding') return '';

  const code = rewriteTemplateExpression(rModelAttr.expression, ir);
  // For checkbox inputs use .checked; otherwise .value.
  // We can't statically detect input[type=checkbox] reliably; use value as
  // the v1 default (matches React/Solid behavior). Test data inputs use text.
  void tagName;
  return [
    `.value=\${${code}}`,
    `@input=\${(e) => ${code} = (e.target as HTMLInputElement).value}`,
  ].join(' ');
}

function emitEventListener(listener: Listener, ir: IRComponent): string {
  const eventName = listener.event;
  const handler = rewriteTemplateExpression(listener.handler, ir);

  // Detect inlineGuard / native flags from the modifier pipeline.
  let inlineGuards: string[] = [];
  let captureOpt = false;
  let passiveOpt = false;
  let onceOpt = false;

  for (const entry of listener.modifierPipeline) {
    if (entry.kind === 'listenerOption') {
      if (entry.option === 'capture') captureOpt = true;
      if (entry.option === 'passive') passiveOpt = true;
      if (entry.option === 'once') onceOpt = true;
    }
    if (entry.kind === 'filter' || entry.kind === 'wrap') {
      if (entry.modifier === 'stop') inlineGuards.push('e.stopPropagation();');
      else if (entry.modifier === 'prevent') inlineGuards.push('e.preventDefault();');
      else if (entry.modifier === 'self')
        inlineGuards.push('if (e.target !== e.currentTarget) return;');
      else if (entry.modifier === 'enter')
        inlineGuards.push("if ((e as KeyboardEvent).key !== 'Enter') return;");
      else if (entry.modifier === 'escape' || entry.modifier === 'esc')
        inlineGuards.push("if ((e as KeyboardEvent).key !== 'Escape') return;");
      else if (entry.modifier === 'tab')
        inlineGuards.push("if ((e as KeyboardEvent).key !== 'Tab') return;");
    }
  }

  // Wrap inline expressions (non-function-like) as arrow handlers so they
  // run at event time, not at render time. Function references and arrows
  // are passed verbatim.
  const isFunctionLike = isHandlerLike(listener.handler);
  let body: string;
  if (inlineGuards.length > 0) {
    if (isFunctionLike) {
      body = `(e: Event) => { ${inlineGuards.join(' ')} (${handler})(e); }`;
    } else {
      body = `(e: Event) => { ${inlineGuards.join(' ')} ${handler}; }`;
    }
  } else {
    body = isFunctionLike ? `${handler}` : `(e: Event) => { ${handler}; }`;
  }

  const optionParts: string[] = [];
  if (captureOpt) optionParts.push('capture: true');
  if (passiveOpt) optionParts.push('passive: true');
  if (onceOpt) optionParts.push('once: true');

  // Lit's @event syntax doesn't support options inline — it always uses
  // bubbling phase by default. For capture/passive/once we still use @event
  // but pass `addEventListener` options via a tuple. Lit accepts an object
  // `{ handleEvent, capture, passive, once }`.
  if (optionParts.length > 0) {
    const opts = optionParts.join(', ');
    return `@${eventName}=\${{ handleEvent: ${body}, ${opts} }}`;
  }
  return `@${eventName}=\${${body}}`;
}

function emitElementOpenTag(
  node: TemplateElementIR,
  ir: IRComponent,
  irName: string,
  opts: EmitTemplateOpts,
): { open: string; selfClose: boolean } {
  const tagName = resolveTagName(node, irName);
  const parts: string[] = [];

  // refs: add data-rozie-ref="<name>" attribute (matches @query selector).
  let refAttr: string | null = null;

  const rModelAttr = node.attributes.find((a) => attributeIsRModel(a));

  // Collect class-related attributes so we can merge static + binding into a
  // single classMap call when both are present.
  const staticClassValues: string[] = [];
  let bindingClass: AttributeBinding | null = null;
  for (const attr of node.attributes) {
    if (attr.name === 'class') {
      if (attr.kind === 'static') {
        staticClassValues.push(attr.value);
      } else if (attr.kind === 'binding') {
        bindingClass = attr;
      } else if (attr.kind === 'interpolated') {
        bindingClass = attr;
      }
    }
  }
  if (bindingClass !== null) {
    // Use classMap for object-bindings.
    if (
      bindingClass.kind === 'binding' &&
      bt.isObjectExpression(bindingClass.expression) &&
      staticClassValues.length > 0
    ) {
      // Augment the object with static keys.
      const obj = bindingClass.expression;
      for (const value of staticClassValues) {
        for (const cls of value.split(/\s+/)) {
          if (!cls) continue;
          obj.properties.unshift(
            bt.objectProperty(bt.stringLiteral(cls), bt.booleanLiteral(true)),
          );
        }
      }
      opts.lit; // tracked elsewhere
      const expr = rewriteTemplateExpression(bindingClass.expression, ir);
      // Render as a QUOTED attribute binding — lit-html requires string-concatenation
      // interpolations to appear inside quoted attribute values (CR-01 fix).
      parts.push(
        `class="\${Object.entries(${expr}).filter(([, v]) => v).map(([k]) => k).join(' ')}"`,
      );
    } else if (bindingClass.kind === 'binding') {
      const expr = rewriteTemplateExpression(bindingClass.expression, ir);
      const staticPart = staticClassValues.length > 0
        ? `${staticClassValues.join(' ')} `
        : '';
      // Use quoted attribute — lit-html requires quotes for mixed static+dynamic values (CR-01 fix).
      parts.push(`class="${staticPart}\${(${expr})}"`);
    } else if (bindingClass.kind === 'interpolated') {
      const emitted = emitAttribute(bindingClass, ir, node.tagName);
      if (emitted) parts.push(emitted);
    }
  } else if (staticClassValues.length > 0) {
    parts.push(`class="${staticClassValues.join(' ')}"`);
  }

  for (const attr of node.attributes) {
    if (attr.name === 'class') continue;
    if (attr.kind === 'static' && attr.name === 'ref') {
      refAttr = `data-rozie-ref="${attr.value}"`;
      continue;
    }
    if (attributeIsRModel(attr)) continue;
    const emitted = emitAttribute(attr, ir, node.tagName);
    if (emitted) parts.push(emitted);
  }

  if (rModelAttr) {
    parts.push(buildRModelBindings(rModelAttr, ir, node.tagName));
  }

  for (const event of node.events) {
    parts.push(emitEventListener(event, ir));
  }

  if (refAttr) parts.push(refAttr);

  const attrsText = parts.length > 0 ? ' ' + parts.join(' ') : '';
  const isVoid = isVoidElement(node.tagName);
  if (isVoid && node.children.length === 0) {
    return { open: `<${tagName}${attrsText} />`, selfClose: true };
  }
  return { open: `<${tagName}${attrsText}>`, selfClose: false };
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'source', 'track', 'wbr',
]);
function isVoidElement(tagName: string): boolean {
  return VOID_ELEMENTS.has(tagName);
}

function emitNode(
  node: TemplateNode,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  switch (node.type) {
    case 'TemplateInterpolation':
      return emitInterpolation(node, ir);
    case 'TemplateStaticText':
      return emitStaticText(node);
    case 'TemplateElement':
      return emitElement(node, ir, hostListenerWiring, opts);
    case 'TemplateConditional':
      return emitConditional(node, ir, hostListenerWiring, opts);
    case 'TemplateLoop':
      return emitLoop(node, ir, hostListenerWiring, opts);
    case 'TemplateSlotInvocation':
      return emitSlot(node, ir, hostListenerWiring, opts);
    case 'TemplateFragment':
      return emitFragment(node, ir, hostListenerWiring, opts);
    default:
      return '';
  }
}

function emitElement(
  node: TemplateElementIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  const tagName = resolveTagName(node, ir.name);
  const { open, selfClose } = emitElementOpenTag(node, ir, ir.name, opts);
  if (selfClose) return open;
  const children = node.children
    .map((c) => emitNode(c, ir, hostListenerWiring, opts))
    .join('');
  return `${open}${children}</${tagName}>`;
}

function emitConditional(
  node: TemplateConditionalIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  // Render as nested ternary chain.
  // branches[0] = if-branch, branches[1+] = else-if branches, last (test:null) = else.
  let result = '';
  let hasElse = false;
  for (let i = node.branches.length - 1; i >= 0; i--) {
    const branch = node.branches[i]!;
    const body = branch.body
      .map((c) => emitNode(c, ir, hostListenerWiring, opts))
      .join('');
    if (branch.test === null) {
      result = `html\`${body}\``;
      hasElse = true;
    } else {
      const cond = rewriteTemplateExpression(branch.test, ir);
      const truthy = `html\`${body}\``;
      const falsy = result.length > 0 ? result : 'nothing';
      result = `${cond} ? ${truthy} : ${falsy}`;
    }
  }
  if (!hasElse) {
    // No else — need `nothing` import.
    opts.lit.add('nothing');
  }
  return `\${${result}}`;
}

function emitLoop(
  node: TemplateLoopIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  opts.lit.add('html');
  // Import repeat directive — registered via a side-effect import on lit/directives/repeat.js.
  // We mark it on lit collector but the rendered import line comes via lit/directives/repeat.js;
  // for v1 we emit a `{ repeat }` value import line manually outside the lit collector.
  // We can't track it in the lit collector (different module). Emit a marker via runtime
  // collector? No — emit a separate top-of-file line. We register through a global stash:
  // simplest path is to emit a `import { repeat } from 'lit/directives/repeat.js';` later
  // in the shell. We'll signal via a side channel: emit a token that emitLit picks up.
  opts.lit.add('html'); // ensure html is in
  // We add 'PropertyValues' as a placeholder marker — actually we'll just rely on a
  // dedicated runtime mechanism via the import collector's side channels (see below).
  REPEAT_USED.value = true;

  const items = rewriteTemplateExpression(node.iterableExpression, ir);
  const item = node.itemAlias;
  const idx = node.indexAlias ?? '_idx';
  const body = node.body
    .map((c) => emitNode(c, ir, hostListenerWiring, opts))
    .join('');
  const keyExpr = node.keyExpression
    ? rewriteTemplateExpression(node.keyExpression, ir)
    : `${item}`;
  // The key expression is in the *child* scope (item alias) — rewrite must
  // already have run if it references signal/state. We render the raw item alias
  // for `(item) => item.id`.
  const keyFn = node.keyExpression
    ? `(${item}) => ${keyExpr.replace(/\bthis\.[\w$]+\.value\b/g, item)}`
    : `(${item}) => ${item}`;
  return `\${repeat(${items}, ${keyFn}, (${item}, ${idx}) => html\`${body}\`)}`;
}

// Module-level latch to communicate "we used repeat()" back to the orchestrator.
// We piggyback through a singleton imported by emitLit; in v2 we should
// thread this through opts. For now, a flag the orchestrator inspects via the
// LitImportCollector subtype is enough.
export const REPEAT_USED = { value: false };

function emitSlot(
  node: TemplateSlotInvocationIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  void opts;
  // Determine name + args.
  const name = node.slotName === '' ? '' : node.slotName;
  const fallbackChildren = node.fallback
    .map((c) => emitNode(c, ir, hostListenerWiring, opts))
    .join('');

  // Identify the function-name set: top-level methods + arrow consts.
  const methodNameSet = collectMethodNamesFromIR(ir);

  const dataAttrs: string[] = [];
  if (node.args.length > 0) {
    const dataEntries: string[] = [];
    for (const arg of node.args) {
      // Determine if this is function-typed based on the IR expression's
      // shape, NOT a regex on the rewritten code. Function-typed IR shapes:
      //   - ArrowFunctionExpression / FunctionExpression
      //   - Identifier referencing a known method name
      //   - MemberExpression whose property is a known method name
      let isFnLike = false;
      const expr = arg.expression;
      if (bt.isArrowFunctionExpression(expr) || bt.isFunctionExpression(expr)) {
        isFnLike = true;
      } else if (bt.isIdentifier(expr) && methodNameSet.has(expr.name)) {
        isFnLike = true;
      }

      const argCode = rewriteTemplateExpression(arg.expression, ir);
      if (isFnLike) {
        const evt = `rozie-${name || 'default'}-${arg.name}`;
        hostListenerWiring.push(
          `this.addEventListener('${evt}', (e) => { (${argCode})((e as CustomEvent).detail); });`,
        );
      } else {
        dataEntries.push(`${arg.name}: ${argCode}`);
      }
    }
    if (dataEntries.length > 0) {
      const obj = `{${dataEntries.join(', ')}}`;
      // Wrap in try/catch so non-JSON-safe values (BigInt, circular, undefined)
      // don't crash the render — CR-02 fix.
      dataAttrs.push(`data-rozie-params=\${(() => { try { return JSON.stringify(${obj}); } catch { return '{}'; } })()}`);
    }
  }

  const slotName = name.length > 0 ? ` name="${name}"` : '';
  const dataStr = dataAttrs.length > 0 ? ' ' + dataAttrs.join(' ') : '';

  if (fallbackChildren.trim().length > 0) {
    return `<slot${slotName}${dataStr}>${fallbackChildren}</slot>`;
  }
  return `<slot${slotName}${dataStr}></slot>`;
}

function collectMethodNamesFromIR(ir: IRComponent): Set<string> {
  const names = new Set<string>();
  const reserved = new Set<string>([
    ...ir.state.map((s) => s.name),
    ...ir.computed.map((c) => c.name),
    ...ir.refs.map((r) => r.name),
    ...ir.props.map((p) => p.name),
  ]);
  for (const stmt of ir.setupBody.scriptProgram.program.body) {
    if (bt.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (bt.isIdentifier(decl.id) && !reserved.has(decl.id.name)) {
          if (
            decl.init &&
            bt.isCallExpression(decl.init) &&
            bt.isIdentifier(decl.init.callee) &&
            decl.init.callee.name === '$computed'
          ) {
            continue;
          }
          if (
            decl.init &&
            (bt.isArrowFunctionExpression(decl.init) ||
              bt.isFunctionExpression(decl.init))
          ) {
            names.add(decl.id.name);
          }
        }
      }
    } else if (bt.isFunctionDeclaration(stmt) && stmt.id && !reserved.has(stmt.id.name)) {
      names.add(stmt.id.name);
    }
  }
  return names;
}

function emitFragment(
  node: TemplateFragmentIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  return node.children
    .map((c) => emitNode(c, ir, hostListenerWiring, opts))
    .join('');
}

export function emitTemplate(
  ir: IRComponent,
  opts: EmitTemplateOpts,
): EmitTemplateResult {
  const diagnostics: Diagnostic[] = [];
  const hostListenerWiring: string[] = [];
  REPEAT_USED.value = false;

  if (!ir.template) {
    return { renderBody: '', hostListenerWiring, diagnostics };
  }

  const body = emitNode(ir.template, ir, hostListenerWiring, opts);

  // If repeat() was used anywhere, the orchestrator needs to know to add
  // `import { repeat } from 'lit/directives/repeat.js';`. We expose this via
  // a flag baked into the lit collector's symbol set as 'svg' (unused otherwise)?
  // Cleaner: emitLit imports REPEAT_USED directly and inspects it after emit.
  // (Doing that is fine because emitTemplate is called from a single thread.)

  return { renderBody: body, hostListenerWiring, diagnostics };
}
