<!--
  svelte-ts R6/AC-10 wrapper — exercises DynamicSlots' template-literal-keyed
  family snippets type surface under svelte-check. Mirrors the REAL emitted
  consumer form a matchedFamily fill produces (top-level {#snippet} blocks +
  a `snippets={{ 'key': snippetVar }}` prop), per
  `packages/targets/svelte/src/__tests__/slotDynamicNameRouting.test.ts`'s
  own documented shape.
-->
<script lang="ts">
import DynamicSlots from '../fixtures/DynamicSlots.svelte';
</script>

{#snippet cellStatusSnippet({ row, value }: { row: unknown; value: unknown })}
  <span>{row}{value}</span>
{/snippet}

{#snippet rowAnythingSnippet()}
  <em>fallback</em>
{/snippet}

{#snippet cellTotalSnippet({ value }: { value: unknown })}
  <strong>{value}</strong>
{/snippet}

<DynamicSlots
  row={{ status: 'ok' }}
  total={3}
  snippets={{ 'cell-status': cellStatusSnippet, 'row-anything': rowAnythingSnippet, 'cell-total': cellTotalSnippet }}
/>
