---
title: Command Palette — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import CommandPalette from '@rozie-ui/command-palette-vue';

const open = ref(false);
const query = ref('');
const lastRun = ref<string>('—');

const palette = ref();

const commands = [
  { id: 'new', label: 'New File', group: 'File', keywords: ['create', 'add'] },
  { id: 'open', label: 'Open File', group: 'File', keywords: ['load'] },
  { id: 'save', label: 'Save', group: 'File', keywords: ['write', 'persist'] },
  { id: 'find', label: 'Find in Files', group: 'Edit', keywords: ['search', 'grep'] },
  { id: 'replace', label: 'Replace', group: 'Edit' },
  { id: 'theme', label: 'Toggle Theme', group: 'App', keywords: ['dark', 'light'] },
  { id: 'settings', label: 'Preferences', group: 'App', keywords: ['config', 'options'] },
  { id: 'logout', label: 'Sign Out', group: 'App', disabled: true },
];

function onSelect(e: { id: string; label: string }) {
  lastRun.value = e.label;
}
</script>

# Command Palette — live demo

This is the **real `@rozie-ui/command-palette-vue` package** running on this page (VitePress is itself a Vue app). The same `CommandPalette.rozie` source compiles to all six frameworks. Open the palette, type to filter over labels **and** keywords (e.g. `grep` finds "Find in Files"), navigate with ArrowUp / ArrowDown, press Enter to run, and Escape or a backdrop click to dismiss.

<ClientOnly>
<div class="cmdk-live">

  <div class="cmdk-live__head">
    <button @click="open = true">Open palette</button>
    <button @click="palette?.toggle()">toggle()</button>
    <button @click="palette?.show()">show()</button>
    <button @click="palette?.close()">close()</button>
  </div>

  <code class="cmdk-live__readout">open: {{ JSON.stringify(open) }} · query: {{ JSON.stringify(query) }} · last @select: {{ lastRun }}</code>

  <CommandPalette
    ref="palette"
    v-model:open="open"
    v-model:query="query"
    :items="commands"
    placeholder="Type a command or search…"
    @select="onSelect"
  >
    <template #footer>
      <span>↑↓ to navigate · ↵ to run · esc to close</span>
    </template>
  </CommandPalette>

</div>
</ClientOnly>

<style>
.cmdk-live { margin-top: 1.5rem; }
.cmdk-live__head { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.cmdk-live__readout { display: block; font-size: 0.85em; color: var(--vp-c-text-2); }
.cmdk-live button { padding: 0.35rem 0.75rem; border: 1px solid var(--vp-c-brand-1); border-radius: 6px; background: transparent; color: var(--vp-c-brand-1); cursor: pointer; }
</style>
