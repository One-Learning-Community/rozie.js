<!--
  svelte-ts R6/AC-10 negative-path wrapper — proves svelte-check rejects a
  misspelled param destructure inside a family snippet fill.
-->
<script lang="ts">
import DynamicSlots from '../fixtures/DynamicSlots.svelte';
</script>

{#snippet cellStatusBadSnippet({ rowx, value }: { rowx: unknown; value: unknown })}
  <span>{rowx}{value}</span>
{/snippet}

<DynamicSlots
  row={{ status: 'ok' }}
  total={3}
  snippets={{
    // @ts-expect-error — 'rowx' does not exist on the cell- family's scope shape (its param is 'row', not 'rowx')
    'cell-status': cellStatusBadSnippet,
  }}
/>
