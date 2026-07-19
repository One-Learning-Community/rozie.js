<script lang="ts">
import { getContext, onMount } from 'svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

const editorCtx = getContext('rozie-lexical-editor');

// NAMESPACE imports (D-05): both the priority constant and the `$`-API come through
// namespace bindings so no bare `$`-identifier ever reaches the Svelte compiler.
import * as lexical from 'lexical';
import * as lexicalLink from '@lexical/link';

// The shared editor context object provided by the shell. `$inject` binds to a
// `const` (ROZ132), then aliases through a null-`let` (typeNeutralize) so `.instance`
// type-checks on the strict bundled leaves; TOP-LEVEL scope so the hoisted Solid
// teardown can reach it (see RichTextPlugin header for the full rationale).
let ctx: any = null;
ctx = editorCtx;
let teardown: any = null;
let disposed = false;
const activate = () => {
  if (teardown || disposed) return;
  const editor = ctx && ctx.instance;
  if (!editor) return;
  // COMMAND mechanism: register the TOGGLE_LINK_COMMAND handler. Mirrors
  // @lexical/link's registerLink payload handling (null = unlink, string = url,
  // object = url + link attributes). Runs at EDITOR priority so it wins the
  // toggle before lower-priority handlers. registerCommand returns its own cleanup.
  teardown = editor.registerCommand(lexicalLink.TOGGLE_LINK_COMMAND, (payload: any) => {
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

onMount(() => {
  // Defer one microtask so the parent shell's $onMount has created the editor —
  // child mount hooks fire before the parent's on React/Vue/Solid (see RichTextPlugin
  // header for the full ordering note).
  queueMicrotask(activate);
  return () => {
    disposed = true;
    if (teardown) {
      teardown();
      teardown = null;
    }
  };
});
</script>

<!-- empty template -->
