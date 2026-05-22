<script lang="ts">
import ThemedButton from './ThemedButton.svelte';
import ThemedButtonManual from './ThemedButtonManual.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>


<div class="themed-button-consumer" {...__rozieAttrs}>
  <ThemedButton id="auto-btn" type="button" ariaLabel="Auto-fallthrough button" dataTestid="auto-themed-button" class="extra-variant" style="--btn-bg: #ef4444" label={'Auto'}></ThemedButton>

  <ThemedButtonManual id="manual-btn" type="button" ariaLabel="Manual fallthrough button" dataTestid="manual-themed-button" class="extra-variant" style="--btn-bg: #10b981" label={'Manual'}></ThemedButtonManual>
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
