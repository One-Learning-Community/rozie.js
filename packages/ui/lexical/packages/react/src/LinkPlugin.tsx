import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';
// NAMESPACE imports (D-05): both the priority constant and the `$`-API come through
// namespace bindings so no bare `$`-identifier ever reaches the Svelte compiler.
import * as lexical from 'lexical';
import * as lexicalLink from '@lexical/link';

// The shared editor context object provided by the shell. `$inject` binds to a
// `const` (ROZ132), then aliases through a null-`let` (typeNeutralize) so `.instance`
// type-checks on the strict bundled leaves; TOP-LEVEL scope so the hoisted Solid
// teardown can reach it (see RichTextPlugin header for the full rationale).

interface LinkPluginProps {}

export default function LinkPlugin(props: LinkPluginProps): JSX.Element {
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
    // COMMAND mechanism: register the TOGGLE_LINK_COMMAND handler. Mirrors
    // @lexical/link's registerLink payload handling (null = unlink, string = url,
    // object = url + link attributes). Runs at EDITOR priority so it wins the
    // toggle before lower-priority handlers. registerCommand returns its own cleanup.
    teardown.current = editor.registerCommand(lexicalLink.TOGGLE_LINK_COMMAND, (payload: any) => {
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
