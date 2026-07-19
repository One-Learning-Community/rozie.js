// The SVELTE per-target decorator BRIDGE (a HAND-WRITTEN escape hatch, D-06/REQ-39).
// Rozie does NOT synthesize this — codegen vendors it verbatim into the Svelte leaf
// (never routed through compile()) alongside its `MentionChip.svelte` sidecar. It
// renders a Svelte 5 `@mention` pill into each Lexical decorator host and unmounts
// removed ones (T-76-04-LEAK).
// Render primitive: `mount(Component, { target, props })` / `unmount(inst)` from
// `svelte` (Svelte 5 runes-mode imperative API). The label is rendered via the
// component's `{label}` text interpolation — Svelte escapes it (T-76-04-XSS); the
// chip never uses `{@html}`. Svelte 5's `mount` requires a COMPILED component, so
// the trivial pill lives in `MentionChip.svelte` (vendored beside this file).
import { mount, unmount } from 'svelte';
import type { LexicalEditor } from 'lexical';
import type { MentionDescriptor } from './MentionNode';
import MentionChip from './MentionChip.svelte';

/** Wire the Svelte decorator bridge. Returns an unregister fn. */
export function mountDecorators(editor: LexicalEditor): () => void {
  const instances = new Map<string, ReturnType<typeof mount>>();

  return editor.registerDecoratorListener<MentionDescriptor>((decorators) => {
    const liveKeys = new Set(Object.keys(decorators));

    for (const key of liveKeys) {
      const el = editor.getElementByKey(key);
      if (!el || instances.has(key)) continue;
      const inst = mount(MentionChip, { target: el, props: decorators[key].props });
      instances.set(key, inst);
    }

    for (const key of [...instances.keys()]) {
      if (liveKeys.has(key)) continue;
      void unmount(instances.get(key)!);
      instances.delete(key);
    }
  });
}
