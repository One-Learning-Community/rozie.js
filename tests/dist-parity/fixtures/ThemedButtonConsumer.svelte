<script lang="ts">
import ThemedButton from './ThemedButton.svelte';
import ThemedButtonManual from './ThemedButtonManual.svelte';
import ThemedButtonListenersManual from './ThemedButtonListenersManual.svelte';
import ThemedButtonAllManual from './ThemedButtonAllManual.svelte';
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let onClick = $state(() => {});
let onMouseEnter = $state(() => {});
</script>

<div {...__rozieAttrs} class={["themed-button-consumer", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-14b8cbaa><ThemedButton id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" class="extra-variant" style="--btn-bg: #ef4444" label={'Auto'} onclick={onClick} onmouseenter={onMouseEnter} data-rozie-s-14b8cbaa></ThemedButton><ThemedButtonManual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" class="extra-variant" style="--btn-bg: #10b981" label={'Manual'} onclick={onClick} onmouseenter={onMouseEnter} data-rozie-s-14b8cbaa></ThemedButtonManual><ThemedButtonListenersManual id="listeners-manual-btn" type="button" aria-label="Listeners-manual fallthrough button" data-testid="listeners-manual-themed-button" class="extra-variant" style="--btn-bg: #f59e0b" label={'Listeners Manual'} onclick={onClick} onmouseenter={onMouseEnter} data-rozie-s-14b8cbaa></ThemedButtonListenersManual><ThemedButtonAllManual id="all-manual-btn" type="button" aria-label="All-manual fallthrough button" data-testid="all-manual-themed-button" class="extra-variant" style="--btn-bg: #8b5cf6" label={'All Manual'} onclick={onClick} onmouseenter={onMouseEnter} data-rozie-s-14b8cbaa></ThemedButtonAllManual></div>

<style>
:global {
  .themed-button-consumer[data-rozie-s-14b8cbaa] {
    display: inline-flex;
    gap: 0.75rem;
    padding: 0.5rem;
  }
  .extra-variant[data-rozie-s-14b8cbaa] {
    font-weight: 600;
  }
}
</style>
