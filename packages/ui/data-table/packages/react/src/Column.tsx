import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface ColumnProps {
  id?: string;
  field?: string;
  header?: string;
  sortable?: boolean;
  filterable?: boolean;
  pinned?: string;
  width?: string | number;
}

export default function Column(_props: ColumnProps): JSX.Element {
  const registry = useContext(rozieContext("data-table:columns"));
  const props: Omit<ColumnProps, 'id' | 'field' | 'header' | 'sortable' | 'filterable' | 'pinned' | 'width'> & { id: string; field: string; header: string; sortable: boolean; filterable: boolean; pinned: string; width: string | number } = {
    ..._props,
    id: _props.id ?? '',
    field: _props.field ?? '',
    header: _props.header ?? '',
    sortable: _props.sortable ?? false,
    filterable: _props.filterable ?? false,
    pinned: _props.pinned ?? '',
    width: _props.width ?? '',
  };
  const reg = useRef<any>(null);
  const registered = useRef(false);
  const _watch0First = useRef(true);

  reg.current = registry;

  // idempotency flag so a reactive late-context registration (Lit async first paint,
  // REQ-30) and the $onMount registration never double-register the column.
  const colId = useCallback(() => props.id !== '' ? props.id : props.field, [props.field, props.id]);
  const buildSpec = useCallback(() => ({
    id: colId(),
    field: props.field !== '' ? props.field : colId(),
    header: props.header,
    sortable: props.sortable,
    filterable: props.filterable,
    pinned: props.pinned,
    width: props.width
  }), [colId, props.field, props.filterable, props.header, props.pinned, props.sortable, props.width]);

  useEffect(() => {
    // register this column's spec. On Lit the injected registry may still be undefined
    // here (REQ-30 async context); the $onUpdate below performs the registration once
    // the value arrives.
    if (reg.current && !registered.current) {
      registered.current = true;
      reg.current.registerColumn(colId(), buildSpec());
    }
    return () => {
      if (reg.current) reg.current.unregisterColumn(colId());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (registered.current) return;
    const live = registry;
    if (live == null) return;
    reg.current = live;
    registered.current = true;
    reg.current.registerColumn(colId(), buildSpec());
  }, [buildSpec, colId, reg, registered, registry]);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    if (reg.current) reg.current.registerColumn(colId(), buildSpec());
  }, [props.field, props.filterable, props.header, props.id, props.pinned, props.sortable, props.width]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>

    <div className={"rozie-data-table-column"} style={{ display: "none" }} data-rozie-s-289f2d72="" />
    </>
  );
}
