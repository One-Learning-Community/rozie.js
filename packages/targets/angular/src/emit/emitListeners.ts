/**
 * emitListeners — Phase 5 Plan 05-04a Task 3.
 *
 * Lowers `<listeners>`-block entries (`Listener[]` with source: 'listeners-block')
 * into Angular constructor-body code per RESEARCH Pattern 7. Three classes:
 *
 *   - **Class A — pure native + key filters**: single `effect((onCleanup) => {
 *       const handler = (e) => { ...inlineGuards; userHandler; };
 *       const unlisten = renderer.listen(target, event, handler);
 *       onCleanup(unlisten);
 *     });` block. Optional `when:` predicate gates with early return.
 *
 *   - **Class B — `.outside` collapse**: same shape, handler body adds a
 *     `.contains(target)` early-return check against listed refs. Per OQ A8
 *     RESOLVED — no `outsideClick` runtime helper; inlined per listener.
 *
 *   - **Class C — `.debounce(ms)` / `.throttle(ms)` wrap**: emit a class-body
 *     field initializer `private throttledX = (() => {...})()` IIFE wrap
 *     (no @rozie/runtime-angular per OQ A8/A9 RESOLVED), then a constructor
 *     effect attaches via Renderer2.listen to the wrapped name.
 *
 * Native modifier passthrough (`.capture`/`.passive`/`.once` listenerOption
 * tokens) IS valid in <listeners> context — they map onto Renderer2.listen's
 * options object. (Note: Angular's Renderer2.listen API up through 17 does
 * NOT accept an options object for non-DOM event targets, but for `document`
 * / `window` it does in 18+. v1 emits {passive:true} etc. as a documentation
 * marker; if Angular complains we add an explicit fallback.)
 *
 * Per RESEARCH lines 322-323: Angular's `effect()` auto-tracks signal reads —
 * the Phase 2 ReactiveDepGraph is NOT consumed; listener.deps is ignored.
 *
 * Per Pitfall 8: `inject(Renderer2)` lives in constructor body, NOT method
 * bodies. Effect callbacks DO accept inject() (they ARE in injection context),
 * but for clarity we hoist `const renderer = inject(Renderer2);` to the
 * constructor body once.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws; pushes diagnostics.
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  Listener,
  ListenerTarget,
} from '../../../../core/src/ir/types.js';
import type {
  ModifierRegistry,
  ModifierPipelineEntry,
  AngularEmissionDescriptor,
} from '@rozie/core';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteListenerExpression } from '../rewrite/rewriteListenerExpression.js';

export interface AngularListenerInjection {
  /** Field name (e.g., `throttledReposition`). */
  name: string;
  /** Class-body field initializer text. */
  decl: string;
}

const NATIVE_KEY_GUARDS: Record<string, string> = {
  enter: "if (e.key !== 'Enter') return;",
  esc: "if (e.key !== 'Escape') return;",
  escape: "if (e.key !== 'Escape') return;",
  tab: "if (e.key !== 'Tab') return;",
  delete: "if (e.key !== 'Delete' && e.key !== 'Backspace') return;",
  space: "if (e.key !== ' ') return;",
  up: "if (e.key !== 'ArrowUp') return;",
  down: "if (e.key !== 'ArrowDown') return;",
  left: "if (e.key !== 'ArrowLeft') return;",
  right: "if (e.key !== 'ArrowRight') return;",
  home: "if (e.key !== 'Home') return;",
  end: "if (e.key !== 'End') return;",
  pageUp: "if (e.key !== 'PageUp') return;",
  pageDown: "if (e.key !== 'PageDown') return;",
  middle: "if (e.button !== 1) return;",
};

function eventTypeFor(event: string): string {
  if (
    event === 'click' || event === 'mousedown' || event === 'mouseup' ||
    event === 'mousemove' || event === 'mouseenter' || event === 'mouseleave'
  ) return 'MouseEvent';
  if (event === 'keydown' || event === 'keyup' || event === 'keypress') return 'KeyboardEvent';
  if (event === 'wheel') return 'WheelEvent';
  if (event === 'touchstart' || event === 'touchend' || event === 'touchmove') return 'TouchEvent';
  if (event === 'pointerdown' || event === 'pointerup' || event === 'pointermove') return 'PointerEvent';
  if (event === 'focus' || event === 'blur') return 'FocusEvent';
  if (event === 'input') return 'InputEvent';
  if (event === 'submit') return 'SubmitEvent';
  if (event === 'resize' || event === 'scroll') return 'Event';
  return 'Event';
}

/**
 * Render the Renderer2.listen target argument (string for global / element
 * lookup expression for ref-bound).
 */
function renderTargetExpr(
  target: ListenerTarget,
  diagnostics: Diagnostic[],
  loc: { start: number; end: number },
): string {
  if (target.kind === 'global') return `'${target.name}'`;
  if (target.kind === 'ref') {
    // Renderer2.listen accepts an Element directly.
    return `this.${target.refName}()?.nativeElement`;
  }
  // self / $el — fallback.
  diagnostics.push({
    code: RozieErrorCode.TARGET_ANGULAR_RESERVED,
    severity: 'warning',
    message: `<listeners> entry with target=$el is not yet supported on the Angular target — falling back to 'document'`,
    loc,
  });
  return "'document'";
}

function renderModifierArg(arg: ModifierArg): string {
  if (arg.kind === 'literal') return JSON.stringify(arg.value);
  // refExpr — bare identifier is the ref name; access via `this.X()?.nativeElement`.
  return arg.ref;
}

/**
 * Compose a class-body wrapper-name for a listener wrapping a debounce/throttle
 * IIFE. Mirrors Vue/Svelte/React patterns.
 */
function makeWrapName(
  helperName: 'debounce' | 'throttle',
  handlerCode: string,
  counter: { next: number },
): string {
  const baseMatch = handlerCode.match(/^this\.([A-Za-z_$][\w$]*)/);
  const base = baseMatch ? baseMatch[1]! : `handler${counter.next}`;
  const cap = base.charAt(0).toUpperCase() + base.slice(1);
  // 'L' namespace prefix (from listeners block) — mirrors Svelte naming.
  const prefix = helperName === 'debounce' ? 'debouncedL' : 'throttledL';
  const N = counter.next++;
  return N === 0 ? `${prefix}${cap}` : `${prefix}${cap}_${N}`;
}

function buildDebounceIIFE(wrapName: string, origHandlerCode: string, ms: string): string {
  return [
    `private ${wrapName} = (() => {`,
    `  let timer: ReturnType<typeof setTimeout> | null = null;`,
    `  return (...args: any[]) => {`,
    `    if (timer !== null) clearTimeout(timer);`,
    `    timer = setTimeout(() => (${origHandlerCode} as (...a: any[]) => any)(...args), ${ms});`,
    `  };`,
    `})();`,
  ].join('\n');
}

function buildThrottleIIFE(wrapName: string, origHandlerCode: string, ms: string): string {
  return [
    `private ${wrapName} = (() => {`,
    `  let lastCall = 0;`,
    `  return (...args: any[]) => {`,
    `    const now = Date.now();`,
    `    if (now - lastCall < ${ms}) return;`,
    `    lastCall = now;`,
    `    (${origHandlerCode} as (...a: any[]) => any)(...args);`,
    `  };`,
    `})();`,
  ].join('\n');
}

type ListenerClass =
  | { kind: 'A'; nativeKeyGuards: string[]; listenerOpts: Set<string> }
  | { kind: 'B'; outsideArgs: ModifierArg[]; listenerOpts: Set<string>; nativeKeyGuards: string[] }
  | {
      kind: 'C';
      helperName: 'debounce' | 'throttle';
      helperArgs: ModifierArg[];
      nativeKeyGuards: string[];
      listenerOpts: Set<string>;
    };

interface ClassifyOpts {
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
  event: string;
}

function classifyListener(
  pipeline: ModifierPipelineEntry[],
  opts: ClassifyOpts,
): ListenerClass {
  const nativeKeyGuards: string[] = [];
  const listenerOpts = new Set<string>();
  let outsideArgs: ModifierArg[] | null = null;
  let wrapHelper: { name: 'debounce' | 'throttle'; args: ModifierArg[] } | null = null;

  for (const entry of pipeline) {
    if (entry.kind === 'listenerOption') {
      listenerOpts.add(entry.option);
      continue;
    }
    const impl = opts.registry.get(entry.modifier);
    if (!impl || !impl.angular) {
      opts.diagnostics.push({
        code: RozieErrorCode.TARGET_ANGULAR_RESERVED,
        severity: 'error',
        message: `Modifier '.${entry.modifier}' has no Angular emitter (missing angular() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }
    const descriptor: AngularEmissionDescriptor = impl.angular(entry.args, {
      source: 'listeners-block',
      event: opts.event,
      sourceLoc: entry.sourceLoc,
    });

    if (descriptor.kind === 'native') {
      listenerOpts.add(descriptor.token);
      const guard = NATIVE_KEY_GUARDS[descriptor.token] ?? NATIVE_KEY_GUARDS[entry.modifier];
      if (guard) nativeKeyGuards.push(guard);
      continue;
    }
    if (descriptor.kind === 'inlineGuard') {
      nativeKeyGuards.push(descriptor.code);
      continue;
    }
    // descriptor.kind === 'helper'
    if (descriptor.helperName === 'outsideClick') {
      outsideArgs = descriptor.args;
      continue;
    }
    if (descriptor.helperName === 'debounce' || descriptor.helperName === 'throttle') {
      wrapHelper = { name: descriptor.helperName, args: descriptor.args };
      continue;
    }
  }

  if (outsideArgs !== null) {
    return { kind: 'B', outsideArgs, listenerOpts, nativeKeyGuards };
  }
  if (wrapHelper !== null) {
    return {
      kind: 'C',
      helperName: wrapHelper.name,
      helperArgs: wrapHelper.args,
      nativeKeyGuards,
      listenerOpts,
    };
  }
  return { kind: 'A', nativeKeyGuards, listenerOpts };
}

function renderListener(
  listener: Listener,
  ir: IRComponent,
  classification: ListenerClass,
  fieldInitializers: AngularListenerInjection[],
  wrapCounter: { next: number },
  diagnostics: Diagnostic[],
  collisionRenames: ReadonlyMap<string, string>,
  classMembers: ReadonlySet<string>,
  signalMembers: ReadonlySet<string>,
): string {
  const evtType = eventTypeFor(listener.event);
  const targetExpr = renderTargetExpr(listener.target, diagnostics, listener.sourceLoc);

  const userHandlerCode = rewriteListenerExpression(listener.handler, ir, {
    collisionRenames,
    classMembers,
    signalMembers,
  });
  // Also match signal-typed members rewritten to `this.X()` by
  // rewriteListenerExpression — without this, signal handlers fall through to
  // the wrapping branch and produce `(this.mySignalHandler())(e)`, which is a
  // runtime error when the signal value is void. Closes WR-04.
  const handlerIsBareIdentifier = /^this\.[A-Za-z_$][\w$]*(\(\))?$/.test(userHandlerCode);
  // When userHandlerCode ends with `()` (signal-typed member), strip the trailing
  // `()` before building the invocation so we get `this.X()` not `this.X()()`.
  const handlerRef = userHandlerCode.replace(/\(\)$/, '');

  const whenGuard =
    listener.when === null
      ? ''
      : `      if (!(${rewriteListenerExpression(listener.when, ir, { collisionRenames, classMembers, signalMembers })})) return;\n`;

  // Class B: .outside collapse — handler body adds contains-checks against
  // each listed ref BEFORE the user-handler invocation.
  if (classification.kind === 'B') {
    const refChecks = classification.outsideArgs
      .filter((a) => a.kind === 'refExpr')
      .map(renderModifierArg)
      .map((refName) => `this.${refName}()?.nativeElement?.contains(target)`)
      .join(' || ');

    const containsGuard = refChecks.length > 0
      ? `        const target = e.target as Node;\n        if (${refChecks}) return;\n`
      : '';

    const guardLines = classification.nativeKeyGuards.length > 0
      ? classification.nativeKeyGuards.map((g) => `        ${g}`).join('\n') + '\n'
      : '';

    const invocation = handlerIsBareIdentifier
      ? `        ${handlerRef}();`
      : `        (${userHandlerCode})(e);`;

    return [
      `effect((onCleanup) => {`,
      `${whenGuard}      const handler = (e: ${evtType}) => {\n${containsGuard}${guardLines}${invocation}\n      };`,
      `      const unlisten = renderer.listen(${targetExpr}, '${listener.event}', handler);`,
      `      onCleanup(unlisten);`,
      `    });`,
    ].join('\n');
  }

  // Class C: debounce/throttle wrap — emit class-body field initializer,
  // attach wrapped handler in effect via Renderer2.listen.
  if (classification.kind === 'C') {
    const wrapName = makeWrapName(classification.helperName, userHandlerCode, wrapCounter);
    const argList = classification.helperArgs.map(renderModifierArg);
    const ms = argList[0] ?? '0';
    const decl =
      classification.helperName === 'debounce'
        ? buildDebounceIIFE(wrapName, userHandlerCode, ms)
        : buildThrottleIIFE(wrapName, userHandlerCode, ms);
    fieldInitializers.push({ name: wrapName, decl });

    return [
      `effect((onCleanup) => {`,
      `${whenGuard}      const unlisten = renderer.listen(${targetExpr}, '${listener.event}', this.${wrapName});`,
      `      onCleanup(unlisten);`,
      `    });`,
    ].join('\n');
  }

  // Class A: pure-native + key-filter inlineGuards.
  const guardLines = classification.nativeKeyGuards.length > 0
    ? classification.nativeKeyGuards.map((g) => `        ${g}`).join('\n') + '\n'
    : '';
  const invocation = handlerIsBareIdentifier
    ? `        ${handlerRef}();`
    : `        (${userHandlerCode})(e);`;

  return [
    `effect((onCleanup) => {`,
    `${whenGuard}      const handler = (e: ${evtType}) => {\n${guardLines}${invocation}\n      };`,
    `      const unlisten = renderer.listen(${targetExpr}, '${listener.event}', handler);`,
    `      onCleanup(unlisten);`,
    `    });`,
  ].join('\n');
}

export interface EmitListenersResult {
  /**
   * Concatenated effect blocks, separated by blank lines. Spliced into the
   * constructor body AFTER user residual statements + lifecycle hooks.
   */
  constructorBody: string;
  /**
   * Class-body field initializers (debounce/throttle IIFE wrappers).
   * Spliced AFTER user method/arrow class fields.
   */
  fieldInitializers: AngularListenerInjection[];
  /** True when at least one effect block was emitted (renderer needed). */
  needsRenderer: boolean;
  diagnostics: Diagnostic[];
}

export function emitListeners(
  listeners: Listener[],
  ir: IRComponent,
  registry: ModifierRegistry,
  collisionRenames: ReadonlyMap<string, string>,
  classMembers: ReadonlySet<string>,
  signalMembers: ReadonlySet<string>,
): EmitListenersResult {
  const diagnostics: Diagnostic[] = [];
  const fieldInitializers: AngularListenerInjection[] = [];
  const wrapCounter = { next: 0 };

  const blockListeners = listeners.filter((l) => l.source === 'listeners-block');
  if (blockListeners.length === 0) {
    return { constructorBody: '', fieldInitializers, needsRenderer: false, diagnostics };
  }

  const blocks: string[] = [];
  for (const listener of blockListeners) {
    const classification = classifyListener(listener.modifierPipeline, {
      registry,
      diagnostics,
      event: listener.event,
    });
    blocks.push(
      renderListener(
        listener,
        ir,
        classification,
        fieldInitializers,
        wrapCounter,
        diagnostics,
        collisionRenames,
        classMembers,
        signalMembers,
      ),
    );
  }

  return {
    constructorBody: blocks.join('\n\n    '),
    fieldInitializers,
    needsRenderer: true,
    diagnostics,
  };
}
