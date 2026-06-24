---
title: Pagination — live demo
---

<script setup lang="ts">
import { ref, computed } from 'vue';
import Pagination from '@rozie-ui/pagination-vue';

// Network-free fixture: a fixed dataset paged client-side.
const ITEMS = Array.from({ length: 195 }, (_, i) => `Item ${i + 1}`);
const pageSize = 10;

const page = ref(1);
const lastChange = ref<number | null>(null);

const pageItems = computed(() => {
  const start = (page.value - 1) * pageSize;
  return ITEMS.slice(start, start + pageSize);
});

function onChange(e: { page: number }) {
  lastChange.value = e.page;
}

// A second instance driving custom slot rendering.
const page2 = ref(5);
</script>

# Pagination — live demo

This is the **real `@rozie-ui/pagination-vue` package** running on this page (VitePress is itself a Vue app). Click the page numbers, the prev/next arrows, or use the arrow keys to rove between controls — the two-way bound page updates and the `@change` readout fires. Everything below is driven by the same `Pagination.rozie` source that compiles to all six frameworks, with **no engine and no required CSS** — the windowing logic and a tokenised skin ship inside the component.

<ClientOnly>
<div class="pg-live">

  <p>Showing {{ pageItems.length }} of {{ ITEMS.length }} items — page {{ page }}.</p>

  <ul class="pg-live__list">
    <li v-for="label in pageItems" :key="label">{{ label }}</li>
  </ul>

  <Pagination
    v-model:modelValue="page"
    :total="ITEMS.length"
    :pageSize="pageSize"
    @change="onChange"
  />

  <p class="pg-live__readout">
    last <code>@change</code> page: <strong>{{ lastChange ?? '—' }}</strong>
  </p>

  <hr />

  <h2>Headless custom rendering</h2>
  <p>The same component with custom <code>#item</code> / <code>#prevControl</code> / <code>#nextControl</code> slots and a wider window (<code>:siblingCount="2"</code>):</p>

  <Pagination v-model:modelValue="page2" :totalPages="20" :siblingCount="2">
    <template #item="{ page, selected, goto }">
      <button
        class="pg-custom__btn"
        :class="{ 'pg-custom__btn--on': selected }"
        :aria-current="selected ? 'page' : undefined"
        @click="goto"
      >{{ page }}</button>
    </template>
    <template #ellipsis>⋯</template>
    <template #prevControl="{ disabled, goto }">
      <button class="pg-custom__btn" :disabled="disabled" @click="goto">‹ Prev</button>
    </template>
    <template #nextControl="{ disabled, goto }">
      <button class="pg-custom__btn" :disabled="disabled" @click="goto">Next ›</button>
    </template>
  </Pagination>

</div>
</ClientOnly>

<style scoped>
.pg-live { display: flex; flex-direction: column; gap: 1rem; }
.pg-live__list { margin: 0; padding-left: 1.25rem; columns: 2; min-height: 8rem; }
.pg-live__readout { font-size: 0.9rem; }
.pg-custom__btn {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  cursor: pointer;
}
.pg-custom__btn--on { background: var(--vp-c-brand-1); color: #fff; border-color: var(--vp-c-brand-1); }
.pg-custom__btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
