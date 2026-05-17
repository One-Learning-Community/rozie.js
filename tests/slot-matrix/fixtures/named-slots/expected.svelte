<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  header?: Snippet;
  footer?: Snippet;
  snippets?: Record<string, Snippet<[any]>>;
}

let {
  header: __headerProp,
  footer: __footerProp,
  snippets,
}: Props = $props();

const header = $derived(__headerProp ?? snippets?.header);
const footer = $derived(__footerProp ?? snippets?.footer);
</script>


<div class="named-slots-fixture">
  <header>
    {@render header?.()}
  </header>
  <footer>
    {@render footer?.()}
  </footer>
</div>

