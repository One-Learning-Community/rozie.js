<!--
  Phase 06.4 P3 SC5 — Svelte 5 consuming a compiled Lit custom element.

  Per RESEARCH.md Pattern 11 + Pitfall 8 (sveltejs/svelte#3566): Svelte 5
  does NOT support two-way binding on custom elements. Use the event-attribute
  form: `value={val}` for prop, `onvalue-change={handler}` for events.

  This is a standalone .svelte file that App.svelte renders when current
  routes to 'lit-interop'. The svelte-vite demo does not use SvelteKit
  file-routing — this file lives under src/routes/lit-interop/ to match the
  plan's expected path but is imported explicitly by App.svelte.
-->
<script lang="ts">
  import '../../lit-fixtures/Counter.lit';

  let val = $state<number>(5);
</script>

<div>
  <h2>Lit Interop (Svelte)</h2>
  <p>Svelte 5 consuming compiled Lit <code>&lt;rozie-counter&gt;</code>.</p>
  <rozie-counter
    value={val}
    step={1}
    min={-10}
    max={10}
    onvalue-change={(e: Event) => {
      val = (e as CustomEvent).detail as number;
    }}
  ></rozie-counter>
  <p>
    Parent-tracked value:
    <span data-testid="parent-value">{val}</span>
  </p>
</div>
