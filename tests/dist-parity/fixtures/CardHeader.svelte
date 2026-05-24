<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  title?: string;
  onClose?: ((...args: any[]) => any) | null;
  [key: string]: unknown;
}

let {
  title = '',
  onClose = null,
  ...__rozieAttrs
}: Props = $props();
</script>


<header {...__rozieAttrs} class={["card-header", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-f3e60f5a>
  <h3 class="card-header__title" data-rozie-s-f3e60f5a>{title}</h3>
  {#if onClose}<button class="card-header__close" onclick={($event) => { (onClose)($event); }} data-rozie-s-f3e60f5a>×</button>{/if}</header>


<style>
:global {
  .card-header[data-rozie-s-f3e60f5a] { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
  .card-header__title[data-rozie-s-f3e60f5a] { margin: 0; font-size: 1rem; font-weight: 600; }
  .card-header__close[data-rozie-s-f3e60f5a] { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
}
</style>
