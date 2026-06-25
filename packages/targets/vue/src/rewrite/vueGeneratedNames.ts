/**
 * vueGeneratedBindingNames — Phase 61 Plan 07 (SC-2, collision-vue §3 risks 2+3).
 *
 * Computes the set of GENERATED `<script setup>` top-level binding names + the
 * `'vue'` / runtime-vue import names the Vue emitter ACTUALLY mints for THIS
 * component. A USER `<data>`/`$computed`/`$inject`-local / `<script>` helper /
 * import equal to one of these collides with the generated binding (TS2451
 * redeclare) or the injected import (TS2440 import shadow).
 *
 * CRITICAL — only-on-ACTUAL-generation. The full reserved tables
 * (VUE_EMITTER_BINDINGS ∪ VUE_IMPORT_NAMES ∪ VUE_RUNTIME_IMPORTS) list every name
 * the emitter COULD mint. But `defineProps`/`defineEmits`/`useSlots`/`ref`/
 * `computed`/`watch`/… are each emitted CONDITIONALLY (only when the component
 * has props / emits / a `$slots.X` read / `<data>`+refs / `$computed` / `$watch`).
 * A static union over-applies: an author param `(w, h) => …` or a function-local
 * `const h = portals.body(...)` is NOT a collision when the component never
 * injects `import { h }` from 'vue'. So this helper gates every name on the
 * actual IR condition that makes the emitter inject it — keeping non-colliding
 * components byte-identical (the deconfliction's core invariant).
 *
 * The conditions mirror emitScript.ts exactly:
 *   - `props`            ⟺ ir.props.length > 0           (defineProps/withDefaults)
 *   - `emit`             ⟺ ir.emits.length > 0           (defineEmits)
 *   - `slots`            ⟺ a `$slots.X` read in script/template OR any portal slot
 *                          (the `const slots = useSlots()` condition)
 *   - `portals` / `portalContainers` ⟺ any portal slot
 *   - `ref`              ⟺ ir.state.length > 0 || ir.refs.length > 0
 *   - `computed`         ⟺ ir.computed.length > 0
 *   - `watch`            ⟺ ir.watchers.length > 0
 *   - `provide`          ⟺ ir.provides.length > 0
 *   - `inject` / `useSlots` are added via the slots/inject conditions above
 *   - lifecycle imports (`onMounted`/`onBeforeUnmount`/`onUpdated`) ⟺ matching hook
 *   - runtime-vue (`debounce`/`throttle`/`useOutsideClick`/`normalizeListeners`/
 *     `rozieDeepClone`) ⟺ the modifier/listener/$clone feature is used
 *   - `h`/`render`/`Fragment` ⟺ NEVER emitted by the Vue target (it emits SFC
 *     templates, not render functions) → excluded entirely (a top-level `<data>`/
 *     helper named `h` would never collide; including it only over-applies, as the
 *     chartjs `resizeChart(w, h)` corpus proved).
 *
 * Returns a `Set<string>` of the names that WOULD collide for this component.
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import {
  VUE_EMITTER_BINDINGS,
  VUE_IMPORT_NAMES,
  VUE_RUNTIME_IMPORTS,
} from '../../../../core/src/rewrite/reservedNames.js';

/** Recursively scan a Babel subtree for a non-computed `$slots.<x>` member read. */
function subtreeReadsSlots(node: unknown, seen: WeakSet<object> = new WeakSet()): boolean {
  if (!node || typeof node !== 'object') return false;
  if (seen.has(node)) return false;
  seen.add(node);
  const n = node as Record<string, unknown> & { type?: string };
  if (
    (n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression') &&
    n.computed !== true
  ) {
    const obj = n.object as { type?: string; name?: string } | undefined;
    if (obj?.type === 'Identifier' && obj.name === '$slots') return true;
  }
  for (const key of Object.keys(n)) {
    if (key === 'type' || key === 'loc' || key === 'start' || key === 'end' ||
        key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') {
      continue;
    }
    const v = n[key];
    if (Array.isArray(v)) {
      for (const item of v) if (subtreeReadsSlots(item, seen)) return true;
    } else if (v && typeof v === 'object') {
      if (subtreeReadsSlots(v, seen)) return true;
    }
  }
  return false;
}

export function vueGeneratedBindingNames(ir: IRComponent): Set<string> {
  const out = new Set<string>();
  const add = (name: string, generated: boolean): void => {
    if (generated) out.add(name);
  };

  // Defensive `?? []` / optional reads throughout — some hand-rolled test IRs
  // (and any future minimal IR) omit optional collections. A missing field means
  // "feature absent" → the corresponding generated symbol is not minted.
  const slots = ir.slots ?? [];
  const lifecycle = ir.lifecycle ?? [];
  const hasPortalSlots = slots.some((s) => s.isPortal === true);
  // `const slots = useSlots()` is emitted when the script/template reads
  // `$slots.X` for any slot OR when there are portal slots (whose closures read
  // `slots.X`). Mirror emitScript.ts's `slotsUsed || hasPortalSlots`.
  const readsSlots =
    hasPortalSlots ||
    subtreeReadsSlots(ir.setupBody?.scriptProgram) ||
    subtreeReadsSlots(ir.template);

  // VUE_EMITTER_BINDINGS — each gated on its generation condition.
  add('props', (ir.props?.length ?? 0) > 0);
  add('emit', (ir.emits?.length ?? 0) > 0);
  add('slots', readsSlots);
  add('portals', hasPortalSlots);
  add('portalContainers', hasPortalSlots);

  // VUE_IMPORT_NAMES — gated on the feature that injects the 'vue' import.
  add('ref', (ir.state?.length ?? 0) > 0 || (ir.refs?.length ?? 0) > 0);
  add('computed', (ir.computed?.length ?? 0) > 0);
  add('watch', (ir.watchers?.length ?? 0) > 0);
  add('provide', (ir.provides?.length ?? 0) > 0);
  add('inject', (ir.injects?.length ?? 0) > 0);
  add('useSlots', readsSlots);
  for (const hook of lifecycle) {
    if (hook.phase === 'mount') out.add('onMounted');
    if (hook.phase === 'unmount') out.add('onBeforeUnmount');
    if (hook.phase === 'update') out.add('onUpdated');
  }
  // `$onMount` returning a teardown also injects onBeforeUnmount.
  if (lifecycle.some((h) => h.phase === 'mount' && h.cleanup != null)) {
    out.add('onBeforeUnmount');
  }
  // `h` / `render` / `Fragment` are NEVER emitted by the Vue SFC target —
  // deliberately NOT added (the chartjs `resizeChart(w, h)` over-apply guard).

  // VUE_RUNTIME_IMPORTS — gated on the feature that injects the @rozie/runtime-vue
  // helper. `debounce`/`throttle` come from `.debounce(ms)`/`.throttle(ms)`
  // modifiers; `useOutsideClick` from `.outside(...)`; `normalizeListeners` from a
  // dynamic `r-on`; `rozieDeepClone` from `$clone(x)`. These all surface through
  // the modifier/listener/sigil walk, which is not reconstructable from the IR
  // alone without re-running the modifier pass. Conservatively include the runtime
  // names ONLY when the component actually has listeners or modifier-bearing
  // bindings — i.e. it has a `<listeners>` block. (A bare top-level helper named
  // `debounce` in a component that never uses a debounce modifier would not
  // collide; gating on `ir.listeners.length` keeps the common no-listeners corpus
  // byte-identical while still covering the genuine engine-wrapper case.)
  const mayInjectRuntime = (ir.listeners?.length ?? 0) > 0;
  for (const name of VUE_RUNTIME_IMPORTS) {
    if (mayInjectRuntime) out.add(name);
  }

  // Defensive intersection with the canonical tables — guarantees the returned
  // set is always a SUBSET of the single-source-of-truth reserved names (no
  // accidental name escapes the registry).
  const canonical = new Set<string>([
    ...VUE_EMITTER_BINDINGS,
    ...VUE_IMPORT_NAMES,
    ...VUE_RUNTIME_IMPORTS,
  ]);
  for (const n of [...out]) {
    if (!canonical.has(n)) out.delete(n);
  }
  return out;
}
