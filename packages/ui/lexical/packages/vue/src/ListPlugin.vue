<template>
<!-- empty template -->
</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted } from 'vue';

const editorCtx = inject('rozie-lexical-editor');

// registerList installs the list node-transforms + insert/remove list command
// handlers (INSERT_UNORDERED_LIST_COMMAND / INSERT_ORDERED_LIST_COMMAND /
// REMOVE_LIST_COMMAND). Ordinary named import — not a `$`-API.
import { registerList } from '@lexical/list';

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
  // NODE-TRANSFORM mechanism: registerList returns the merged cleanup for its
  // ListNode/ListItemNode transforms + list command registrations.
  teardown = registerList(editor);
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
