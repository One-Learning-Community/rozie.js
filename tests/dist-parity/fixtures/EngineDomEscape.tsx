import { useEffect, useRef } from 'react';
import { clsx } from '@rozie/runtime-react';
import './EngineDomEscape.css';
import './EngineDomEscape.global.css';

interface EngineDomEscapeProps {}

export default function EngineDomEscape(props: EngineDomEscapeProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const instance = useRef<any>(null);
  const __rozieRoot = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    instance.current = new MiniEngine(__rozieRoot.current!);
    return () => instance.current?.destroy();
  }, []);

  return (
    <>
    <div ref={__rozieRoot} {...attrs} className={clsx("rozie-engine-host", (attrs.className as string | undefined))} data-rozie-s-701c687a="" />
    </>
  );
}
