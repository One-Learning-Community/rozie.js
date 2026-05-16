import type { JSX } from 'solid-js';
import { Show, mergeProps, splitProps } from 'solid-js';

interface CardHeaderProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
}

export default function CardHeader(_props: CardHeaderProps): JSX.Element {
  const _merged = mergeProps({ title: '' }, _props);
  const [local, rest] = splitProps(_merged, ['title', 'onClose']);

  return (
    <>
    <style>{`.card-header[data-rozie-s-f3e60f5a] { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
    .card-header__title[data-rozie-s-f3e60f5a] { margin: 0; font-size: 1rem; font-weight: 600; }
    .card-header__close[data-rozie-s-f3e60f5a] { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }`}</style>
    <>
    <header class={"card-header"} data-rozie-s-f3e60f5a="">
      <h3 class={"card-header__title"} data-rozie-s-f3e60f5a="">{local.title}</h3>
      {<Show when={local.onClose}><button class={"card-header__close"} onClick={(e) => { (local.onClose)(e); }} data-rozie-s-f3e60f5a="">×</button></Show>}</header>
    </>
    </>
  );
}
