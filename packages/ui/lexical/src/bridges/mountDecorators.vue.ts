// The VUE per-target decorator BRIDGE (a HAND-WRITTEN escape hatch, D-06/REQ-39).
// Rozie does NOT synthesize this — codegen vendors it verbatim into the Vue leaf
// (never routed through compile()). It renders a Vue `@mention` pill into each
// Lexical decorator host and tears down removed ones (T-76-04-LEAK).
// Render primitive: `render(h('span', …), el)` from `vue`; `render(null, el)` clears.
import { h, render } from 'vue';
import type { LexicalEditor } from 'lexical';
import type { MentionDescriptor } from './MentionNode';

/** Wire the Vue decorator bridge. Returns an unregister fn. */
export function mountDecorators(editor: LexicalEditor): () => void {
  const mounted = new Set<string>();

  return editor.registerDecoratorListener<MentionDescriptor>((decorators) => {
    const liveKeys = new Set(Object.keys(decorators));

    for (const key of liveKeys) {
      const el = editor.getElementByKey(key);
      if (!el) continue;
      const { label, id } = decorators[key].props;
      // The label is a Vue TEXT child (third arg of h) — Vue escapes it. We NEVER
      // use v-html / innerHTML (T-76-04-XSS).
      render(
        h('span', { class: 'rozie-mention', 'data-mention-id': id ?? undefined }, '@' + label),
        el,
      );
      mounted.add(key);
    }

    for (const key of [...mounted]) {
      if (liveKeys.has(key)) continue;
      const el = editor.getElementByKey(key);
      if (el) render(null, el);
      mounted.delete(key);
    }
  });
}
