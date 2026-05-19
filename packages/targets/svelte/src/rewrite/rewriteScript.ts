/**
 * rewriteScript — Phase 5 Plan 02a Task 1.
 *
 * Walks a CLONED Babel Program and rewrites Rozie magic accessors into
 * Svelte 5 idiomatic identifier shapes. Svelte's rewrite is the SIMPLEST of
 * all targets — runes destructure props/state/refs as bare locals, so every
 * `$foo.bar` accessor strips the `$foo.` prefix:
 *
 *   - `$props.value`  (model)     → `value`     (let { value = $bindable(...) })
 *   - `$props.step`   (non-model) → `step`      (let { step = ... })
 *   - `$data.hovering`            → `hovering`  (let hovering = $state(...))
 *   - `$refs.dialogEl`            → `dialogEl`  (let dialogEl = $state<HTMLElement>())
 *   - `$slots.foo`                → `foo`       (let { foo } = $props())
 *   - `$emit('foo', x)`           → `onfoo?.(x)` (Svelte 5 callback prop convention)
 *
 * Per RESEARCH.md Pitfall 7: do NOT optimize `items = [...items, newItem]`
 * to `items.push(newItem)` — preserve the re-assignment shape. We don't
 * touch AssignmentExpression node-types here, so re-assignment is preserved
 * by default.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';

/**
 * Normalize an emit name to a Svelte 5 callback-prop identifier.
 *
 * Svelte 5 convention is ALL-LOWERCASE callback props (`onclose`, `onsearch`).
 * Hyphens in event names (e.g. `event-click`) MUST be stripped — preserving
 * them would produce `onevent-click`, an invalid TS identifier. Both
 * rewriteScript ($emit lowering) and emitScript (Props interface emit) MUST
 * use this helper so the rewritten body's `oneventclick?.(x)` call site agrees
 * with the destructured prop `oneventclick`. Phase 07.7 fix — surfaced by
 * `examples/FullCalendar.rozie` which emits `event-click` / `date-click` /
 * `event-drop`. Re-exported so emitScript imports the same definition.
 */
export function svelteCallbackPropName(eventName: string): string {
  return `on${eventName.replace(/-/g, '').toLowerCase()}`;
}

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * Rewrite Rozie magic-accessor identifiers in-place on a cloned Program.
 *
 * @param program     - the CLONED Babel File (callers must `cloneScriptProgram` first)
 * @param ir          - the IRComponent (used for prop/data/ref/computed name lookups)
 * @param diagnostics - collected-not-thrown sink for ROZ621 collision diagnostics
 */
export function rewriteRozieIdentifiers(
  program: t.File,
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  // Computed names are NOT rewritten in Svelte: derived reads stay bare
  // (Svelte 5 auto-tracks signal reads — no `.value` suffix). Kept here as a
  // documentation anchor; not used in any visitor.
  const computedNames = new Set(ir.computed.map((c) => c.name));
  void computedNames;
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? 'default' : s.name)));
  const portalSlotNames = new Set(
    ir.slots.filter((s) => s.isPortal === true).map((s) => s.name),
  );

  // Phase 06.1 P2 (D-104/D-106): name → IR-primitive lookups so synthesized
  // identifier nodes can inherit the IR's sourceLoc. The .loc cast is `as any`
  // because @babel/types' SourceLocation expects {line, column} while our
  // SourceLoc is {start, end} byte offsets — runtime shape diverges; the
  // metadata is present for v2 to refine into proper line/column.
  const stateByName = new Map(ir.state.map((s) => [s.name, s]));
  const refByName = new Map(ir.refs.map((r) => [r.name, r]));
  const propByName = new Map(ir.props.map((p) => [p.name, p]));

  // Detect template-ref name collisions with <data>/<computed>/<props> — same
  // posture as the Vue target (ROZ420) but using ROZ621 (Svelte's reserved code).
  for (const ref of ir.refs) {
    const collides =
      dataNames.has(ref.name) ||
      computedNames.has(ref.name) ||
      modelProps.has(ref.name) ||
      nonModelProps.has(ref.name);
    if (collides) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_SVELTE_RESERVED, // ROZ621
        severity: 'error',
        message: `Template ref '${ref.name}' collides with <data>/<computed>/<props> declaration of the same name. Rename one to avoid the collision in emitted Svelte output.`,
        loc: ref.sourceLoc,
      });
    }
  }

  traverse(program, {
    Identifier(path) {
      // Spike 001 B2 — script-context `$el` lowers to
      // `MemberExpression($refs, __rozieRoot)`. The IR pass `lowerRootElementRef`
      // already appended `RefDecl { name: '__rozieRoot' }` to `ir.refs` when a
      // free `$el` read was detected, so the synthesised MemberExpression
      // naturally flows into the existing `$refs.X` handler below and lowers
      // to `__rozieRoot` (Svelte's bare-let ref idiom).
      if (path.node.name !== '$el') return;
      const parentPath = path.parentPath;
      if (!parentPath) return;
      if (parentPath.isVariableDeclarator() && parentPath.node.id === path.node) return;
      if (
        (parentPath.isMemberExpression() || parentPath.isOptionalMemberExpression()) &&
        (parentPath.node as t.MemberExpression | t.OptionalMemberExpression).property === path.node &&
        !(parentPath.node as t.MemberExpression | t.OptionalMemberExpression).computed
      ) {
        return;
      }
      if (
        parentPath.isObjectProperty() &&
        parentPath.node.key === path.node &&
        !parentPath.node.computed
      ) {
        return;
      }
      if (parentPath.isFunction()) {
        const params = (parentPath.node as { params: t.Node[] }).params;
        if (params.includes(path.node)) return;
      }
      path.replaceWith(
        t.memberExpression(t.identifier('$refs'), t.identifier('__rozieRoot')),
      );
      // Do NOT path.skip() — let the visitor re-visit the synthesised
      // MemberExpression so the `$refs.X` handler downstream lowers it to
      // the Svelte-side ref accessor.
      return;
    },

    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      // Skip computed access (`$props['foo']`).
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          // $props.value → value (bare local — destructured from $props())
          // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const synthId = t.identifier(prop.name);
          if (propDecl) synthId.loc = propDecl.sourceLoc as any;
          path.replaceWith(synthId);
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → hovering (bare local — let hovering = $state(...))
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (stateDecl) synthId.loc = stateDecl.sourceLoc as any;
        path.replaceWith(synthId);
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogEl (no Ref suffix in Svelte — refs are bare lets)
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (refDecl) synthId.loc = refDecl.sourceLoc as any;
        path.replaceWith(synthId);
        path.skip();
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // $slots.header → header (Snippet prop destructured from $props())
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$portals' && portalSlotNames.has(prop.name)) {
        // Portal-slot primitive (Spike 003). $portals.<name> resolves to the
        // synthesized local `portals` closure that emitScript injects at the
        // top of the mount-phase $effect body. Rename the object — args
        // continue to be visited and rewritten normally.
        path.node.object = t.identifier('portals');
        return;
      }
    },

    OptionalMemberExpression(path) {
      // Same rewrites for `$refs.foo?.bar` / `$data.foo?.bar` patterns.
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const synthId = t.identifier(prop.name);
          if (propDecl) synthId.loc = propDecl.sourceLoc as any;
          path.replaceWith(synthId);
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (stateDecl) synthId.loc = stateDecl.sourceLoc as any;
        path.replaceWith(synthId);
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (refDecl) synthId.loc = refDecl.sourceLoc as any;
        path.replaceWith(synthId);
        path.skip();
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      // $snapshot(x) → $state.snapshot(x) — Svelte 5 idiom for breaking out
      // of a `$state` proxy so the value can cross into untyped JS (e.g.
      // Chart.js / Flatpickr / Leaflet config objects whose internal use of
      // `Object.defineProperty` is incompatible with the proxy). The other
      // five targets lower `$snapshot(x)` to identity in their respective
      // rewriteScripts. See examples/LineChart.rozie for the canonical use.
      if (callee.name === '$snapshot') {
        const args = path.node.arguments;
        if (args.length !== 1) return;
        const arg = args[0]!;
        if (!t.isExpression(arg)) return;
        path.node.callee = t.memberExpression(
          t.identifier('$state'),
          t.identifier('snapshot'),
        );
        // Do NOT path.skip() — the argument may contain $props.X / $data.X
        // reads that still need rewriting.
        return;
      }

      // $emit('foo', x) → onfoo?.(x) — Svelte 5 callback-prop convention.
      // Do NOT touch $onMount/$onUnmount/$onUpdate (consumed structurally
      // from ir.lifecycle by emitScript).
      if (callee.name !== '$emit') return;
      const args = path.node.arguments;
      if (args.length === 0) return;
      const first = args[0];
      if (!t.isStringLiteral(first)) return;
      // Replace with optional-call: onfoo?.(restArgs). Do NOT path.skip() —
      // remaining args may contain nested $data/$props/$refs MemberExpressions
      // that still need rewriting (babel will re-traverse the replaced node).
      //
      // Phase 07.7 fix — strip non-identifier chars from the event name
      // (hyphens specifically) before prepending `on`. Without this, an
      // emit like `$emit('event-click', payload)` produced `onevent-click`
      // — a literal hyphen in a TS identifier position, which is invalid
      // syntax. Both rewriteScript (here) and emitScript (Props interface
      // emit) MUST agree on the normalization; the shared `svelteCallbackPropName`
      // helper enforces that lockstep.
      const callbackName = svelteCallbackPropName(first.value);
      const rest = args.slice(1);
      const optCall = t.optionalCallExpression(
        t.identifier(callbackName),
        rest as t.Expression[],
        true,
      );
      path.replaceWith(optCall);
    },
  });
}
