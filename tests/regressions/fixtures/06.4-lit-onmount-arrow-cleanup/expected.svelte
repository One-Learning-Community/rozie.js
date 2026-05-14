<script lang="ts">
let ticks = $state(0);
let running = $state(true);

// CR-04 reproduction: a concise-arrow $onMount whose body returns a teardown
// function must register that teardown as a cleanup, NOT silently drop it.
// Before the fix the Lit emitter ignored the returned function, leaking the
// resize subscription across disconnect. The teardown here is self-contained
// (no reference to a hoisted setup local) so the fixture isolates exactly the
// "is the returned cleanup registered?" contract.
const onResize = () => {
  ticks += 1;
};

$effect(() => {
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
});
</script>


<div class="ticker">{ticks}</div>


<style>
.ticker { font-variant-numeric: tabular-nums; }
</style>
