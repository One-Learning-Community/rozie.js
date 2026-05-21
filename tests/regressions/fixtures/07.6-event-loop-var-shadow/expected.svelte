<script lang="ts">
let items = $state([{
  id: 'a',
  label: 'A'
}, {
  id: 'b',
  label: 'B'
}]);

const removeItem = (id: any) => {
  items = items.filter((x: any) => x.id !== id);
};
</script>


<ul>
  {#each items as e (e.id)}<li>
    <span>{e.label}</span>
    
    <button type="button" onclick={($event) => { removeItem(e.id); }}>×</button>
  </li>{/each}
</ul>

