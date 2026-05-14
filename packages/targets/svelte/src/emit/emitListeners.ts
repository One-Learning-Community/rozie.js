/**
 * emitListeners — Phase 5 Plan 02a Task 3.
 *
 * Lowers `<listeners>`-block entries (Listener[] with source: 'listeners-block')
 * into Svelte 5 `<script>`-level code per RESEARCH Pattern 2. Three classes:
 *
 *   - **Class A — pure native + key filters**: single `$effect(() => {...})`
 *     block with inline early-return guards (key-filter inlineGuards),
 *     addEventListener + cleanup return.
 *
 *   - **Class B — `.outside` collapse**: same shape as Class A, BUT replaces
 *     the handler with a `.contains` early-return check against the listed
 *     refs. The `when:` predicate gates dispatch via the standard early-return
 *     guard. Per RESEARCH OQ A8/A9 RESOLVED — no `useOutsideClick` runtime
 *     helper; inlined per listener.
 *
 *   - **Class C — `.debounce(ms)` / `.throttle(ms)` wrap**: emit a top-level
 *     `const wrappedX = (() => { ...closure... })();` IIFE wrap, then a
 *     standard $effect block that uses `wrappedX` as the bound handler. Per
 *     A8/A9 RESOLVED — debounce/throttle inlined as IIFE, no @rozie/runtime-svelte.
 *
 * Native modifier passthrough (`.capture`/`.passive`/`.once` listenerOption
 * tokens) IS valid in <listeners> context — they map to the addEventListener
 * options object as `{ capture: true, passive: true, once: true }`. Unlike
 * template-event context where they're ROZ621 (Pitfall 4).
 *
 * Per RESEARCH lines 484-487: Svelte's $effect auto-tracks signal reads. The
 * Phase 2 ReactiveDepGraph is NOT consumed — listener.deps is ignored on the
 * Svelte side, just as on the Vue side.
 *
 * Per D-08 collected-not-thrown: never throws; pushes diagnostics.
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
  SvelteEmissionDescriptor,
} from '@rozie/core';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteListenerExpression } from '../rewrite/rewriteListenerExpression.js';
import type { SvelteScriptInjection } from './emitScript.js';

/**
 * Native key-filter token → KeyboardEvent.key check (or modifier-key check)
 * inlined as an early-return guard inside $effect-emitted handlers.
 */
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

/** Map common DOM events → TypeScript event types for the handler signature. */
function eventTypeFor(event: string): string {
  if (
    event === 'click' ||
    event === 'mousedown' ||
    event === 'mouseup' ||
    event === 'mousemove' ||
    event === 'mouseenter' ||
    event === 'mouseleave'
  )
    return 'MouseEvent';
  if (event === 'keydown' || event === 'keyup' || event === 'keypress')
    return 'KeyboardEvent';
  if (event === 'wheel') return 'WheelEvent';
  if (event === 'touchstart' || event === 'touchend' || event === 'touchmove')
    return 'TouchEvent';
  if (event === 'pointerdown' || event === 'pointerup' || event === 'pointermove')
    return 'PointerEvent';
  if (event === 'focus' || event === 'blur') return 'FocusEvent';
  if (event === 'input') return 'InputEvent';
  if (event === 'submit') return 'SubmitEvent';
  if (event === 'resize' || event === 'scroll') return 'Event';
  return 'Event';
}

/** Render the addEventListener target expression. */
function renderTargetExpr(target: ListenerTarget, diagnostics: Diagnostic[], loc: { start: number; end: number }): string {
  if (target.kind === 'global') return target.name;
  if (target.kind === 'ref') return target.refName;
  // self / $el — Plan 02a doesn't add an automatic root ref. Emit ROZ621
  // and fall back to 'document'.
  diagnostics.push({
    code: RozieErrorCode.TARGET_SVELTE_RESERVED,
    severity: 'warning',
    message: `<listeners> entry with target=$el is not yet supported on the Svelte target — falling back to 'document'`,
    loc,
  });
  return 'document';
}

/** Build the `, { capture: true, passive: true }` options-object suffix. */
function renderOptionsSuffix(opts: Set<string>): string {
  if (opts.size === 0) return '';
  const parts = [...opts].sort().map((o) => `${o}: true`);
  return `, { ${parts.join(', ')} }`;
}

/** Render a ModifierArg as a JS-source string. */
function renderModifierArg(arg: ModifierArg): string {
  if (arg.kind === 'literal') return JSON.stringify(arg.value);
  // refExpr — peggy grammar already stripped `$refs.` prefix; arg.ref is the
  // bare identifier (e.g. `panelEl`). Svelte refs use bare names (no `Ref`
  // suffix unlike Vue's Pitfall 4).
  return arg.ref;
}

/**
 * Compose a stable wrap variable name for a debounce/throttle listener.
 */
function makeWrapName(
  helperName: 'debounce' | 'throttle',
  handlerCode: string,
  counter: { next: number },
): string {
  const baseMatch = handlerCode.match(/^[A-Za-z_$][\w$]*$/);
  const baseName = baseMatch ? handlerCode : `handler${counter.next}`;
  const cap = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  // 'L' namespace prefix mirrors Vue's pattern — disambiguates from
  // template-event wraps (which use 'debounced'/'throttled' without 'L').
  const prefix = helperName === 'debounce' ? 'debouncedL' : 'throttledL';
  const N = counter.next++;
  return N === 0 ? `${prefix}${cap}` : `${prefix}${cap}_${N}`;
}

function buildDebounceIIFE(wrapName: string, origCode: string, ms: string): string {
  return [
    `const ${wrapName} = (() => {`,
    `  let timer: ReturnType<typeof setTimeout> | null = null;`,
    `  return (...args: any[]) => {`,
    `    if (timer !== null) clearTimeout(timer);`,
    `    timer = setTimeout(() => (${origCode})(...args), ${ms});`,
    `  };`,
    `})();`,
  ].join('\n');
}

function buildThrottleIIFE(wrapName: string, origCode: string, ms: string): string {
  return [
    `const ${wrapName} = (() => {`,
    `  let lastCall = 0;`,
    `  return (...args: any[]) => {`,
    `    const now = Date.now();`,
    `    if (now - lastCall < ${ms}) return;`,
    `    lastCall = now;`,
    `    (${origCode})(...args);`,
    `  };`,
    `})();`,
  ].join('\n');
}

/**
 * Classify a listener's modifier pipeline.
 */
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
    if (!impl || !impl.svelte) {
      opts.diagnostics.push({
        code: RozieErrorCode.TARGET_SVELTE_RESERVED,
        severity: 'error',
        message: `Modifier '.${entry.modifier}' has no Svelte emitter (missing svelte() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }
    const descriptor: SvelteEmissionDescriptor = impl.svelte(entry.args, {
      source: 'listeners-block',
      event: opts.event,
      sourceLoc: entry.sourceLoc,
    });

    if (descriptor.kind === 'native') {
      // Listeners-block context: 'native' tokens are valid (they go on
      // addEventListener's options object).
      listenerOpts.add(descriptor.token);
      // Stop / prevent in <listeners> blocks — raw addEventListener has no
      // such mechanism; emit explicit side-effect calls.
      if (entry.modifier === 'stop') {
        nativeKeyGuards.push('e.stopPropagation();');
      } else if (entry.modifier === 'prevent') {
        nativeKeyGuards.push('e.preventDefault();');
      } else {
        // Key/button filter — push guard if associated with a key-check.
        const guard = NATIVE_KEY_GUARDS[descriptor.token] ?? NATIVE_KEY_GUARDS[entry.modifier];
        if (guard) nativeKeyGuards.push(guard);
      }
      continue;
    }
    if (descriptor.kind === 'inlineGuard') {
      nativeKeyGuards.push(descriptor.code);
      continue;
    }
    // descriptor.kind === 'helper'
    if (descriptor.helperName === 'useOutsideClick') {
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

/**
 * Render a single listener as a `$effect(() => { ... })` block.
 */
function renderListener(
  listener: Listener,
  ir: IRComponent,
  classification: ListenerClass,
  scriptInjections: SvelteScriptInjection[],
  wrapCounter: { next: number },
  diagnostics: Diagnostic[],
): string {
  const evtType = eventTypeFor(listener.event);
  const targetExpr = renderTargetExpr(listener.target, diagnostics, listener.sourceLoc);
  const userHandlerCode = rewriteListenerExpression(listener.handler, ir);
  const handlerIsBareIdentifier = /^[A-Za-z_$][\w$]*$/.test(userHandlerCode);

  const whenGuard =
    listener.when === null
      ? ''
      : `  if (!(${rewriteListenerExpression(listener.when, ir)})) return;\n`;

  // Class B: .outside collapse — handler body adds a contains-check against
  // each listed ref BEFORE the user-handler invocation.
  if (classification.kind === 'B') {
    const refChecks = classification.outsideArgs
      .filter((a) => a.kind === 'refExpr')
      .map(renderModifierArg)
      .map((refName) => `${refName}?.contains(target)`)
      .join(' || ');

    const containsGuard = refChecks.length > 0
      ? `    const target = e.target as Node;\n    if (${refChecks}) return;\n`
      : '';

    const guardLines = classification.nativeKeyGuards.length > 0
      ? classification.nativeKeyGuards.map((g) => `    ${g}`).join('\n') + '\n'
      : '';

    const invocation = handlerIsBareIdentifier
      ? `    ${userHandlerCode}();`
      : `    (${userHandlerCode})(e);`;
    const optsObj = renderOptionsSuffix(classification.listenerOpts);

    return [
      `$effect(() => {`,
      whenGuard +
        `  const handler = (e: ${evtType}) => {\n${containsGuard}${guardLines}${invocation}\n  };`,
      `  ${targetExpr}.addEventListener('${listener.event}', handler${optsObj});`,
      `  return () => ${targetExpr}.removeEventListener('${listener.event}', handler${optsObj});`,
      `});`,
    ].join('\n');
  }

  // Class C: debounce/throttle wrap — emit IIFE at script-level,
  // attach wrapped handler in $effect.
  if (classification.kind === 'C') {
    const wrapName = makeWrapName(classification.helperName, userHandlerCode, wrapCounter);
    const argList = classification.helperArgs.map(renderModifierArg);
    const ms = argList[0] ?? '0';
    const decl =
      classification.helperName === 'debounce'
        ? buildDebounceIIFE(wrapName, userHandlerCode, ms)
        : buildThrottleIIFE(wrapName, userHandlerCode, ms);
    scriptInjections.push({
      name: wrapName,
      decl,
      // 'top' so listener IIFE wrappers are declared BEFORE the $effect that
      // attaches them (the $effect references the wrapName).
      position: 'top',
    });

    const optsObj = renderOptionsSuffix(classification.listenerOpts);

    return [
      `$effect(() => {`,
      whenGuard +
        `  ${targetExpr}.addEventListener('${listener.event}', ${wrapName}${optsObj});`,
      `  return () => ${targetExpr}.removeEventListener('${listener.event}', ${wrapName}${optsObj});`,
      `});`,
    ].join('\n');
  }

  // Class A: pure-native + listenerOption flags + key-filter inlineGuards.
  const guardLines = classification.nativeKeyGuards.length > 0
    ? classification.nativeKeyGuards.map((g) => `    ${g}`).join('\n') + '\n'
    : '';
  const invocation = handlerIsBareIdentifier
    ? `    ${userHandlerCode}();`
    : `    (${userHandlerCode})(e);`;
  const optsObj = renderOptionsSuffix(classification.listenerOpts);

  return [
    `$effect(() => {`,
    whenGuard +
      `  const handler = (e: ${evtType}) => {\n${guardLines}${invocation}\n  };`,
    `  ${targetExpr}.addEventListener('${listener.event}', handler${optsObj});`,
    `  return () => ${targetExpr}.removeEventListener('${listener.event}', handler${optsObj});`,
    `});`,
  ].join('\n');
}

/**
 * @experimental — shape may change before v1.0
 */
export interface EmitListenersResult {
  /** Concatenated $effect blocks, separated by blank lines. */
  block: string;
  /** Pending injections (debounce/throttle IIFE wrappers). */
  scriptInjections: SvelteScriptInjection[];
  diagnostics: Diagnostic[];
}

/**
 * Lower the `<listeners>`-block entries (source: 'listeners-block') into
 * Svelte 5 script-body code. Template @event listeners are filtered OUT —
 * Plan 02a Task 2's emitTemplateEvent owns those.
 */
export function emitListeners(
  listeners: Listener[],
  ir: IRComponent,
  registry: ModifierRegistry,
): EmitListenersResult {
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: SvelteScriptInjection[] = [];
  const wrapCounter = { next: 0 };

  const blockListeners = listeners.filter((l) => l.source === 'listeners-block');

  if (blockListeners.length === 0) {
    return { block: '', scriptInjections, diagnostics };
  }

  const blocks: string[] = [];
  for (const listener of blockListeners) {
    const classification = classifyListener(listener.modifierPipeline, {
      registry,
      diagnostics,
      event: listener.event,
    });
    blocks.push(
      renderListener(listener, ir, classification, scriptInjections, wrapCounter, diagnostics),
    );
  }

  return {
    block: blocks.join('\n\n'),
    scriptInjections,
    diagnostics,
  };
}
