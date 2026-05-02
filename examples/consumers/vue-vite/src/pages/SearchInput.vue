<template>
  <main class="search-input-page">
    <h2>SearchInput Demo</h2>
    <SearchInputRozie
      :placeholder="'Search…'"
      :min-length="2"
      :autofocus="false"
      @search="onSearch"
      @clear="onClear"
    />
    <p v-if="lastQuery">Last query: {{ lastQuery }}</p>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SearchInputRozie from '../../../../SearchInput.rozie';

const lastQuery = ref('');
const onSearch = (q: string) => {
  lastQuery.value = q;
};
const onClear = () => {
  lastQuery.value = '';
};
</script>

<style scoped>
.search-input-page {
  padding: 1rem;
}
</style>
