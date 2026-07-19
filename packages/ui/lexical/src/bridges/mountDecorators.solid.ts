// The SOLID per-target decorator BRIDGE (a HAND-WRITTEN escape hatch, D-06/REQ-39).
// Rozie does NOT synthesize this — codegen vendors it verbatim into the Solid leaf
// (never routed through compile()). It renders a Solid `@mention` pill into each
// Lexical decorator host and disposes removed ones (T-76-04-LEAK).
// Render primitive: `render(() => node, el)` from `solid-js/web`; the returned
// dispose fn unmounts. Authored in a plain `.ts` (no JSX), so the chip is built as
// a DOM node whose textContent escapes the label (T-76-04-XSS) — never innerHTML.
import { render } from 'solid-js/web';
import type { LexicalEditor } from 'lexical';
import type { MentionDescriptor } from './MentionNode';

function mentionChip(props: MentionDescriptor['props']): HTMLElement {
  const span = document.createElement('span');
  span.className = 'rozie-mention';
  span.textContent = '@' + props.label;
  if (props.id != null) span.setAttribute('data-mention-id', props.id);
  return span;
}

/** Wire the Solid decorator bridge. Returns an unregister fn. */
export function mountDecorators(editor: LexicalEditor): () => void {
  const disposers = new Map<string, () => void>();

  return editor.registerDecoratorListener<MentionDescriptor>((decorators) => {
    const liveKeys = new Set(Object.keys(decorators));

    for (const key of liveKeys) {
      const el = editor.getElementByKey(key);
      if (!el || disposers.has(key)) continue;
      const { props } = decorators[key];
      const dispose = render(() => mentionChip(props), el);
      disposers.set(key, dispose);
    }

    for (const key of [...disposers.keys()]) {
      if (liveKeys.has(key)) continue;
      disposers.get(key)!();
      disposers.delete(key);
    }
  });
}
