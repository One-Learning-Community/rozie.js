<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let __rozieRoot = $state<HTMLElement | undefined>(undefined);

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

onMount(() => {
  instance = new MiniEngine(__rozieRoot!);
  return () => instance?.destroy();
});
</script>

<div bind:this={__rozieRoot} {...__rozieAttrs} class={["rozie-engine-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-701c687a></div>

<style>
:global {
  .rozie-engine-host[data-rozie-s-701c687a] {
    display: block;
    position: relative;
  }
}

:global(:root) {
--rozie-engine-accent: #4f46e5;
}

:global {
  .rozie-engine-host .cm-editor {
      height: 100%;
      font-size: 13px;
      color: var(--rozie-engine-accent);
    }
  .rozie-engine-host .cm-scroller {
      height: 100%;
      overflow: auto;
    }
}
</style>
