import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';
// registerRichText wires the rich-text command set (formatting, paragraph/heading
// behavior, node transforms). Ordinary named import — not a `$`-API.
import { registerRichText } from '@lexical/rich-text';

// The shared editor context object provided by the shell ({ get instance() {…} },
// spike 010 late-binding getter). `$inject` must bind directly to a `const` (ROZ132);
// it is then aliased through a null-`let` (typeNeutralize) so the `.instance` read
// type-checks under the strict bundled-leaf tsc — `$inject` is typed `unknown`
// (Phase 36 D-4), which would reject `.instance` with TS2339. The alias is kept at
// TOP-LEVEL script scope (not mount-local) so the Solid teardown — which the Solid
// emitter hoists into a sibling onCleanup OUTSIDE the mount closure — can reach it
// (the ADDING-A-FAMILY cross-phase-scope idiom, per Layer.rozie).

interface RichTextPluginProps {}

export default function RichTextPlugin(props: RichTextPluginProps): JSX.Element {
  const editorCtx = useContext(rozieContext("rozie-lexical-editor"));
  const attrs = props as Record<string, unknown>;
  const teardown = useRef<any>(null);
  const disposed = useRef(false);
  const ctx = useRef<any>(null);

  ctx.current = editorCtx;

  // The register* cleanup, captured once we actually register. null = not yet / torn
  // down. `disposed` guards the deferred activation against an unmount that races ahead
  // of the microtask below.
  const activate = useCallback(() => {
    if (teardown.current || disposed.current) return;
    const editor = ctx.current && ctx.current.instance;
    if (!editor) return;
    // Idempotency marker: never stack a second registerRichText on the same editor
    // (two <RichTextPlugin/> children, or a plugin plus a future re-entry). The shell's
    // own baseline is registered independently in its $onMount; this guard prevents
    // PLUGIN-level duplication and keeps teardown symmetric.
    if (editor.__rozieRichTextRegistered) return;
    editor.__rozieRichTextRegistered = true;
    const cleanup = registerRichText(editor);
    teardown.current = () => {
      cleanup();
      editor.__rozieRichTextRegistered = false;
    };
  }, []);

  useEffect(() => {
    // The shell creates the editor in ITS $onMount. On React/Vue/Solid a CHILD's mount
    // hook runs BEFORE the parent's, so `ctx.instance` is still null at THIS instant.
    // Defer one microtask: by the time it runs, the parent shell's $onMount has
    // completed and the live editor is bound through the getter (the shell's stated
    // "a plugin that mounts AFTER the shell reads the current instance" contract).
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
