/**
 * `useRozieOnce` — `.once` on a component event, which in React is a callback prop rather than a
 * DOM listener, so there is no `{ once: true }` option to give it.
 *
 * The emitter hoists one `const _rozieOnceN = useRozieOnce();` per listener and binds
 * `onPing={_rozieOnceN([...loopKeys], handler)}`. The keys are the `r-for` keys enclosing the
 * component tag (`[]` outside a loop), so each rendered child fires once. The fired set lives in a
 * ref, so it survives re-renders; the wrapper itself is re-created every render with the current
 * handler.
 *
 * @public — runtime API consumed by emitted React components.
 */
import { useRef } from 'react';

// biome-ignore lint/suspicious/noExplicitAny: callback props are typed by the emitted component
type Handler = ((...args: any[]) => unknown) | null | undefined;

interface Node {
  fired: boolean;
  children: Map<unknown, Node>;
}

const newNode = (): Node => ({ fired: false, children: new Map() });

export function useRozieOnce(): (
  keys: readonly unknown[],
  handler: Handler,
  // biome-ignore lint/suspicious/noExplicitAny: matches the callback prop it replaces
) => (...args: any[]) => unknown {
  const root = useRef<Node | null>(null);
  if (root.current === null) root.current = newNode();
  const tree = root.current;
  return (keys, handler) =>
    (...args) => {
      let node = tree;
      for (const key of keys) {
        let next = node.children.get(key);
        if (next === undefined) {
          next = newNode();
          node.children.set(key, next);
        }
        node = next;
      }
      if (node.fired) return undefined;
      node.fired = true;
      return handler?.(...args);
    };
}
