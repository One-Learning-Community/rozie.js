import type { JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';

interface CardHeaderProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
}

export default function CardHeader(_props: CardHeaderProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['title', 'onClose']);

  return (
    <>
    <style>{`.card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
    .card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
    .card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }`}</style>
    <>
    <header class={"card-header"}>
      <h3 class={"card-header__title"}>{local.title}</h3>
      {<Show when={local.onClose}><button class={"card-header__close"} onClick={(e) => { local.onClose; }}>×</button></Show>}</header>
    </>
    </>
  );
}
