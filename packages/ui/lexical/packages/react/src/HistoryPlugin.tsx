import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';
// registerHistory installs the undo/redo update listener + command handlers;
// createEmptyHistoryState seeds a fresh (empty) undo/redo stack. Ordinary named
// imports — neither is a `$`-API.
import { registerHistory, createEmptyHistoryState } from '@lexical/history';

// The shared editor context object provided by the shell ({ get instance() {…} }).
// `$inject` binds to a `const` (ROZ132), then aliases through a null-`let`
// (typeNeutralize) so `.instance` type-checks on the strict bundled leaves; the alias
// is TOP-LEVEL scope so the hoisted Solid teardown can reach it (see RichTextPlugin
// header for the full rationale).

interface HistoryPluginProps {
  /**
   * Coalescing window in milliseconds for the history stack — edits landing within `delay` ms of each other collapse into a single undo step. The `registerHistory` delay argument. Lower values make undo more granular; 0 records every keystroke separately.
   */
  delay?: number;
}

export default function HistoryPlugin(_props: HistoryPluginProps): JSX.Element {
  const editorCtx = useContext(rozieContext("rozie-lexical-editor"));
  const props: Omit<HistoryPluginProps, 'delay'> & { delay: number } = {
    ..._props,
    delay: _props.delay ?? 300,
  };
  const attrs: Record<string, unknown> = (() => {
    const { delay, ...rest } = _props as HistoryPluginProps & Record<string, unknown>;
    void delay;
    return rest;
  })();
  const teardown = useRef<any>(null);
  const disposed = useRef(false);
  const ctx = useRef<any>(null);

  ctx.current = editorCtx;
  const activate = useCallback(() => {
    if (teardown.current || disposed.current) return;
    const editor = ctx.current && ctx.current.instance;
    if (!editor) return;
    // LISTENER mechanism: registerHistory returns the merged cleanup for its update
    // listener + undo/redo command registrations. A fresh empty history state is fine
    // — the shell seeds the initial (empty) document.
    teardown.current = registerHistory(editor, createEmptyHistoryState(), props.delay);
  }, [props.delay]);

  useEffect(() => {
    // Defer one microtask so the parent shell's $onMount has created the editor —
    // child mount hooks fire before the parent's on React/Vue/Solid (see RichTextPlugin
    // header for the full ordering note).
    queueMicrotask(activate);
    return () => {
      disposed.current = true;
      if (teardown.current) {
        teardown.current();
        teardown.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    null
  );
}
