<script lang="ts">
import { rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  /**
   * The raw row object (the `#detail` slot scope `row` = `row.original`). This drop-in walks its own enumerable keys and String-coerces each value into a key/value definition list; a null row renders an empty list.
   */
  row?: (unknown) | null;
}

let { row = null }: Props = $props();

// Plain setup-once helper (NOT $computed — a $computed can't be aliased; the
// EditorSelect plain-function lesson). Build `[{ key, value }]` from the row's own
// enumerable keys, String-coercing each value. A null row yields an empty list.
const entries = () => {
  const r = row;
  if (!r) return [];
  return Object.keys(r).map((key: any) => ({
    key,
    value: r[key] == null ? '' : String(r[key])
  }));
};
</script>

<dl class="rdt-detail-panel" data-rozie-s-8f65bdaa>{#each entries() as pair (pair.key)}<div class="rdt-detail-entry" data-rozie-s-8f65bdaa><dt class="rdt-detail-key" data-rozie-s-8f65bdaa>{rozieDisplay(pair.key)}</dt><dd class="rdt-detail-value" data-rozie-s-8f65bdaa>{rozieDisplay(pair.value)}</dd></div>{/each}</dl>
