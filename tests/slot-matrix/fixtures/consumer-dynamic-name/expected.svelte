<script lang="ts">
import Producer from './producer.svelte';

let slotName = $state('a');
</script>


<Producer snippets={{ [slotName]: __rozieDynSlot_0 }}>{#snippet __rozieDynSlot_0()}Dynamic fill{/snippet}</Producer>

