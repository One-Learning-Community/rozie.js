/**
 * emitListeners — Phase 3 Plan 04 Task 2.
 *
 * Lowers `<listeners>`-block entries (Listener[] with source: 'listeners-block')
 * into Vue 3 `<script setup>` body code. Per RESEARCH.md Pattern 5 + CONTEXT
 * D-40..D-42 + VUE-03 + MOD-04, three emission shapes are produced:
 *
 *   - **Class A: pure-native** — modifierPipeline contains only native
 *     modifiers (key filters, listenerOption capture/passive/once). Emits
 *     `watchEffect((onCleanup) => { if (!when) return; const handler = ...;
 *     target.addEventListener(...); onCleanup(...); })`.
 *
 *   - **Class B: .outside collapse (D-42)** — modifierPipeline contains a
 *     `wrap` entry whose registry vue() returns helper 'useOutsideClick'
 *     with listenerOnly: true. Collapses the `when:` predicate into the
 *     whenSignal getter; emits a single `useOutsideClick([refs], () =>
 *     handler(), () => when)` call. No watchEffect needed — the helper
 *     auto-registers via onMounted/onBeforeUnmount.
 *
 *   - **Class C: .debounce / .throttle wrap** — modifierPipeline contains a
 *     `wrap` entry whose registry vue() returns helper 'debounce'/'throttle'
 *     (no listenerOnly). Emits a script-level wrap (`const throttledX =
 *     throttle(X, 100);`) followed by a watchEffect using the wrapped
 *     handler.
 *
 * Native modifier passthrough produces inline guard checks (`if (e.key !==
 * 'Escape') return;`) inside the watchEffect handler — Vue's automatic
 * modifier handling only applies to template @event, not raw
 * addEventListener.
 *
 * Per CONTEXT D-21 / RESEARCH lines 484-487: Vue's runtime auto-tracks
 * signal reads inside watchEffect/whenSignal closures. ReactiveDepGraph is
 * NOT consumed here — listener.deps is ignored by the Vue emitter.
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
  VueEmissionDescriptor,
} from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteScriptExpression } from '../rewrite/rewriteListenerExpression.js';
import {
  VueImportCollector,
  RuntimeVueImportCollector,
} from '../rewrite/collectVueImports.js';
import { emitOutsideClickCall } from './emitListenerCollapsedOutsideClick.js';

/**
 * Native key-filter token → KeyboardEvent.key check (or modifier-key check)
 * inlined as an early-return guard inside watchEffect-emitted handlers.
 *
 * Mirrors @rozie/runtime-vue's keyFilter predicates but inlined for stability
 * (avoids requiring the runtime-vue import for every key-filter listener).
 */
const NATIVE_KEY_GUARDS: Record<string, string> = {
  enter: "if (e.key !== 'Enter') return;",
  esc: "if (e.key !== 'Escape') return;",
  // Rozie modifier name 'escape' maps to Vue token 'esc' (via VUE_KEY_TOKEN_MAP)
  // but we also accept 'escape' here for direct modifier-name lookups.
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
  // Mouse-button: middle = button 1
  middle: "if (e.button !== 1) return;",
};

/** Map common DOM events → TypeScript event types for the handler signature. */
function eventTypeFor(event: string): string {
  if (event === 'click' || event === 'mousedown' || event === 'mouseup' || event === 'mousemove')
    return 'MouseEvent';
  if (event === 'keydown' || event === 'keyup' || event === 'keypress') return 'KeyboardEvent';
  return 'Event';
}

/** Render the addEventListener target call prefix per ListenerTarget shape. */
function renderTargetExpr(target: ListenerTarget): string {
  if (target.kind === 'global') return target.name; // 'document' or 'window'
  if (target.kind === 'self') return 'el.value?'; // optional-chained — see below
  // ref kind
  return `${target.refName}Ref.value?`;
}

/** Whether the target call needs optional-chaining `?.` (refs may be unmounted). */
function targetIsOptionalChained(target: ListenerTarget): boolean {
  return target.kind !== 'global';
}

/**
 * Build the `, { capture: true, ... }` options-object suffix from
 * collected listenerOption entries on a single listener. Returns '' when no
 * options are present.
 */
function renderListenerOptions(listenerOpts: Set<string>): string {
  if (listenerOpts.size === 0) return '';
  const parts = [...listenerOpts].sort().map((opt) => `${opt}: true`);
  return `, { ${parts.join(', ')} }`;
}

/**
 * Map a modifier ModifierArg to its render-as-inline-arg shape — used for
 * helper-call argument lists like `throttle(reposition, 100)` where the
 * second arg comes from the modifier's args.
 */
function renderModifierArg(arg: ModifierArg): string {
  if (arg.kind === 'literal') return JSON.stringify(arg.value);
  // refExpr — peggy grammar already stripped `$refs.` prefix; arg.ref is
  // the bare identifier (e.g. `x`). Append the `Ref` suffix per Pitfall 4.
  return arg.ref + 'Ref';
}

/**
 * Compose a stable script-level wrap variable name for a debounce/throttle
 * listener handler. Matches Plan 03's emitTemplateEvent.makeWrapName style.
 */
function makeWrapName(
  helperName: 'debounce' | 'throttle',
  handlerCode: string,
  counter: { next: number },
): string {
  // Try to extract a clean Identifier-like base from the handlerCode. If the
  // handlerCode is a single identifier, use it; otherwise fall back to
  // 'handlerN'.
  const baseMatch = handlerCode.match(/^[A-Za-z_$][\w$]*$/);
  let baseName: string;
  if (baseMatch) {
    baseName = handlerCode;
  } else {
    baseName = `handler${counter.next}`;
  }
  const cap = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const prefix = helperName === 'debounce' ? 'debounced' : 'throttled';
  const N = counter.next++;
  return N === 0 ? `${prefix}${cap}` : `${prefix}${cap}_${N}`;
}

/**
 * Classify a listener's modifier pipeline so we know which Class
 * (A: pure-native, B: outside collapse, C: debounce/throttle wrap) to emit.
 */
type ListenerClass =
  | { kind: 'A'; nativeKeyGuards: string[]; listenerOpts: Set<string> }
  | { kind: 'B'; outsideArgs: ModifierArg[] }
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
    // entry.kind === 'wrap' or 'filter'
    const impl = opts.registry.get(entry.modifier);
    if (!impl || !impl.vue) {
      opts.diagnostics.push({
        code: RozieErrorCode.TARGET_VUE_RESERVED,
        severity: 'error',
        message: `Modifier '.${entry.modifier}' has no Vue emitter (missing vue() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }
    const descriptor: VueEmissionDescriptor = impl.vue(entry.args, {
      source: 'listeners-block',
      event: opts.event,
      sourceLoc: entry.sourceLoc,
    });

    if (descriptor.kind === 'native') {
      const guard = NATIVE_KEY_GUARDS[descriptor.token] ?? NATIVE_KEY_GUARDS[entry.modifier];
      if (guard) nativeKeyGuards.push(guard);
      // .stop / .prevent / .self in <listeners> blocks — we don't have a
      // template @event passthrough path; emit inline guards if mapped.
      if (entry.modifier === 'stop') {
        nativeKeyGuards.push('e.stopPropagation();');
      } else if (entry.modifier === 'prevent') {
        nativeKeyGuards.push('e.preventDefault();');
      }
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
    return { kind: 'B', outsideArgs };
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
 * Render a single listener as a script-level emission block (one or more
 * statements joined by '\n'). Pushes runtime-vue + vue imports as needed.
 */
function renderListener(
  listener: Listener,
  ir: IRComponent,
  classification: ListenerClass,
  vueImports: VueImportCollector,
  runtimeImports: RuntimeVueImportCollector,
  wrapCounter: { next: number },
): string {
  // Class B: D-42 useOutsideClick collapse — single helper call, no watchEffect.
  if (classification.kind === 'B') {
    runtimeImports.use('useOutsideClick');
    return emitOutsideClickCall(listener, classification.outsideArgs, ir);
  }

  // Classes A and C both wrap their handler in a watchEffect((onCleanup) => {}).
  vueImports.use('watchEffect');

  const evtType = eventTypeFor(listener.event);
  const targetExpr = renderTargetExpr(listener.target);
  const optChain = targetIsOptionalChained(listener.target);

  // Build `if (!(when)) return;` guard if when is non-null.
  const whenGuard =
    listener.when === null
      ? ''
      : `if (!(${rewriteScriptExpression(listener.when, ir)})) return;`;

  // Render the handler invocation. For Identifier handlers, call as `name(e)`
  // when wraps aren't applied (so the user's handler signature receives the
  // event); for arrows, call them with `(e)` too. Class C overrides this with
  // the wrapped name (no event arg — debounce/throttle wraps the *user* fn
  // and we hand `e` to the wrapped fn).
  const userHandlerCode = rewriteScriptExpression(listener.handler, ir);

  const guards = classification.kind === 'A'
    ? classification.nativeKeyGuards
    : classification.helperName /* C */
      ? classification.nativeKeyGuards
      : [];
  const guardLines = guards.length > 0
    ? guards.map((g) => `    ${g}`).join('\n') + '\n'
    : '';

  const optsObj = renderListenerOptions(
    classification.kind === 'A'
      ? classification.listenerOpts
      : classification.kind === 'C'
        ? classification.listenerOpts
        : new Set<string>(),
  );

  // Whether the user-handler is a bare Identifier — if so, calling it as
  // `handler()` (no event arg) matches the user's source (Dropdown's
  // `close` is `() => { $props.open = false }`). For non-Identifier shapes
  // we pass `(e)` defensively. The Identifier check uses a regex on the
  // already-rewritten code (post .value suffix application).
  const handlerIsBareIdentifier = /^[A-Za-z_$][\w$]*$/.test(userHandlerCode);

  // Class C: wrap with helper at script-level + reference wrap name in
  // addEventListener. The wrap arg is the original handler invocation
  // (`reposition` — the Identifier itself), the wrap name replaces the
  // handler in addEventListener.
  if (classification.kind === 'C') {
    runtimeImports.use(classification.helperName);
    const wrapName = makeWrapName(classification.helperName, userHandlerCode, wrapCounter);
    const wrapArgsList = classification.helperArgs.map(renderModifierArg).join(', ');
    const wrapDecl = `const ${wrapName} = ${classification.helperName}(${userHandlerCode}${wrapArgsList ? ', ' + wrapArgsList : ''});`;

    // Build add/remove call WITHOUT trailing `;` so we can wrap inside
    // onCleanup(() => removeCall) without a stray `;` inside the arrow.
    const addCallNoSemi = `${targetExpr}.addEventListener('${listener.event}', ${wrapName}${optsObj})`;
    const removeCallNoSemi = `${targetExpr}.removeEventListener('${listener.event}', ${wrapName}${optsObj})`;

    const guardLine = whenGuard ? `  ${whenGuard}\n` : '';
    return [
      wrapDecl,
      `watchEffect((onCleanup) => {`,
      guardLine + `  ${addCallNoSemi};`,
      `  onCleanup(() => ${removeCallNoSemi});`,
      `});`,
    ].join('\n');
  }

  // Class A: pure-native + optional listenerOptions. Emit a watchEffect with
  // an inner `handler = (e) => { guards; userHandler(e); }` then add/remove.
  // For Identifier handlers, call as `handlerName();` (no `e` arg) to match
  // the user's zero-arg shape (RESEARCH Code Example 2 line 960). For
  // non-Identifier handlers, call `(e)` defensively.
  const handlerInvoke = handlerIsBareIdentifier
    ? `${userHandlerCode}();`
    : `(${userHandlerCode})(e);`;
  const handlerDecl = `  const handler = (e: ${evtType}) => {\n${guardLines}    ${handlerInvoke}\n  };`;
  const addCallNoSemi = `${targetExpr}.addEventListener('${listener.event}', handler${optsObj})`;
  const removeCallNoSemi = `${targetExpr}.removeEventListener('${listener.event}', handler${optsObj})`;

  // void unused
  void optChain;

  const guardLine = whenGuard ? `  ${whenGuard}\n` : '';
  return [
    `watchEffect((onCleanup) => {`,
    guardLine + handlerDecl,
    `  ${addCallNoSemi};`,
    `  onCleanup(() => ${removeCallNoSemi});`,
    `});`,
  ].join('\n');
}

/**
 * @experimental — shape may change before v1.0
 */
export interface EmitListenersResult {
  /** Concatenated listener-emission blocks, separated by blank lines. */
  code: string;
  /** Vue imports to splice into the canonical Vue import line. */
  vueImports: VueImportCollector;
  /** @rozie/runtime-vue imports auto-collected from emitted helpers. */
  runtimeImports: RuntimeVueImportCollector;
  diagnostics: Diagnostic[];
}

/**
 * Lower the `<listeners>` block (entries with source: 'listeners-block')
 * into Vue 3 script-setup body code. Template-event listeners are
 * filtered OUT — Plan 03's emitTemplateEvent owns those.
 *
 * @param listeners - the IR's listeners array (unfiltered; both sources OK)
 * @param ir        - the full IRComponent (used for handler/when expression rewriting)
 * @param registry  - ModifierRegistry (for vue() hook lookups)
 */
export function emitListeners(
  listeners: Listener[],
  ir: IRComponent,
  registry: ModifierRegistry,
): EmitListenersResult {
  const diagnostics: Diagnostic[] = [];
  const vueImports = new VueImportCollector();
  const runtimeImports = new RuntimeVueImportCollector();
  const wrapCounter = { next: 0 };

  // Filter to <listeners>-block entries only.
  const blockListeners = listeners.filter((l) => l.source === 'listeners-block');

  if (blockListeners.length === 0) {
    return { code: '', vueImports, runtimeImports, diagnostics };
  }

  const blocks: string[] = [];
  for (const listener of blockListeners) {
    const classification = classifyListener(listener.modifierPipeline, {
      registry,
      diagnostics,
      event: listener.event,
    });
    const block = renderListener(
      listener,
      ir,
      classification,
      vueImports,
      runtimeImports,
      wrapCounter,
    );
    blocks.push(block);
  }

  return {
    code: blocks.join('\n\n'),
    vueImports,
    runtimeImports,
    diagnostics,
  };
}
