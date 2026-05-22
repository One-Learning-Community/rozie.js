<template>

<div class="rozie-portal-list" ref="__rozieRootRef" v-bind="$attrs">
  
</div>

</template>

<script setup lang="ts">
import { Fragment, h, onBeforeUnmount, onMounted, ref, render, useSlots } from 'vue';

const props = withDefaults(
  defineProps<{ items?: any[] }>(),
  { items: () => [] }
);

defineSlots<{
  item(props: { item: any }): any;
}>();

const slots = useSlots();

const __rozieRootRef = ref<HTMLElement>();

// Tiny inline "engine" — same shape as examples/PortalList.rozie but
// with the inline-style ceremony removed. The engine now just creates
// structural DOM; cosmetic styling is the wrapper's <style> block's job.
//
// Destruction order still matters: dispose all cells BEFORE removing
// the structural container (same constraint as FullCalendar / AG-Grid).
class MiniListEngine {
  constructor(rootEl: any, opts: any) {
    this.rootEl = rootEl;
    this.items = opts.items;
    this.cellRenderer = opts.cellRenderer;
    this.disposers = [];
    this._mount();
  }
  _mount() {
    const ul = document.createElement('ul');
    for (const item of this.items as any) {
      const li = document.createElement('li');
      const cell = this.cellRenderer(item);
      li.appendChild(cell.node);
      this.disposers.push(cell.dispose);
      ul.appendChild(li);
    }
    this.rootEl.appendChild(ul);
  }
  destroy() {
    for (const dispose of this.disposers as any) dispose();
    this.disposers = [];
    while (this.rootEl.firstChild) this.rootEl.removeChild(this.rootEl.firstChild);
  }
}
let instance: any = null;

const portalContainers = new Set<HTMLElement>();
const portals = {
  item: (container: HTMLElement, scope: { item: unknown }): (() => void) => {
    const slotFn = slots.item;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // item { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-item', '18e5aac6');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
};
onBeforeUnmount(() => {
  for (const container of portalContainers) render(null, container);
  portalContainers.clear();
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  instance = new MiniListEngine(__rozieRootRef.value!, {
    items: props.items,
    cellRenderer: (item: any) => {
      const node = document.createElement('div');
      const dispose = portals.item(node, {
        item
      });
      return {
        node,
        dispose
      };
    }
  });
  _cleanup_0 = () => instance?.destroy();
});
onBeforeUnmount(() => { _cleanup_0?.(); });
</script>

<style scoped>
.rozie-portal-list {
  display: block;
  font-family: system-ui, -apple-system, sans-serif;
}
</style>

<style>
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] ul {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  overflow: hidden;
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] li {
  padding: 0.5rem 0.75rem;
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] li + li {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
