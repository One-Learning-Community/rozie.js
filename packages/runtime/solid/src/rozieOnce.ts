/**
 * `rozieOnceCall` — `.once` on a component event, which here is a callback prop rather than a DOM
 * listener, so there is no `{ once: true }` option to give it.
 *
 * The emitter binds a named function expression and keys the fired state by that function:
 *
 *   onPing={function __rozieOnce(...args: any[]) { return rozieOnceCall(__rozieOnce, 0, () => handler, args); }}
 *
 * Solid's compiler keeps a function-literal prop static (a call expression would become a getter
 * and run again on every read of the prop), so the function is made once per rendered child,
 * including each `r-for` row. `id` separates several `.once` listeners merged into one prop. The
 * handler is passed as a thunk and read when the event fires, so the current handler runs.
 *
 * @public — runtime API consumed by emitted Solid components.
 */
// biome-ignore lint/suspicious/noExplicitAny: callback props are typed by the emitted component
type Handler = ((...args: any[]) => unknown) | null | undefined;

const fired = new WeakMap<object, Set<number>>();

export function rozieOnceCall(
  owner: object,
  id: number,
  getHandler: () => Handler,
  args: readonly unknown[],
): unknown {
  let ids = fired.get(owner);
  if (ids === undefined) {
    ids = new Set();
    fired.set(owner, ids);
  }
  if (ids.has(id)) return undefined;
  ids.add(id);
  return getHandler()?.(...args);
}
