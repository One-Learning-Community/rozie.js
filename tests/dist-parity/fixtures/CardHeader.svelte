<script lang="ts">
interface Props {
  title?: string;
  onClose?: (...args: any[]) => any;
}

let { title = '', onClose = null }: Props = $props();
</script>


<header class="card-header">
  <h3 class="card-header__title">{title}</h3>
  {#if onClose}<button class="card-header__close" onclick={(e) => { (onClose)(e); }}>×</button>{/if}</header>


<style>
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
.card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
.card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
</style>
