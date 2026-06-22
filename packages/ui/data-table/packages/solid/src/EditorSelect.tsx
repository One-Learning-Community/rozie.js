import type { JSX } from 'solid-js';
import { For, mergeProps, splitProps } from 'solid-js';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-solid';

interface EditorSelectProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
  cancel?: ((...args: unknown[]) => unknown) | null;
  options?: any[];
}

export default function EditorSelect(_props: EditorSelectProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, row: null, value: null, commit: null, cancel: null, options: (() => [])() }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'row', 'value', 'commit', 'cancel', 'options']);

  // Immediate-commit-on-change: read the selected value the global-filter way and
  // commit it directly (no draft needed for a single-gesture select).
  function onChange(e: any) {
    local.commit && local.commit(e && e.target ? e.target.value : '');
  }
  function onKeydown(e: any) {
    if (e && e.key === 'Escape') {
      e.preventDefault();
      local.cancel && local.cancel();
    }
  }

  return (
    <>
    <select data-editing-cell="" aria-label={local.columnId} class={"rdt-cell-editor"} value={local.value} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-117f1a16="">
      <For each={local.options}>{(opt) => <option value={rozieAttr(opt.value)} data-rozie-s-117f1a16="">{rozieDisplay(opt.label)}</option>}</For>
    </select>
    </>
  );
}
