<template>

<div class="named-slots-fixture">
  <header>
    <slot name="header"></slot>
  </header>
  <footer>
    <slot name="footer"></slot>
  </footer>
</div>

</template>

<script setup lang="ts">
defineSlots<{
  header(props: {  }): any;
  footer(props: {  }): any;
}>();
</script>
