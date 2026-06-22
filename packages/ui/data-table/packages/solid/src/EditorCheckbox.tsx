import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';

interface EditorCheckboxProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
  cancel?: ((...args: unknown[]) => unknown) | null;
}

export default function EditorCheckbox(_props: EditorCheckboxProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, row: null, value: null, commit: null, cancel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'row', 'value', 'commit', 'cancel']);

  // Immediate-commit-on-change: read .checked the global-filter way, coerce to a
  // real boolean, and commit it directly.
  function onChange(e: any) {
    local.commit && local.commit(!!(e && e.target ? e.target.checked : false));
  }
  function onKeydown(e: any) {
    if (e && e.key === 'Escape') {
      e.preventDefault();
      local.cancel && local.cancel();
    }
  }

  return (
    <>
    <input type="checkbox" data-editing-cell="" aria-label={local.columnId} class={"rdt-cell-editor"} checked={!!local.value} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-3d792482="" />
    </>
  );
}
