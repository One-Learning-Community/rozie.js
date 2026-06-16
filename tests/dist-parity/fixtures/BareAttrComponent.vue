<template>

<div class="bare-attr-component" v-bind="$attrs">
  <BareAttrChild :combobox="true"></BareAttrChild>
  <div hidden></div>
</div>

</template>

<script setup lang="ts">
import BareAttrChild from './BareAttrChild.vue';


</script>
