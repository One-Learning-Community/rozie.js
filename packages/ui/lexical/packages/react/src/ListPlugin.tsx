import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';
// registerList installs the list node-transforms + insert/remove list command
// handlers (INSERT_UNORDERED_LIST_COMMAND / INSERT_ORDERED_LIST_COMMAND /
// REMOVE_LIST_COMMAND). Ordinary named import — not a `$`-API.
import { registerList } from '@lexical/list';

// The shared editor context object provided by the shell. `$inject` binds to a
// `const` (ROZ132), then aliases through a null-`let` (typeNeutralize) so `.instance`
// type-checks on the strict bundled leaves; TOP-LEVEL scope so the hoisted Solid
// teardown can reach it (see RichTextPlugin header for the full rationale).

interface ListPluginProps {}

export default function ListPlugin(props: ListPluginProps): JSX.Element {
  const editorCtx = useContext(rozieContext("rozie-lexical-editor"));
  const attrs = props as Record<string, unknown>;
  const teardown = useRef<any>(null);
  const disposed = useRef(false);
  const ctx = useRef<any>(null);

  ctx.current = editorCtx;
  const activate = useCallback(() => {
    if (teardown.current || disposed.current) return;
    const editor = ctx.current && ctx.current.instance;
    if (!editor) return;
    // NODE-TRANSFORM mechanism: registerList returns the merged cleanup for its
    // ListNode/ListItemNode transforms + list command registrations.
    teardown.current = registerList(editor);
  }, []);

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
