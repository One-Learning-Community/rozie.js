import { Component, DestroyRef, InjectionToken, ViewEncapsulation, effect, inject, input } from '@angular/core';

// registerHistory installs the undo/redo update listener + command handlers;
// createEmptyHistoryState seeds a fresh (empty) undo/redo stack. Ordinary named
// imports — neither is a `$`-API.
import { registerHistory, createEmptyHistoryState } from '@lexical/history';

// The shared editor context object provided by the shell ({ get instance() {…} }).
// `$inject` binds to a `const` (ROZ132), then aliases through a null-`let`
// (typeNeutralize) so `.instance` type-checks on the strict bundled leaves; the alias
// is TOP-LEVEL scope so the hoisted Solid teardown can reach it (see RichTextPlugin
// header for the full rationale).

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
  selector: 'rozie-history-plugin',
  standalone: true,
  template: `

  `,
  styles: [`
    :host(rozie-history-plugin) { display: contents; }
  `],
})
export class HistoryPlugin {
  /**
   * Coalescing window in milliseconds for the history stack — edits landing within `delay` ms of each other collapse into a single undo step. The `registerHistory` delay argument. Lower values make undo more granular; 0 records every keystroke separately.
   */
  delay = input<number>(300);
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
    // LISTENER mechanism: registerHistory returns the merged cleanup for its update
    // listener + undo/redo command registrations. A fresh empty history state is fine
    // — the shell seeds the initial (empty) document.
    this.teardown = registerHistory(editor, createEmptyHistoryState(), this.delay());
  };
}

export default HistoryPlugin;
