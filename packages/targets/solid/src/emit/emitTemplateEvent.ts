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
 *   - 'helper' kind (debounce/throttle) → NOT supported on template @event;
 *     emit diagnostic
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
  ReactEmissionDescriptor,
} from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface EmitEventCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector };
}

export interface EmitTemplateEventResult {
  jsxAttr: string;
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

function renderHandler(handler: t.Expression, ir: IRComponent): string {
  return rewriteTemplateExpression(handler, ir);
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

  const inlineGuards: string[] = [];

  for (const entry of listener.modifierPipeline) {
    let modifierName: string;

    if (entry.kind === 'listenerOption') {
      modifierName = entry.option;
    } else {
      modifierName = entry.modifier;
    }

    const impl = ctx.registry.get(modifierName);
    if (!impl) {
      // Try react() first (Solid shares React-compatible modifier descriptors);
      // then fall back to solid() if available.
      diagnostics.push({
        code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
        severity: 'error',
        message: `Modifier '.${modifierName}' has no emitter.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    // Resolve descriptor via react() — Solid reuses ReactEmissionDescriptor shapes
    if (!impl.react) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
        severity: 'error',
        message: `Modifier '.${modifierName}' has no Solid/React emitter.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    const args = entry.kind === 'wrap' || entry.kind === 'filter' ? entry.args : [];
    const desc: ReactEmissionDescriptor = impl.react(args, {
      source: 'template-event',
      event: eventName,
      sourceLoc: entry.sourceLoc,
    });

    if (desc.kind === 'native') {
      // Capture/passive/once — no JSX-level equivalent for Solid template @event.
      // Solid's native event listener options require `on:event` lowercase syntax,
      // which is a different binding form. For v1, skip with info diagnostic.
      diagnostics.push({
        code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
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
        code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
        severity: 'error',
        message: `Modifier '.${modifierName}' is listenerOnly — only valid in <listeners> blocks, not on template @event bindings.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    // debounce/throttle on template @event — not supported in Solid template event context
    diagnostics.push({
      code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
      severity: 'error',
      message: `Modifier helper is not supported on template @event bindings in Solid.`,
      loc: entry.sourceLoc,
    });
  }

  // Compose the handler expression
  let handlerExpr: string;
  if (inlineGuards.length === 0) {
    if (t.isIdentifier(listener.handler)) {
      handlerExpr = renderHandler(listener.handler, ctx.ir);
    } else {
      const code = renderHandler(listener.handler, ctx.ir);
      handlerExpr = `(e) => { ${code}; }`;
    }
  } else {
    const guardLines = inlineGuards.join(' ');
    const handlerInvocation = t.isIdentifier(listener.handler)
      ? `${renderHandler(listener.handler, ctx.ir)}(e)`
      : renderHandler(listener.handler, ctx.ir);
    handlerExpr = `(e) => { ${guardLines} ${handlerInvocation}; }`;
  }

  return {
    jsxAttr: `${jsxName}={${handlerExpr}}`,
    diagnostics,
  };
}
