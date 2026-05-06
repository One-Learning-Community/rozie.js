/**
 * emitTemplateNode — Phase 5 Plan 05-04a Task 2.
 *
 * Recursive switch over the IR's TemplateNode discriminated union, producing
 * Angular 17+ template string fragments per RESEARCH Pattern 9 emission map:
 *
 *   - r-if/r-else-if/r-else        → @if (x) {...} @else if (y) {...} @else {...}
 *   - r-for + :key                 → @for (item of items; track item.id) {...}
 *   - r-for missing :key           → ROZ720 error (Pitfall 3)
 *   - r-show                       → [style.display]="x ? '' : 'none'"
 *   - r-html                       → [innerHTML]="expr"; ROZ721 if children
 *   - r-text                       → {{ expr }}
 *   - {{ expr }} interpolation     → {{ expr }} (identical)
 *   - @event handler               → (event)="handler($event)"
 *   - <slot ...>                   → *ngTemplateOutlet (see emitSlotInvocation)
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  Listener,
  AttributeBinding,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { emitAttributes, findRHtml, findRShow } from './emitTemplateAttribute.js';
import { emitTemplateEvent, type AngularScriptInjection } from './emitTemplateEvent.js';
import { emitSlotInvocation } from './emitSlotInvocation.js';
import { emitConditional } from './emitConditional.js';

/** HTML void elements. */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'source', 'track', 'wbr',
]);

export interface EmitNodeCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
  /** Class-body field declarations to inject (debounce/throttle wrappers, guarded methods). */
  scriptInjections: AngularScriptInjection[];
  /** Per-component counter shared across events for stable wrap-name suffixes. */
  injectionCounter: { next: number };
  /**
   * Whether the template has produced at least one [(ngModel)] binding —
   * drives FormsModule conditional import in emitDecorator.
   */
  hasNgModel: { value: boolean };
  /** Collision-renames from rewriteScript. */
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  /** Loop-local bindings (name -> presence) accumulated during recursion. */
  loopBindings?: Set<string> | undefined;
}

function emitStaticText(node: TemplateStaticTextIR): string {
  return node.text;
}

function emitInterpolation(
  node: TemplateInterpolationIR,
  ctx: EmitNodeCtx,
): string {
  const expr = rewriteTemplateExpression(node.expression, ctx.ir, {
    collisionRenames: ctx.collisionRenames,
    loopBindings: ctx.loopBindings,
  });
  return `{{ ${expr} }}`;
}

function emitFragment(
  node: TemplateFragmentIR,
  ctx: EmitNodeCtx,
): string {
  return node.children.map((c) => emitNode(c, ctx)).join('');
}

/**
 * Emit a TemplateLoop as `@for (item of items(); track item.id) { ... }`.
 *
 * Pitfall 3 mitigation: when keyExpression is null, raise ROZ720 (Angular
 * compiler requires `track` in `@for` blocks). We still emit a fallback
 * `track $index` so the output parses, but the diagnostic is an ERROR.
 */
function emitLoop(node: TemplateLoopIR, ctx: EmitNodeCtx): string {
  // Track loop-local bindings so rewriteTemplateExpression doesn't apply
  // class-member rewrites to them.
  const childBindings = new Set(ctx.loopBindings ?? []);
  childBindings.add(node.itemAlias);
  if (node.indexAlias) childBindings.add(node.indexAlias);

  const childCtx: EmitNodeCtx = { ...ctx, loopBindings: childBindings };

  const iter = rewriteTemplateExpression(node.iterableExpression, ctx.ir, {
    collisionRenames: ctx.collisionRenames,
    loopBindings: ctx.loopBindings,
  });

  let trackExpr: string;
  if (node.keyExpression === null) {
    // Pitfall 3: ROZ720.
    ctx.diagnostics.push({
      code: RozieErrorCode.TARGET_ANGULAR_RFOR_MISSING_KEY,
      severity: 'error',
      message: `r-for missing :key — Angular's @for block requires a track expression. Add :key="..." to the loop element.`,
      loc: node.sourceLoc,
    });
    trackExpr = '$index';
  } else {
    trackExpr = rewriteTemplateExpression(node.keyExpression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: childBindings,
    });
  }

  const loopVarDecl = node.indexAlias
    ? `${node.itemAlias} of ${iter}; track ${trackExpr}; let ${node.indexAlias} = $index`
    : `${node.itemAlias} of ${iter}; track ${trackExpr}`;

  // Strip `:key` from the inner element to avoid duplicate emission.
  const stripKey = (n: TemplateNode): TemplateNode => {
    if (n.type !== 'TemplateElement') return n;
    return {
      ...n,
      attributes: n.attributes.filter(
        (a) => !(a.kind === 'binding' && a.name === 'key'),
      ),
    };
  };

  const innerNodes = node.body.map(stripKey);
  const inner = innerNodes.map((c) => emitNode(c, childCtx)).join('');

  return `@for (${loopVarDecl}) {\n${inner}\n}`;
}

/**
 * Emit element events. Handles multiple listeners on same DOM event by
 * letting Angular accept multiple `(event)="..."` bindings — Angular's
 * template compiler does NOT enforce attribute uniqueness for outputs. So
 * each Listener emits independently.
 *
 * Wait — actually Angular DOES enforce uniqueness. Let me check: Angular 17
 * disallows duplicate `(event)` bindings on the same element (template parse
 * error). We need to merge same-event handlers into a single binding.
 */
function emitEvents(events: Listener[], ctx: EmitNodeCtx): string {
  if (events.length === 0) return '';

  // Group by lowercase event name.
  const groups = new Map<string, Listener[]>();
  for (const ev of events) {
    const key = ev.event.toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(ev);
    groups.set(key, list);
  }

  const out: string[] = [];

  for (const [eventName, group] of groups) {
    if (group.length === 1) {
      const result = emitTemplateEvent(group[0]!, {
        ir: ctx.ir,
        registry: ctx.registry,
        injectionCounter: ctx.injectionCounter,
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
      });
      out.push(result.eventAttr);
      if (result.scriptInjection) ctx.scriptInjections.push(result.scriptInjection);
      for (const d of result.diagnostics) ctx.diagnostics.push(d);
      continue;
    }

    // Multiple listeners on same event — synthesize ONE `(event)="..."` binding
    // via a class-body wrapper method that runs each listener's body.
    const wrapperName = `_merged_${eventName}_${ctx.injectionCounter.next++}`;
    const guardLines: string[] = [];

    for (const ev of group) {
      const sub = emitTemplateEvent(ev, {
        ir: ctx.ir,
        registry: ctx.registry,
        injectionCounter: ctx.injectionCounter,
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
      });
      if (sub.scriptInjection) ctx.scriptInjections.push(sub.scriptInjection);
      for (const d of sub.diagnostics) ctx.diagnostics.push(d);

      // Extract the inner attrValue from `(event)="X"` so we can splice it
      // into the merged wrapper.
      const m = sub.eventAttr.match(/^\([a-zA-Z]+\)="(.*)"$/);
      if (!m) continue;
      let inner = m[1]!;
      // The handler invocation references identifiers that need `this.` prefix
      // when emitted at class-body level (template implicit-this doesn't apply
      // inside class methods). Quick rewrite: bare identifier callees → `this.X`.
      // This is a v1 heuristic — works for the reference examples (handlers
      // are bare identifiers like `onSearch`, `clear`, `close`).
      inner = inner.replace(
        /\b([a-zA-Z_$][\w$]*)\(\$event\)/g,
        (_match, fn: string) => {
          if (fn === 'this') return _match;
          // The collision-renamed user methods already carry `_` prefix from
          // rewriteScript — keep that as-is, just add `this.`.
          return `this.${fn}($event)`;
        },
      );
      // Replace `$event` -> `e` for the wrapper signature.
      inner = inner.replace(/\$event/g, 'e');
      guardLines.push(`  ${inner};`);
    }

    const decl = [
      `private ${wrapperName} = (e: any) => {`,
      ...guardLines,
      `};`,
    ].join('\n');
    ctx.scriptInjections.push({ name: wrapperName, decl });

    out.push(`(${eventName})="${wrapperName}($event)"`);
  }

  return out.join(' ');
}

/**
 * Emit a TemplateElement. Walks attributes, events; renders children.
 */
function emitElement(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  // Detect ngModel binding (either [(ngModel)] shorthand or [ngModel]/(ngModelChange)
  // long form) for FormsModule wiring. r-model on form-input always lowers to one of
  // these in emitTemplateAttribute → r-model presence on form-input tag triggers it.
  for (const a of node.attributes) {
    if (
      a.kind === 'binding' &&
      a.name === 'r-model' &&
      isFormInputTag(node.tagName)
    ) {
      ctx.hasNgModel.value = true;
      break;
    }
  }

  const attrText = emitAttributes(node.attributes, {
    ir: ctx.ir,
    collisionRenames: ctx.collisionRenames,
    loopBindings: ctx.loopBindings,
  }, node.tagName);
  const eventText = emitEvents(node.events, ctx);
  const rHtml = findRHtml(node.attributes);
  const rShow = findRShow(node.attributes);

  // Filter r-html and r-show out of the attribute set we already emitted —
  // we'll add them as Angular property bindings here.
  // (emitAttributes already filters r-html; r-show needs separate handling.)
  const partsHead: string[] = [];
  if (attrText) partsHead.push(attrText);
  if (eventText) partsHead.push(eventText);

  if (rShow !== null) {
    const expr = rewriteTemplateExpression(rShow.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
    });
    partsHead.push(`[style.display]="(${expr}) ? '' : 'none'"`);
  }

  const head = partsHead.length > 0 ? ' ' + partsHead.join(' ') : '';

  // r-html: emit as [innerHTML]="..."
  if (rHtml !== null) {
    if (node.children.length > 0) {
      ctx.diagnostics.push({
        code: RozieErrorCode.TARGET_ANGULAR_RHTML_WITH_CHILDREN, // ROZ721
        severity: 'error',
        message: `r-html cannot coexist with template children on the same element. Move r-html to a child element or remove the children.`,
        loc: node.sourceLoc,
      });
    }
    const expr = rewriteTemplateExpression(rHtml.expression, ctx.ir, {
      collisionRenames: ctx.collisionRenames,
      loopBindings: ctx.loopBindings,
    });
    return `<${node.tagName}${head} [innerHTML]="${expr}"></${node.tagName}>`;
  }

  const isVoid = VOID_ELEMENTS.has(node.tagName.toLowerCase());

  if (node.children.length === 0) {
    if (isVoid) return `<${node.tagName}${head} />`;
    return `<${node.tagName}${head}></${node.tagName}>`;
  }

  const inner = node.children.map((c) => emitNode(c, ctx)).join('');
  return `<${node.tagName}${head}>${inner}</${node.tagName}>`;
}

function isFormInputTag(tagName: string): boolean {
  const lc = tagName.toLowerCase();
  return lc === 'input' || lc === 'select' || lc === 'textarea';
}

/** Top-level dispatch over TemplateNode discriminator. */
export function emitNode(node: TemplateNode, ctx: EmitNodeCtx): string {
  switch (node.type) {
    case 'TemplateStaticText':
      return emitStaticText(node);
    case 'TemplateInterpolation':
      return emitInterpolation(node, ctx);
    case 'TemplateFragment':
      return emitFragment(node, ctx);
    case 'TemplateConditional':
      return emitConditional(node as TemplateConditionalIR, ctx, emitNode);
    case 'TemplateLoop':
      return emitLoop(node, ctx);
    case 'TemplateSlotInvocation':
      return emitSlotInvocation(node as TemplateSlotInvocationIR, {
        ir: ctx.ir,
        emitChildren: (children) => children.map((c) => emitNode(c, ctx)).join(''),
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
        scriptInjections: ctx.scriptInjections,
        injectionCounter: ctx.injectionCounter,
      });
    case 'TemplateElement':
      return emitElement(node, ctx);
    default: {
      const _exhaustive: never = node;
      void _exhaustive;
      return '';
    }
  }
}

// Re-export for emitTemplate consumers.
export type { AttributeBinding };
