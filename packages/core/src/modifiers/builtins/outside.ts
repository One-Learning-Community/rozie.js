/**
 * `.outside(...refs)` — fires only when the event target is OUTSIDE all
 * listed refs. No-arg form (`.outside`) defaults to the component root
 * (`$el`) at emit time per MOD-04.
 *
 * Pipeline kind: `wrap` — emitter wraps the handler in a higher-order
 * function that consults `event.composedPath()` (Pitfall 8) before
 * invoking the user handler.
 *
 * Per D-22: this module has NO module-import side effects. The `outside`
 * impl is exported as a plain object; registration happens explicitly
 * from `registerBuiltins(registry)`.
 *
 * Args validation: each arg MUST be a `refExpr` (`$refs.x`). Literal args
 * emit `ROZ112` (MODIFIER_ARG_SHAPE) and produce zero pipeline entries.
 */
import type { ModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const outside: ModifierImpl = {
  name: 'outside',
  // 'one-or-more' permits BOTH `.outside()` (zero args, defaults to $el)
  // and `.outside($refs.a, $refs.b, ...)` (one or more refs).
  arity: 'one-or-more',
  resolve(args, ctx) {
    const diagnostics: Diagnostic[] = [];
    for (const arg of args) {
      if (arg.kind !== 'refExpr') {
        diagnostics.push({
          code: RozieErrorCode.MODIFIER_ARG_SHAPE,
          severity: 'error',
          message: `'.outside' expects ref arguments (e.g., $refs.x), got ${arg.kind}`,
          loc: arg.loc,
        });
      }
    }
    if (diagnostics.length > 0) return { entries: [], diagnostics };
    return {
      entries: [
        {
          kind: 'wrap',
          modifier: 'outside',
          args,
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics: [],
    };
  },
  vue(args) {
    // D-40 + D-42: dispatched through @rozie/runtime-vue useOutsideClick.
    // listenerOnly because outside-click only makes sense in <listeners>;
    // emitter raises a diagnostic if encountered on a template @event.
    return {
      kind: 'helper',
      importFrom: '@rozie/runtime-vue',
      helperName: 'useOutsideClick',
      args,
      listenerOnly: true,
    };
  },
  react(args) {
    // D-65 marquee helper: dispatched through @rozie/runtime-react
    // useOutsideClick. listenerOnly because outside-click only makes sense in
    // <listeners>; React emitter raises ROZ520-class diagnostic if encountered
    // on a template @event.
    return {
      kind: 'helper',
      importFrom: '@rozie/runtime-react',
      helperName: 'useOutsideClick',
      args,
      listenerOnly: true,
    };
  },
  svelte(args) {
    // Phase 5 marquee helper: dispatched through @rozie/runtime-svelte
    // useOutsideClick. listenerOnly because outside-click only makes sense in
    // <listeners>; Svelte emitter raises ROZ621-class diagnostic if encountered
    // on a template @event. NOTE: Plan 05-02 may inline emit instead of
    // importing if no runtime package is created — descriptor stays
    // helper-shaped, emitter handles the inlining.
    return {
      kind: 'helper',
      importFrom: '@rozie/runtime-svelte',
      helperName: 'useOutsideClick',
      args,
      listenerOnly: true,
    };
  },
  angular(args) {
    // Phase 5 marquee helper: dispatched through @rozie/runtime-angular
    // outsideClick. listenerOnly because outside-click only makes sense in
    // <listeners>; Angular emitter raises ROZ722-class diagnostic if encountered
    // on a template @event. Per RESEARCH.md A8 the v1 default is inline
    // emission via Renderer2.listen + DestroyRef, but the descriptor remains
    // helper-shaped so Plan 05-04 can opt into a runtime package if duplicate
    // outsideClick logic emerges across listeners.
    return {
      kind: 'helper',
      importFrom: '@rozie/runtime-angular',
      helperName: 'outsideClick',
      args,
      listenerOnly: true,
    };
  },
  solid(args) {
    // Phase 07.1 marquee helper: dispatched through @rozie/runtime-solid
    // createOutsideClick. listenerOnly because outside-click only makes sense
    // in <listeners>; the Solid emitter raises a ROZ813-class diagnostic if
    // encountered on a template @event.
    return {
      kind: 'helper',
      importFrom: '@rozie/runtime-solid',
      helperName: 'createOutsideClick',
      args,
      listenerOnly: true,
    };
  },
  lit(args) {
    // Phase 07.1 marquee helper: dispatched through @rozie/runtime-lit
    // attachOutsideClickListener. listenerOnly because outside-click only makes
    // sense in <listeners>; the Lit emitter raises a ROZ832-class diagnostic if
    // encountered on a template @event.
    return {
      kind: 'helper',
      importFrom: '@rozie/runtime-lit',
      helperName: 'attachOutsideClickListener',
      args,
      listenerOnly: true,
    };
  },
};
