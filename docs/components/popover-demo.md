---
title: Popover — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Popover from '@rozie-ui/popover-vue';

const clickOpen = ref(false);
const hoverOpen = ref(false);
const arrowOpen = ref(false);
const lastChange = ref<boolean | string>('—');

const pop = ref();

function onChange(next: boolean) {
  lastChange.value = next;
}
</script>

# Popover — live demo

This is the **real `@rozie-ui/popover-vue` package** running on this page (VitePress is itself a Vue app). Every cell below is driven by the same `Popover.rozie` source that compiles to all six frameworks, positioned by [`@floating-ui/dom`](https://floating-ui.com) with live `autoUpdate` tracking. Click triggers toggle a `role="dialog"` popover; hover triggers open a `role="tooltip"`; Escape and click-outside dismiss.

<ClientOnly>
<div class="pop-live">

  <div class="pop-live__cell">
    <div class="pop-live__head"><strong>trigger="click"</strong> <span class="pop-live__muted">— popover dialog</span></div>
    <Popover v-model:open="clickOpen" trigger="click" placement="bottom-start" :offset="8" arrow @change="onChange">
      <template #anchor="{ toggle }">
        <button @click="toggle">Open menu</button>
      </template>
      <div class="pop-live__panel">
        <p>Click outside or press Escape to dismiss.</p>
      </div>
    </Popover>
    <code class="pop-live__readout">open: {{ JSON.stringify(clickOpen) }}</code>
  </div>

  <div class="pop-live__cell">
    <div class="pop-live__head"><strong>trigger="hover"</strong> <span class="pop-live__muted">— tooltip</span></div>
    <Popover v-model:open="hoverOpen" trigger="hover" placement="top" :offset="6">
      <template #anchor>
        <button>Hover me</button>
      </template>
      <div class="pop-live__tip">A positioned tooltip.</div>
    </Popover>
  </div>

  <div class="pop-live__cell">
    <div class="pop-live__head">
      <strong>Imperative handle</strong>
      <span class="pop-live__sep" />
      <button @click="pop?.show()">show()</button>
      <button @click="pop?.hide()">hide()</button>
      <button @click="pop?.toggle()">toggle()</button>
      <button @click="pop?.reposition()">reposition()</button>
    </div>
    <Popover ref="pop" v-model:open="arrowOpen" trigger="click" placement="right" :offset="10" arrow>
      <template #anchor="{ toggle }">
        <button @click="toggle">Anchor</button>
      </template>
      <div class="pop-live__panel">Driven by `$expose` verbs.</div>
    </Popover>
    <code class="pop-live__readout">last @change: {{ JSON.stringify(lastChange) }}</code>
  </div>

</div>
</ClientOnly>

<style>
.pop-live { display: grid; gap: 2rem; margin-top: 1.5rem; }
.pop-live__cell { padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 12px; }
.pop-live__head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.pop-live__sep { flex: 1; }
.pop-live__muted { color: var(--vp-c-text-2); font-size: 0.85em; }
.pop-live__panel { min-width: 200px; }
.pop-live__tip { font-size: 0.85em; }
.pop-live__readout { display: block; margin-top: 1rem; font-size: 0.85em; color: var(--vp-c-text-2); }
.pop-live button { padding: 0.35rem 0.75rem; border: 1px solid var(--vp-c-brand-1); border-radius: 6px; background: transparent; color: var(--vp-c-brand-1); cursor: pointer; }
</style>
