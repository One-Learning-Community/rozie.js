<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  label?: string;
  variant?: string;
  [key: string]: unknown;
}

let {
  label = 'Click me',
  variant = 'primary',
  ...__rozieAttrs
}: Props = $props();
</script>

<button style="--btn-bg: #3b82f6; --btn-fg: #ffffff" {...__rozieAttrs} class={["btn", variant, (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-671f0616>{label}</button>

<style>
:global {
  .btn[data-rozie-s-671f0616] {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: var(--btn-bg, #3b82f6);
    color: var(--btn-fg, #ffffff);
    font: inherit;
    cursor: pointer;
  }
  .btn[data-rozie-s-671f0616]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
