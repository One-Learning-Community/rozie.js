<script lang="ts">
import Producer from './producer.svelte';
import Inner from './producer.svelte';

let outerOpen = $state(true);
let innerVal = $state('hello');
</script>


<Producer bind:open={outerOpen}>{#snippet footer({ close })}
    <Inner bind:open={outerOpen}></Inner>
    <button onclick={close}>×</button>
  {/snippet}</Producer>

