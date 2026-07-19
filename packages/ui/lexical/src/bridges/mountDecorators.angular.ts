// The ANGULAR per-target decorator BRIDGE (a HAND-WRITTEN escape hatch, D-06/REQ-39).
// Rozie does NOT synthesize this — codegen vendors it verbatim into the Angular leaf
// (never routed through compile()). It renders an Angular `@mention` pill into each
// Lexical decorator host and destroys removed ones (T-76-04-LEAK).
// Render primitive: `createComponent(Cmp, { environmentInjector, hostElement })` +
// `ApplicationRef.attachView` — the proven repo pattern (rete probe-41). A root
// EnvironmentInjector is obtained once via `createApplication()` (the only public
// sync-free way to get one outside an existing Angular app); consumers supply
// zone.js via their app polyfills. The label uses `{{ }}` interpolation — Angular
// escapes it (T-76-04-XSS); the chip never binds `[innerHTML]`.
import { createApplication } from '@angular/platform-browser';
import { Component, Input, createComponent, type ComponentRef } from '@angular/core';
import type { LexicalEditor } from 'lexical';
import type { MentionDescriptor } from './MentionNode';

@Component({
  standalone: true,
  selector: 'rozie-mention-chip',
  template: '<span class="rozie-mention" [attr.data-mention-id]="id">@{{ label }}</span>',
})
class MentionChipComponent {
  @Input() label = '';
  @Input() id: string | null = null;
}

/** Wire the Angular decorator bridge. Returns an unregister fn. */
export function mountDecorators(editor: LexicalEditor): () => void {
  const refs = new Map<string, ComponentRef<MentionChipComponent>>();
  const appReady = createApplication();

  return editor.registerDecoratorListener<MentionDescriptor>((decorators) => {
    const liveKeys = new Set(Object.keys(decorators));
    void appReady.then((app) => {
      for (const key of liveKeys) {
        const el = editor.getElementByKey(key);
        if (!el || refs.has(key)) continue;
        const { label, id } = decorators[key].props;
        const ref = createComponent(MentionChipComponent, {
          environmentInjector: app.injector,
          hostElement: el,
        });
        ref.setInput('label', label);
        ref.setInput('id', id);
        app.attachView(ref.hostView);
        ref.changeDetectorRef.detectChanges();
        refs.set(key, ref);
      }
      for (const key of [...refs.keys()]) {
        if (liveKeys.has(key)) continue;
        refs.get(key)!.destroy();
        refs.delete(key);
      }
    });
  });
}
