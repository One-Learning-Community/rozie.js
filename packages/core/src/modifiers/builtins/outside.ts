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
};
