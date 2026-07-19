<template>
<!-- empty template -->
</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Coalescing window in milliseconds for the history stack — edits landing within `delay` ms of each other collapse into a single undo step. The `registerHistory` delay argument. Lower values make undo more granular; 0 records every keystroke separately.
     */
    delay?: number;
  }>(),
  { delay: 300 }
);

const editorCtx = inject('rozie-lexical-editor');

// registerHistory installs the undo/redo update listener + command handlers;
// createEmptyHistoryState seeds a fresh (empty) undo/redo stack. Ordinary named
// imports — neither is a `$`-API.
import { registerHistory, createEmptyHistoryState } from '@lexical/history';

// The shared editor context object provided by the shell ({ get instance() {…} }).
// `$inject` binds to a `const` (ROZ132), then aliases through a null-`let`
// (typeNeutralize) so `.instance` type-checks on the strict bundled leaves; the alias
// is TOP-LEVEL scope so the hoisted Solid teardown can reach it (see RichTextPlugin
// header for the full rationale).
let ctx: any = null;
ctx = editorCtx;
let teardown: any = null;
let disposed = false;
const activate = () => {
  if (teardown || disposed) return;
  const editor = ctx && ctx.instance;
  if (!editor) return;
  // LISTENER mechanism: registerHistory returns the merged cleanup for its update
  // listener + undo/redo command registrations. A fresh empty history state is fine
  // — the shell seeds the initial (empty) document.
  teardown = registerHistory(editor, createEmptyHistoryState(), props.delay);
};

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // Defer one microtask so the parent shell's $onMount has created the editor —
  // child mount hooks fire before the parent's on React/Vue/Solid (see RichTextPlugin
  // header for the full ordering note).
  queueMicrotask(activate);
  _cleanup_0 = () => {
    disposed = true;
    if (teardown) {
      teardown();
      teardown = null;
    }
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });
</script>
