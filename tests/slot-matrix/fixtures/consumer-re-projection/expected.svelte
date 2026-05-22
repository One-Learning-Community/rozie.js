<script lang="ts">
import Wrapper from './wrapper.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>


<Wrapper>{#snippet title()}Hello from consumer{/snippet}</Wrapper>

