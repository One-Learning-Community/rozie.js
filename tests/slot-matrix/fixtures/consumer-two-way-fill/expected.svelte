<script lang="ts">
import Producer from './producer.svelte';
import Inner from './producer.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let outerOpen = $state(true);
let innerVal = $state('hello');
</script>


<Producer bind:open={outerOpen} data-rozie-s-bd0c3708>{#snippet footer({ close })}
    <Inner bind:open={outerOpen} data-rozie-s-bd0c3708></Inner>
    <button onclick={close} data-rozie-s-bd0c3708>×</button>
  {/snippet}</Producer>

