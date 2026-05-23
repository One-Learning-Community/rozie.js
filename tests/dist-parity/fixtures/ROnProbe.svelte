<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

let fn = $state(() => {});
let onInput = $state(() => {});
let f1 = $state(() => {});
let f2 = $state(() => {});
let someObj = $state({
  click: () => {},
  mouseenter: () => {}
});

const debouncedOnInput = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: any[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => (onInput as (...a: any[]) => any)(...args), 300);
  };
})();
</script>


<div class="r-on-probe">
  <span onclick={($event) => { $event.stopPropagation(); (fn as (...a: any[]) => any)($event); }} oninput={debouncedOnInput}>literal modifier-bearing</span>
  <span use:applyListeners={someObj}>dynamic</span>
  <span onclick={($event) => { (() => { (f1 as (...a: any[]) => any)($event); })(); (() => { (f2 as (...a: any[]) => any)($event); })(); }}>R6 source-order merge</span>
</div>


<style>
.r-on-probe {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.25rem;
}
.r-on-probe span {
  display: inline-block;
  padding: 0.125rem 0.25rem;
}
</style>
