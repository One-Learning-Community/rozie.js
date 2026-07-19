import { Component, DestroyRef, InjectionToken, ViewEncapsulation, effect, inject } from '@angular/core';

// registerList installs the list node-transforms + insert/remove list command
// handlers (INSERT_UNORDERED_LIST_COMMAND / INSERT_ORDERED_LIST_COMMAND /
// REMOVE_LIST_COMMAND). Ordinary named import — not a `$`-API.
import { registerList } from '@lexical/list';

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
  selector: 'rozie-list-plugin',
  standalone: true,
  template: `

  `,
  styles: [`
    :host(rozie-list-plugin) { display: contents; }
  `],
})
export class ListPlugin {
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
    // NODE-TRANSFORM mechanism: registerList returns the merged cleanup for its
    // ListNode/ListItemNode transforms + list command registrations.
    this.teardown = registerList(editor);
  };
}

export default ListPlugin;
