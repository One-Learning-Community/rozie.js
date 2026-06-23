import type { JSX } from 'solid-js';
import { For, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface DetailPanelProps {
  row?: (unknown) | null;
}

export default function DetailPanel(_props: DetailPanelProps): JSX.Element {
  const _merged = mergeProps({ row: null }, _props);
  const [local, attrs] = splitProps(_merged, ['row']);

  // Plain setup-once helper (NOT $computed — a $computed can't be aliased; the
  // EditorSelect plain-function lesson). Build `[{ key, value }]` from the row's own
  // enumerable keys, String-coercing each value. A null row yields an empty list.
  function entries() {
    const r = local.row;
    if (!r) return [];
    return Object.keys(r).map((key: any) => ({
      key,
      value: r[key] == null ? '' : String(r[key])
    }));
  }

  return (
    <>
    <dl class={"rdt-detail-panel"} data-rozie-s-8f65bdaa="">
      
      <For each={entries()}>{(pair) => <div class={"rdt-detail-entry"} data-rozie-s-8f65bdaa="">
        <dt class={"rdt-detail-key"} data-rozie-s-8f65bdaa="">{rozieDisplay(pair.key)}</dt>
        <dd class={"rdt-detail-value"} data-rozie-s-8f65bdaa="">{rozieDisplay(pair.value)}</dd>
      </div>}</For>
    </dl>
    </>
  );
}
