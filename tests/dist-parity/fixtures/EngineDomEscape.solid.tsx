import type { JSX } from 'solid-js';
import { onCleanup, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('EngineDomEscape-701c687a', `.rozie-engine-host[data-rozie-s-701c687a] {
  display: block;
  position: relative;
}
:root {
  --rozie-engine-accent: #4f46e5;
}
.rozie-engine-host .cm-editor {
    height: 100%;
    font-size: 13px;
    color: var(--rozie-engine-accent);
  }
.rozie-engine-host .cm-scroller {
    height: 100%;
    overflow: auto;
  }`);

interface EngineDomEscapeProps {}

export default function EngineDomEscape(_props: EngineDomEscapeProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  onMount(() => {
    const _cleanup = (() => {
    instance = new MiniEngine(__rozieRootRef!);
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => instance?.destroy());
  });
  let __rozieRootRef: HTMLElement | null = null;

  // Tiny inline "engine" that appends a `.cm-editor` element the author cannot
  // reach with scoped CSS (no Rozie scope attribute is stamped onto it). The
  // :root { } engine rule is the only mechanism that styles it across targets.
  class MiniEngine {
    constructor(rootEl: any) {
      this.rootEl = rootEl;
      const editor = document.createElement('div');
      editor.className = 'cm-editor';
      const scroller = document.createElement('div');
      scroller.className = 'cm-scroller';
      editor.appendChild(scroller);
      rootEl.appendChild(editor);
      this.editor = editor;
    }
    destroy() {
      if (this.editor) this.editor.remove();
      this.editor = null;
    }
  }
  let instance: any = null;

  return (
    <>
    <div ref={(el) => { __rozieRootRef = el as HTMLElement; }} {...attrs} class={"rozie-engine-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-701c687a="" />
    </>
  );
}
