import { rozieDisplay } from '@rozie/runtime-react';

interface DetailPanelProps {
  /**
   * The raw row object (the `#detail` slot scope `row` = `row.original`). This drop-in walks its own enumerable keys and String-coerces each value into a key/value definition list; a null row renders an empty list.
   */
  row?: (unknown) | null;
}

export default function DetailPanel(_props: DetailPanelProps): JSX.Element {
  const props: Omit<DetailPanelProps, 'row'> & { row: (unknown) | null } = {
    ..._props,
    row: _props.row ?? null,
  };

  function entries() {
    const r = props.row;
    if (!r) return [];
    return Object.keys(r).map((key: any) => ({
      key,
      value: r[key] == null ? '' : String(r[key])
    }));
  }

  return (
    <>
    <dl className={"rdt-detail-panel"} data-rozie-s-8f65bdaa="">
      
      {entries().map((pair) => <div key={pair.key} className={"rdt-detail-entry"} data-rozie-s-8f65bdaa="">
        <dt className={"rdt-detail-key"} data-rozie-s-8f65bdaa="">{rozieDisplay(pair.key)}</dt>
        <dd className={"rdt-detail-value"} data-rozie-s-8f65bdaa="">{rozieDisplay(pair.value)}</dd>
      </div>)}
    </dl>
    </>
  );
}
