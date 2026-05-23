<script lang="ts">
import ThemedButton from './ThemedButton.svelte';
import ThemedButtonManual from './ThemedButtonManual.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>


<div {...__rozieAttrs} class={["themed-button-consumer", (__rozieAttrs)?.class]}>
  <ThemedButton id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" class="extra-variant" style="--btn-bg: #ef4444" label={'Auto'}></ThemedButton>

  <ThemedButtonManual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" class="extra-variant" style="--btn-bg: #10b981" label={'Manual'}></ThemedButtonManual>
</div>


<style>
.themed-button-consumer {
  display: inline-flex;
  gap: 0.75rem;
  padding: 0.5rem;
}
.extra-variant {
  font-weight: 600;
}
</style>
