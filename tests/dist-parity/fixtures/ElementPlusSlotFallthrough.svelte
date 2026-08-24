<script lang="ts">
import { applyListeners, rozieClass } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  variant?: string;
  header?: Snippet;
  children?: Snippet;
  footer?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  variant = 'primary',
  header: __headerProp,
  children: __childrenProp,
  footer: __footerProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const header = $derived(__headerProp ?? snippets?.header);
const children = $derived(__childrenProp ?? snippets?.children);
const footer = $derived(__footerProp ?? snippets?.footer);
</script>

{@render header?.()}<div {...__rozieAttrs} class={["epsf-root", rozieClass('epsf-root--' + variant), (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-986e3472>chrome</div>{@render children?.()}{@render footer?.()}

<style>
:global {
  .epsf-root[data-rozie-s-986e3472] {
    display: block;
    padding: 0.5rem;
    border: 1px solid #ddd;
  }
}
</style>
