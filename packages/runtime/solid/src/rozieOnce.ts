/**
 * `rozieOnce` — `.once` on a component event, which here is a callback prop rather than a DOM
 * listener, so there is no `{ once: true }` option to give it.
 *
 * The emitter binds `onPing={rozieOnce(() => handler)}` where the framework evaluates it once per
 * rendered child (Solid: a `@once`-marked prop; Svelte: a prop expression memoized per instance),
 * so each child, including each `r-for` row, fires once. The handler is passed as a thunk and read
 * when the event fires, so the current handler runs and nothing reactive is read while the
 * wrapper is made.
 *
 * @public — runtime API consumed by emitted components.
 */
// biome-ignore lint/suspicious/noExplicitAny: callback props are typed by the emitted component
type Handler = ((...args: any[]) => unknown) | null | undefined;

// biome-ignore lint/suspicious/noExplicitAny: matches the callback prop it replaces
export function rozieOnce(getHandler: () => Handler): (...args: any[]) => unknown {
  let fired = false;
  return (...args) => {
    if (fired) return undefined;
    fired = true;
    return getHandler()?.(...args);
  };
}
