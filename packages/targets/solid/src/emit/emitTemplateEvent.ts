/**
 * emitTemplateEvent — Solid target (P2 complete implementation).
 *
 * Renders a template @event listener as a JSX `onClick={...}` attribute.
 *
 * Solid uses the same camelCase event prop convention as React for JSX events:
 *   @click → onClick
 *   @mouseenter → onMouseEnter
 *   etc.
 *
 * Modifier handling:
 *   - 'inlineGuard' kind → prepend guard code into a synthetic arrow handler
 *   - 'native' kind (capture) → Solid supports `on:click` lowercase for native
 *     addEventListener; for template @event, we use the JSX prop form and
 *     ignore capture/passive (no JSX-level equivalent)
 *   - 'helper' kind (debounce/throttle) → emit `const _rozieDebounced... = createDebouncedHandler(...)`
 *     script injection; reference wrapper name in JSX attribute
 *   - 'helper' .outside → listenerOnly; emit diagnostic
 *
 * Per D-08 collected-not-thrown: never throws; pushes diagnostics.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type {
  IRComponent,
  Listener,
} from '../../../../core/src/ir/types.js';
import type {
  ModifierRegistry,
  SolidEmissionDescriptor,
} from '@rozie/core';
import { isEventModifier } from '@rozie/core';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface EmitEventCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector };
  /** Per-component counter for stable wrap-name suffixes. */
  injectionCounter: { next: number };
  /** Accumulated script injection lines (top-of-body const wrappers). */
  scriptInjections: string[];
  /**
   * Phase 16 R2 / D-03 — loop-accessor identifiers that resolve to a Solid
   * `Accessor<T>` (`() => T`) at runtime and must be invoked when they appear
   * inside an event-handler expression (interpolation / attribute binding
   * paths consult the same set via `EmitNodeCtx.invokeAccessors`). Populated
   * by `emitTemplateNode.ts` inside `<For>` bodies (see the
   * `EmitNodeCtx.invokeAccessors` thread there); threaded through
   * `renderHandler` into `rewriteTemplateExpression`'s `Identifier` visitor
   * which already handles the call-arg branch via
   * `invokeAccessors?.has(name)`.
   */
  invokeAccessors?: ReadonlySet<string> | undefined;
}

export interface EmitTemplateEventResult {
  jsxAttr: string;
  /** Top-of-component-body line (e.g., `const _rozieDebounced... = createDebouncedHandler(...)`). */
  scriptInjection: string | null;
  diagnostics: Diagnostic[];
}

/**
 * DOM event names to their Solid/JSX camelCase prop names.
 * Same as React target — Solid's JSX event props use identical camelCase convention.
 */
const EVENT_NAME_TO_JSX_PROP: Readonly<Record<string, string>> = {
  click: 'onClick',
  dblclick: 'onDblClick',
  mousedown: 'onMouseDown',
  mouseup: 'onMouseUp',
  mousemove: 'onMouseMove',
  mouseover: 'onMouseOver',
  mouseout: 'onMouseOut',
  mouseenter: 'onMouseEnter',
  mouseleave: 'onMouseLeave',
  contextmenu: 'onContextMenu',
  wheel: 'onWheel',
  keydown: 'onKeyDown',
  keyup: 'onKeyUp',
  keypress: 'onKeyPress',
  change: 'onChange',
  input: 'onInput',
  invalid: 'onInvalid',
  reset: 'onReset',
  submit: 'onSubmit',
  focus: 'onFocus',
  blur: 'onBlur',
  focusin: 'onFocusIn',
  focusout: 'onFocusOut',
  compositionstart: 'onCompositionStart',
  compositionend: 'onCompositionEnd',
  compositionupdate: 'onCompositionUpdate',
  select: 'onSelect',
  copy: 'onCopy',
  cut: 'onCut',
  paste: 'onPaste',
  touchstart: 'onTouchStart',
  touchend: 'onTouchEnd',
  touchmove: 'onTouchMove',
  touchcancel: 'onTouchCancel',
  pointerdown: 'onPointerDown',
  pointerup: 'onPointerUp',
  pointermove: 'onPointerMove',
  pointercancel: 'onPointerCancel',
  pointerover: 'onPointerOver',
  pointerout: 'onPointerOut',
  pointerenter: 'onPointerEnter',
  pointerleave: 'onPointerLeave',
  gotpointercapture: 'onGotPointerCapture',
  lostpointercapture: 'onLostPointerCapture',
  drag: 'onDrag',
  dragend: 'onDragEnd',
  dragenter: 'onDragEnter',
  dragexit: 'onDragExit',
  dragleave: 'onDragLeave',
  dragover: 'onDragOver',
  dragstart: 'onDragStart',
  drop: 'onDrop',
  scroll: 'onScroll',
  resize: 'onResize',
  load: 'onLoad',
  error: 'onError',
  abort: 'onAbort',
  canplay: 'onCanPlay',
  canplaythrough: 'onCanPlayThrough',
  durationchange: 'onDurationChange',
  emptied: 'onEmptied',
  encrypted: 'onEncrypted',
  ended: 'onEnded',
  loadeddata: 'onLoadedData',
  loadedmetadata: 'onLoadedMetadata',
  loadstart: 'onLoadStart',
  pause: 'onPause',
  play: 'onPlay',
  playing: 'onPlaying',
  progress: 'onProgress',
  ratechange: 'onRateChange',
  seeked: 'onSeeked',
  seeking: 'onSeeking',
  stalled: 'onStalled',
  suspend: 'onSuspend',
  timeupdate: 'onTimeUpdate',
  volumechange: 'onVolumeChange',
  waiting: 'onWaiting',
  animationstart: 'onAnimationStart',
  animationend: 'onAnimationEnd',
  animationiteration: 'onAnimationIteration',
  transitionend: 'onTransitionEnd',
  beforeinput: 'onBeforeInput',
};

function eventNameToJsxProp(eventName: string): string {
  const lower = eventName.toLowerCase();
  const mapped = EVENT_NAME_TO_JSX_PROP[lower];
  if (mapped) return mapped;
  const parts = eventName.split(/[-_]/).filter(Boolean);
  const cap = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return 'on' + cap;
}

/**
 * Spike-012 NEW-3 — the DOM event-interface name for a synthesized handler
 * param's type annotation. Accepts either a raw event name (`keydown`) or a
 * JSX event prop (`onKeyDown`).
 *
 * WHY a precise type, not `Event`: Solid types every JSX event slot as a UNION
 * (`EventHandlerUnion<T, E>`), and TS provides NO contextual param type from a
 * union of function types — so an un-annotated synthesized `($event) => …` is
 * `noImplicitAny` TS7006. Annotating with the *specific* DOM event both silences
 * TS7006 and lets an inline guard read event-specific props (a key filter reads
 * `$event.key`, which `Event` lacks → TS2339). The specific type is still
 * assignable to the JSX slot (param contravariance: `MouseEvent` ⊇ `MouseEvent &
 * { currentTarget; target }`), so no call site narrows.
 */
export function domEventType(eventOrProp: string): string {
  const s = eventOrProp.replace(/^on/, '').toLowerCase();
  if (s.startsWith('key')) return 'KeyboardEvent';
  if (/^(click|dblclick|mouse|contextmenu|auxclick)/.test(s)) return 'MouseEvent';
  if (s.startsWith('pointer') || s === 'gotpointercapture' || s === 'lostpointercapture') return 'PointerEvent';
  if (s.startsWith('touch')) return 'TouchEvent';
  if (s.startsWith('wheel')) return 'WheelEvent';
  if (s.startsWith('drag') || s === 'drop') return 'DragEvent';
  if (s.startsWith('focus') || s === 'blur') return 'FocusEvent';
  if (s === 'input' || s === 'beforeinput') return 'InputEvent';
  if (s.startsWith('composition')) return 'CompositionEvent';
  if (s.startsWith('animation')) return 'AnimationEvent';
  if (s.startsWith('transition')) return 'TransitionEvent';
  if (s === 'copy' || s === 'cut' || s === 'paste') return 'ClipboardEvent';
  return 'Event';
}

/**
 * Render a ModifierArg as a JS source string for inlining into the wrap call.
 */
function renderModifierArg(arg: ModifierArg): string {
  if (arg.kind === 'literal') {
    return JSON.stringify(arg.value);
  }
  return arg.ref;
}

/**
 * Compose a stable wrap-name for a debounce/throttle wrapper:
 *   _rozieDebounced${Cap} / _rozieThrottled${Cap} / etc.
 */
function makeWrapName(
  helperName: 'createDebouncedHandler' | 'createThrottledHandler',
  handler: t.Expression,
  counter: { next: number },
): string {
  const baseName = t.isIdentifier(handler) ? handler.name : `handler${counter.next}`;
  const cap = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const prefix =
    helperName === 'createDebouncedHandler' ? '_rozieDebounced' : '_rozieThrottled';
  const N = counter.next++;
  return N === 0 ? `${prefix}${cap}` : `${prefix}${cap}_${N}`;
}

function renderHandler(
  handler: t.Expression,
  ir: IRComponent,
  invokeAccessors?: ReadonlySet<string> | undefined,
): string {
  // Phase 16 R2 / D-03 — thread the loop-accessor unwrap set into the
  // template-expression rewriter. The set is sourced from `EmitEventCtx`
  // at each call site and originates in `emitTemplateNode.ts`'s `<For>`
  // body branch. Without it, an `index` alias passed as a CallExpression
  // argument (e.g. `@keydown="fn($event, index)"`) emits the bare accessor
  // function instead of invoking it — the bug SPEC R2 closes.
  return rewriteTemplateExpression(handler, ir, { invokeAccessors });
}

/**
 * Classify the handler shape so we know how to assemble the synthesized arrow.
 * Mirrors the same helper in the Svelte/Angular target emitters.
 *
 *   - 'identifier' — bare ref like `decrement`. Emit as a bare reference;
 *     Solid's JSX runtime calls it with the synthetic event.
 *   - 'callable'   — invokable expression that is NOT itself a call:
 *     MemberExpression (`$props.onClose`, `obj.method`), ArrowFunctionExpression,
 *     FunctionExpression. Wrap in `($event) => { (code)($event); }` so Solid still drives
 *     it with the event. The MemberExpression case is what was broken before
 *     this helper landed: `@click="$props.onClose"` was emitted as
 *     `($event) => { local.onClose; }` (reads but never invokes).
 *   - 'statement'  — already a CallExpression / AssignmentExpression / etc.
 *     Inline verbatim inside the arrow body — the user already wrote the call
 *     (`@click="closeOnBackdrop && close()"`).
 */
function classifyHandler(node: t.Expression): 'identifier' | 'callable' | 'statement' {
  if (t.isIdentifier(node)) return 'identifier';
  if (
    t.isArrowFunctionExpression(node) ||
    t.isFunctionExpression(node) ||
    t.isMemberExpression(node) ||
    t.isOptionalMemberExpression(node)
  ) {
    return 'callable';
  }
  return 'statement';
}

/**
 * Emit a single template @event listener as a JSX attribute for Solid.
 */
export function emitTemplateEvent(
  listener: Listener,
  ctx: EmitEventCtx,
): EmitTemplateEventResult {
  const diagnostics: Diagnostic[] = [];
  const eventName = listener.event;
  const jsxName = eventNameToJsxProp(eventName);
  // Spike-012 NEW-3 — DOM interface for synthesized `$event` param annotations.
  const eventType = domEventType(eventName);

  const inlineGuards: string[] = [];
  let scriptInjection: string | null = null;
  let handlerRef: string | null = null;

  for (const entry of listener.modifierPipeline) {
    let modifierName: string;

    if (entry.kind === 'listenerOption') {
      modifierName = entry.option;
    } else {
      modifierName = entry.modifier;
    }

    const impl = ctx.registry.get(modifierName);
    // Phase 12 / D-01 — narrow the discriminated `ModifierImpl` union to the
    // event-shaped variant before touching the event-only `solid()` hook.
    if (!impl || !isEventModifier(impl)) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_SOLID_RESERVED,
        severity: 'error',
        message: `Modifier '.${modifierName}' has no emitter.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    // Resolve descriptor via the first-class solid() hook.
    if (!impl.solid) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_SOLID_RESERVED,
        severity: 'error',
        message: `Modifier '.${modifierName}' has no Solid emitter (missing solid() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    const args = entry.kind === 'wrap' || entry.kind === 'filter' ? entry.args : [];
    const desc: SolidEmissionDescriptor = impl.solid(args, {
      source: 'template-event',
      event: eventName,
      sourceLoc: entry.sourceLoc,
    });

    if (desc.kind === 'native') {
      // Capture/passive/once — no JSX-level equivalent for Solid template @event.
      diagnostics.push({
        code: RozieErrorCode.TARGET_SOLID_RESERVED,
        severity: 'warning',
        message: `Modifier '.${desc.token}' has no JSX-prop equivalent in Solid. Move handler to <listeners> block to use this modifier.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    if (desc.kind === 'inlineGuard') {
      inlineGuards.push(desc.code);
      continue;
    }

    // helper kind
    if (desc.listenerOnly === true) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_SOLID_RESERVED,
        severity: 'error',
        message: `Modifier '.${modifierName}' is listenerOnly — only valid in <listeners> blocks, not on template @event bindings.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    // Debounce/throttle helper on template @event — emit a wrapper const to script injections.
    if (desc.helperName === 'createDebouncedHandler' || desc.helperName === 'createThrottledHandler') {
      const solidHelper = desc.helperName;
      ctx.collectors.runtime.add(solidHelper);
      const originalHandlerCode = renderHandler(listener.handler, ctx.ir, ctx.invokeAccessors);
      const wrapName = makeWrapName(solidHelper, listener.handler, ctx.injectionCounter);
      const argList = desc.args.map(renderModifierArg).join(', ');
      // Solid createDebouncedHandler(fn, ms) — no dep array needed (Solid auto-tracks).
      const injection = `const ${wrapName} = ${solidHelper}(${originalHandlerCode}${argList ? ', ' + argList : ''});`;
      scriptInjection = injection;
      ctx.scriptInjections.push(injection);
      handlerRef = wrapName;
      continue;
    }

    // Unknown helper
    diagnostics.push({
      code: RozieErrorCode.TARGET_SOLID_RESERVED,
      severity: 'error',
      message: `Modifier helper '${desc.helperName}' is not supported on template @event bindings in Solid.`,
      loc: entry.sourceLoc,
    });
  }

  // Compose the handler expression
  const handlerKind = classifyHandler(listener.handler);
  let handlerExpr: string;
  if (handlerRef !== null && inlineGuards.length === 0) {
    // Pure helper-wrap: reference the wrapper name directly.
    handlerExpr = handlerRef;
  } else if (inlineGuards.length === 0) {
    const code = renderHandler(listener.handler, ctx.ir, ctx.invokeAccessors);
    if (handlerKind === 'identifier') {
      handlerExpr = code;
    } else if (handlerKind === 'callable') {
      // MemberExpression (e.g. `local.onClose`) or arrow/function expression —
      // invoke with the event so prop callbacks fire on click. Use optional-call
      // (`?.()`) so prop callbacks typed `Function | undefined` (any optional
      // callback prop) don't trip tsc TS2722 "Cannot invoke an object which is
      // possibly 'undefined'". Runtime semantics are unchanged — `?.()` is a
      // no-op when the LHS is null/undefined, matching what users expect when
      // they pass no handler.
      //
      // Spike-012 NEW-3 — annotate the synthesized `$event` param with the
      // event's specific DOM interface (see `domEventType`) so a strict consumer
      // (`noImplicitAny`) typechecks.
      handlerExpr = `($event: ${eventType}) => { (${code})?.($event); }`;
    } else {
      // Already a call / statement expression — splice verbatim.
      handlerExpr = `($event: ${eventType}) => { ${code}; }`;
    }
  } else {
    const guardLines = inlineGuards.join(' ');
    let handlerInvocation: string;
    if (handlerRef !== null) {
      handlerInvocation = `${handlerRef}($event)`;
    } else if (handlerKind === 'identifier') {
      // Bare identifier (e.g. `onSearch`) — call without args so handlers typed
      // `() => void` don't complain about the synthetic event parameter.
      handlerInvocation = `${renderHandler(listener.handler, ctx.ir, ctx.invokeAccessors)}()`;
    } else if (handlerKind === 'callable') {
      // Optional-call so optional callback props don't TS2722.
      handlerInvocation = `(${renderHandler(listener.handler, ctx.ir, ctx.invokeAccessors)})?.($event)`;
    } else {
      handlerInvocation = renderHandler(listener.handler, ctx.ir, ctx.invokeAccessors);
    }
    handlerExpr = `($event: ${eventType}) => { ${guardLines} ${handlerInvocation}; }`;
  }

  return {
    jsxAttr: `${jsxName}={${handlerExpr}}`,
    scriptInjection,
    diagnostics,
  };
}
