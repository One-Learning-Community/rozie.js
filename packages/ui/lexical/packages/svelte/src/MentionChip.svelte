<!--
  MentionChip.svelte — the trivial Svelte 5 `@mention` pill the svelte decorator
  bridge (mountDecorators.svelte.ts) `mount()`s into each Lexical decorator host.
  Deliberately minimal (D-12). The label is rendered via `{label}` text
  interpolation — Svelte escapes it; this component never uses `{@html}`
  (T-76-04-XSS). Vendored beside the bridge into the Svelte leaf by codegen.
-->
<script lang="ts">
  let { label, id = null }: { label: string; id?: string | null } = $props();
</script>

<span class="rozie-mention" data-mention-id={id}>@{label}</span>
