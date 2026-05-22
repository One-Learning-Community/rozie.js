<script lang="ts">
interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let draft = $state('');
</script>


<div class="rmodel-lazy" {...__rozieAttrs}>
  <input type="text" value={draft} onchange={($event) => draft = $event.currentTarget.value} placeholder="Commit on blur" />
  <p class="echo">Committed: {draft}</p>
</div>


<style>
.rmodel-lazy { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.echo { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
</style>
