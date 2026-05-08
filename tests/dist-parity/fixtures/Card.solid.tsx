import type { JSX } from 'solid-js';
import { children, splitProps } from 'solid-js';
import CardHeader from './CardHeader';

interface CardProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
}

export default function Card(_props: CardProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['title', 'onClose', 'children']);
  const resolved = children(() => local.children);

  return (
    <>
    <style>{`.card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
    .card__body { padding: 1rem; }`}</style>
    <>
    <article class={"card"}>
      <CardHeader title={local.title} onClose={local.onClose} />
      <div class={"card__body"}>
        {resolved()}
      </div>
    </article>
    </>
    </>
  );
}
