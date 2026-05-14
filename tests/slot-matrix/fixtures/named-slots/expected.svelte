<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  header?: Snippet;
  footer?: Snippet;
}

let { header, footer }: Props = $props();
</script>


<div class="named-slots-fixture">
  <header>
    {@render header?.()}
  </header>
  <footer>
    {@render footer?.()}
  </footer>
</div>

