/**
 * emitTemplateEvent — Phase 3 Plan 03 Task 2.
 *
 * Renders a template @event Listener as `@event[.modifiers]="handler"` plus
 * an optional `scriptInjection` describing the import + helper-decl that
 * emitVue must splice into <script setup> when a non-native modifier
 * (.debounce / .throttle) wraps a template @event handler at script level
 * (RESEARCH.md Pattern 5 line 522-535).
 *
 * Native modifier (D-39): pass through token verbatim (registry's vue() hook
 * returns `{ kind: 'native', token }`). Token may differ from the Rozie
 * modifier name — e.g. `escape` → `esc` per VUE_KEY_TOKEN_MAP.
 *
 * Helper modifier (D-40):
 *   - If `listenerOnly: true` (only `.outside` in v1): raise ROZ420 because
 *     `.outside` is only meaningful in <listeners> blocks.
 *   - Otherwise (`.debounce` / `.throttle`): rename the handler to a stable
 *     wrap name (e.g. `debouncedOnSearch`), record the import + decl in the
 *     returned `scriptInjection`, and emit `@event="<wrapName>"`.
 *
 * Multiple .debounce/.throttle on the same listener nest: each registers its
 * own wrap (rare but supported by composing wraps).
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
  VueEmissionDescriptor,
} from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface EmitEventCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  /** Per-component counter so suffix names are stable + collision-free. */
  injectionCounter?: { next: number };
}

/**
 * Returned by emitTemplateEvent. emitTemplate aggregates `scriptInjection`
 * across all template events and passes them to emitVue for splicing into
 * <script setup>.
 */
export interface ScriptInjection {
  /** Wrap variable name, e.g. `debouncedOnSearch`. */
  wrapName: string;
  /** Import descriptor — emitVue dedupes across multiple injections. */
  import: { from: '@rozie/runtime-vue'; name: 'debounce' | 'throttle' | 'useOutsideClick' };
  /** Full `const wrapName = helper(handler, ...args);` declaration. */
  decl: string;
}

export interface EmitTemplateEventResult {
  eventAttr: string;
  scriptInjection?: ScriptInjection;
  diagnostics: Diagnostic[];
}

/**
 * Render a ModifierArg as a JS-source string for inlining into a helper-call
 * argument list (e.g., `debounce(onSearch, 300)`). Literal numbers/strings
 * use JSON.stringify; refExprs render as `<refName>Ref` (Pitfall 4 suffix).
 */
function renderModifierArg(arg: ModifierArg): string {
  if (arg.kind === 'literal') {
    return JSON.stringify(arg.value);
  }
  // refExpr — `$refs.x` style. The arg.ref carries the full expression text.
  // For template event wraps (Plan 03 only sees debounce/throttle which take
  // numeric literals), refExpr args shouldn't appear; render conservatively.
  return arg.ref;
}

/**
 * Render the original handler expression as a Vue-template-friendly string.
 * Shared with emitTemplate for non-modifier-wrap paths.
 */
function renderHandler(handler: t.Expression, ir: IRComponent): string {
  return rewriteTemplateExpression(handler, ir);
}

/**
 * Compose a stable wrap name for a debounce/throttle handler. We use the
 * helper name as a prefix and the handler's original Identifier name (when
 * available) for clarity. Counter ensures uniqueness when the same handler
 * is wrapped in multiple modifiers across the same template.
 */
function makeWrapName(
  helperName: 'debounce' | 'throttle',
  handler: t.Expression,
  counter: { next: number },
): string {
  let baseName = '';
  if (t.isIdentifier(handler)) {
    baseName = handler.name;
  } else {
    baseName = `handler${counter.next}`;
  }
  // Capitalize first letter for camelCase composition: debounce + onSearch → debouncedOnSearch
  const cap = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const prefix = helperName === 'debounce' ? 'debounced' : 'throttled';
  const N = counter.next++;
  return N === 0 ? `${prefix}${cap}` : `${prefix}${cap}_${N}`;
}

export function emitTemplateEvent(
  listener: Listener,
  ctx: EmitEventCtx,
): EmitTemplateEventResult {
  const diagnostics: Diagnostic[] = [];
  const counter = ctx.injectionCounter ?? { next: 0 };

  let eventName = listener.event;
  const modifierTokens: string[] = [];
  let scriptInjection: ScriptInjection | undefined;
  let handlerCode: string | null = null;

  for (const entry of listener.modifierPipeline) {
    // Look up modifier impl by name. listenerOption entries don't carry
    // modifier name on this surface, but their original name is captured at
    // the entry's `option` field.
    let modifierName: string;
    let modifierArgs: ModifierArg[];

    if (entry.kind === 'listenerOption') {
      // .capture / .passive / .once map to native Vue modifier names verbatim.
      modifierName = entry.option;
      modifierArgs = [];
    } else {
      modifierName = entry.modifier;
      modifierArgs = entry.args;
    }

    const impl = ctx.registry.get(modifierName);
    if (!impl || !impl.vue) {
      // Unknown / no vue() hook — fall through to ROZ420 reservoir per
      // Plan 01 D-40. Phase 3 emits a diagnostic.
      diagnostics.push({
        code: RozieErrorCode.TARGET_VUE_RESERVED,
        severity: 'error',
        message: `Modifier '.${modifierName}' has no Vue emitter (missing vue() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    const descriptor: VueEmissionDescriptor = impl.vue(modifierArgs, {
      source: 'template-event',
      event: eventName,
      sourceLoc: entry.sourceLoc,
    });

    if (descriptor.kind === 'native') {
      modifierTokens.push(descriptor.token);
      continue;
    }

    // descriptor.kind === 'helper'
    if (descriptor.listenerOnly === true) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_VUE_RESERVED,
        severity: 'error',
        message: `Modifier '.${modifierName}' is listenerOnly (D-40) — only valid in <listeners> blocks, not on template @event bindings.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    if (descriptor.helperName === 'debounce' || descriptor.helperName === 'throttle') {
      // Pattern 5: script-level handler wrap.
      const originalHandlerCode = renderHandler(listener.handler, ctx.ir);
      const wrapName = makeWrapName(descriptor.helperName, listener.handler, counter);
      const argList = descriptor.args.map(renderModifierArg).join(', ');
      const decl = `const ${wrapName} = ${descriptor.helperName}(${originalHandlerCode}${argList ? ', ' + argList : ''});`;

      scriptInjection = {
        wrapName,
        import: { from: '@rozie/runtime-vue', name: descriptor.helperName },
        decl,
      };
      handlerCode = wrapName;
      continue;
    }

    // useOutsideClick on template @event would have been caught by listenerOnly
    // above. Defensive fallback: treat as listenerOnly violation.
    diagnostics.push({
      code: RozieErrorCode.TARGET_VUE_RESERVED,
      severity: 'error',
      message: `Modifier '.${modifierName}' helper '${descriptor.helperName}' is not supported on template @event bindings.`,
      loc: entry.sourceLoc,
    });
  }

  // If no script-injection wrap, render the handler inline.
  if (handlerCode === null) {
    handlerCode = renderHandler(listener.handler, ctx.ir);
  }

  // Compose: @event[.tok1.tok2...]="<handler>"
  const modSuffix = modifierTokens.map((tok) => `.${tok}`).join('');
  const eventAttr = `@${eventName}${modSuffix}="${handlerCode}"`;

  const result: EmitTemplateEventResult = { eventAttr, diagnostics };
  if (scriptInjection) {
    result.scriptInjection = scriptInjection;
  }
  return result;
}
