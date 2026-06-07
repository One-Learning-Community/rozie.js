<template>

<div class="rozie-engine-host" ref="__rozieRootRef" v-bind="$attrs"></div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const __rozieRootRef = ref<HTMLElement>();

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

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  instance = new MiniEngine(__rozieRootRef.value!);
  _cleanup_0 = () => instance?.destroy();
});
onBeforeUnmount(() => { _cleanup_0?.(); });
</script>

<style scoped>
.rozie-engine-host {
  display: block;
  position: relative;
}
</style>

<style>
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
  }
</style>
