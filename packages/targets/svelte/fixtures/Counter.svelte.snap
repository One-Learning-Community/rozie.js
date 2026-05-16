<script lang="ts">
interface Props {
  value?: number;
  step?: number;
  min?: number;
  max?: number;
}

let {
  value = $bindable(0),
  step = 1,
  min = -Infinity,
  max = Infinity,
}: Props = $props();

let hovering = $state(false);

console.log("hello from rozie");
const increment = () => {
  if (canIncrement) value += step;
};
const decrement = () => {
  if (canDecrement) value -= step;
};

const canIncrement = $derived(value + step <= max);
const canDecrement = $derived(value - step >= min);
</script>


<div class={["counter", { hovering: hovering }]} onmouseenter={(e) => { hovering = true; }} onmouseleave={(e) => { hovering = false; }}>
  <button disabled={!canDecrement} aria-label="Decrement" onclick={decrement}>−</button>
  <span class="value">{value}</span>
  <button disabled={!canIncrement} aria-label="Increment" onclick={increment}>+</button>
</div>


<style>
.counter { display: inline-flex; gap: 0.5rem; align-items: center; }
.counter.hovering { background: rgba(0, 0, 0, 0.04); }
.value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
.counter button { padding: 0.25rem 0.5rem; }
.counter button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
