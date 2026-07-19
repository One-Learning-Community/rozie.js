// The REACT per-target decorator BRIDGE (a HAND-WRITTEN escape hatch, D-06/REQ-39).
// Rozie does NOT synthesize this — it is vendored verbatim into the React leaf by
// codegen (never routed through compile()). It subscribes to Lexical's decorator
// map and renders a React `@mention` pill into each decorator's host node, tearing
// down removed decorators so detached chips do not leak React roots (T-76-04-LEAK).
// Render primitive: `createRoot(el).render(...)` from `react-dom/client`.
import { createElement, type FunctionComponent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LexicalEditor } from 'lexical';
import type { MentionDescriptor } from './MentionNode';

// The neutral descriptor's `props` shape, rendered as an inline pill. The label is
// a React TEXT child — React escapes it; we NEVER use dangerouslySetInnerHTML
// (T-76-04-XSS).
const MentionChip: FunctionComponent<MentionDescriptor['props']> = (props) =>
  createElement(
    'span',
    { className: 'rozie-mention', 'data-mention-id': props.id ?? undefined },
    '@' + props.label,
  );

/** Wire the React decorator bridge. Returns an unregister fn. */
export function mountDecorators(editor: LexicalEditor): () => void {
  const roots = new Map<string, Root>();

  return editor.registerDecoratorListener<MentionDescriptor>((decorators) => {
    const liveKeys = new Set(Object.keys(decorators));

    for (const key of liveKeys) {
      const el = editor.getElementByKey(key);
      if (!el) continue;
      let root = roots.get(key);
      if (!root) {
        root = createRoot(el);
        roots.set(key, root);
      }
      root.render(createElement(MentionChip, decorators[key].props));
    }

    for (const key of [...roots.keys()]) {
      if (liveKeys.has(key)) continue;
      roots.get(key)!.unmount();
      roots.delete(key);
    }
  });
}
