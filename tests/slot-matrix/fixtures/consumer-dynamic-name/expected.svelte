<script lang="ts">
import Producer from './producer.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let slotName = $state('a');
</script>


<Producer snippets={{ [slotName]: __rozieDynSlot_0 }}>{#snippet __rozieDynSlot_0()}Dynamic fill{/snippet}</Producer>

