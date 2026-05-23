<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  header?: Snippet;
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  title = '',
  header: __headerProp,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const header = $derived(__headerProp ?? snippets?.header);
const children = $derived(__childrenProp ?? snippets?.children);
</script>


<section {...__rozieAttrs} class={["panel", (__rozieAttrs)?.class]}>
  {#if header || title}<header>
    
    {#if header}{@render header()}{:else}{title}{/if}
  </header>{/if}<div class="body">
    {@render children?.()}
  </div>
</section>


<style>
.panel { border: 1px solid rgba(0, 0, 0, 0.1); }
</style>
