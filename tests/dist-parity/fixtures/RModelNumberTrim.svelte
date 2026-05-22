<script lang="ts">
let quantity = $state(0);
</script>


<div class="rmodel-number-trim">
  <input type="text" value={quantity} oninput={($event) => quantity = ((__v) => { const __n = parseFloat(__v); return isNaN(__n) ? __v : __n; })((($event.currentTarget.value).trim()))} placeholder="Enter a quantity" />
  <p class="echo">Quantity: {quantity}</p>
</div>


<style>
.rmodel-number-trim { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.echo { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
</style>
