// The LIT per-target decorator BRIDGE (a HAND-WRITTEN escape hatch, D-06/REQ-39).
// Rozie does NOT synthesize this — codegen vendors it verbatim into the Lit leaf
// (never routed through compile()). It subscribes to Lexical's decorator map and
// renders a Lit `@mention` pill into each decorator host node, tearing down removed
// decorators so detached chips do not leak Lit-managed subtrees (T-76-04-LEAK).
// Render primitive: `render(html`…`, el)` / `render(nothing, el)` from `lit` — the
// exact spike-015 `mountLitDecorators` datum (33 LOC), generalized to the shipped
// `@mention` descriptor. Note the decorator hosts live INSIDE the shell's OPEN
// shadow root; `render()` targets those light-of-the-shadow host spans directly, so
// no extra shadow handling is needed (spike 015 / REQ-40).
//
// The label is a Lit `${}` TEXT interpolation — Lit escapes it (T-76-04-XSS); we
// NEVER use `unsafeHTML`. `data-mention-id=${id ?? nothing}` uses Lit's `nothing`
// sentinel to DROP the attribute when the id is null (the rozieAttr nullish-drop
// parity, matching the other five bridges).
import { render, html, nothing } from 'lit';
import type { LexicalEditor } from 'lexical';
import type { MentionDescriptor } from './MentionNode';

// A neutral-descriptor → Lit-template registry keyed by the descriptor's `component`
// name. `decorate()` returns `{ component: 'mention', props }` and never names Lit;
// this bridge is the only file that maps that neutral key to a Lit template.
const registry: Record<string, (props: MentionDescriptor['props']) => unknown> = {
  mention: (props) =>
    html`<span class="rozie-mention" data-mention-id=${props.id ?? nothing}>@${props.label}</span>`,
};

/** Wire the Lit decorator bridge. Returns an unregister fn. */
export function mountDecorators(editor: LexicalEditor): () => void {
  const mounted = new Set<string>();

  return editor.registerDecoratorListener<MentionDescriptor>((decorators) => {
    const liveKeys = new Set(Object.keys(decorators));

    // mount / update
    for (const key of liveKeys) {
      const el = editor.getElementByKey(key);
      if (!el) continue;
      const { component, props } = decorators[key];
      const tmpl = registry[component];
      if (!tmpl) continue;
      render(tmpl(props), el);
      mounted.add(key);
    }

    // unmount removed — render(nothing) clears the Lit-managed subtree
    for (const key of [...mounted]) {
      if (liveKeys.has(key)) continue;
      const el = editor.getElementByKey(key);
      if (el) render(nothing, el);
      mounted.delete(key);
    }
  });
}
