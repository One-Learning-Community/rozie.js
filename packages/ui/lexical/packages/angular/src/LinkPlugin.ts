import { Component, DestroyRef, InjectionToken, ViewEncapsulation, effect, inject } from '@angular/core';

// NAMESPACE imports (D-05): both the priority constant and the `$`-API come through
// namespace bindings so no bare `$`-identifier ever reaches the Svelte compiler.
import * as lexical from 'lexical';
import * as lexicalLink from '@lexical/link';

// The shared editor context object provided by the shell. `$inject` binds to a
// `const` (ROZ132), then aliases through a null-`let` (typeNeutralize) so `.instance`
// type-checks on the strict bundled leaves; TOP-LEVEL scope so the hoisted Solid
// teardown can reach it (see RichTextPlugin header for the full rationale).

const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =
  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<
    string,
    InjectionToken<unknown>
  >;
function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}

@Component({
  selector: 'rozie-link-plugin',
  standalone: true,
  template: `

  `,
  styles: [`
    :host(rozie-link-plugin) { display: contents; }
  `],
})
export class LinkPlugin {
  editorCtx = inject(rozieToken('rozie-lexical-editor'));
  private __rozieDestroyRef = inject(DestroyRef);

  constructor() {
    this.ctx = this.editorCtx;
  }

  ngAfterViewInit() {
    // Defer one microtask so the parent shell's $onMount has created the editor —
    // child mount hooks fire before the parent's on React/Vue/Solid (see RichTextPlugin
    // header for the full ordering note).
    queueMicrotask(this.activate);
    this.__rozieDestroyRef.onDestroy(() => {
      this.disposed = true;
      if (this.teardown) {
        this.teardown();
        this.teardown = null;
      }
    });
  }

  ctx: any = null;
  teardown: any = null;
  disposed = false;
  activate = () => {
    if (this.teardown || this.disposed) return;
    const editor = this.ctx && this.ctx.instance;
    if (!editor) return;
    // COMMAND mechanism: register the TOGGLE_LINK_COMMAND handler. Mirrors
    // @lexical/link's registerLink payload handling (null = unlink, string = url,
    // object = url + link attributes). Runs at EDITOR priority so it wins the
    // toggle before lower-priority handlers. registerCommand returns its own cleanup.
    this.teardown = editor.registerCommand(lexicalLink.TOGGLE_LINK_COMMAND, (payload: any) => {
      if (payload === null) {
        lexicalLink.$toggleLink(null);
        return true;
      } else if (typeof payload === 'string') {
        lexicalLink.$toggleLink(payload);
        return true;
      }
      const {
        url,
        target,
        rel,
        title
      } = payload;
      lexicalLink.$toggleLink(url, {
        rel,
        target,
        title
      });
      return true;
    }, lexical.COMMAND_PRIORITY_EDITOR);
  };
}

export default LinkPlugin;
