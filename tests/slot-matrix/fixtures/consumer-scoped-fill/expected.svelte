<script lang="ts">
import Producer from './producer.svelte';


</script>


<Producer>{#snippet header({ close })}
    <button onclick={close}>×</button>
  {/snippet}
  Body text
</Producer>

