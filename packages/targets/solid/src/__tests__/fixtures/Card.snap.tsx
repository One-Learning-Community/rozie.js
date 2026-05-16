import type { JSX } from 'solid-js';
import { children, mergeProps, splitProps } from 'solid-js';
import CardHeader from './CardHeader';

interface CardProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
}

export default function Card(_props: CardProps): JSX.Element {
  const _merged = mergeProps({ title: '' }, _props);
  const [local, rest] = splitProps(_merged, ['title', 'onClose', 'children']);
  const resolved = children(() => local.children);

  return (
    <>
    <style>{`.card[data-rozie-s-a88c221e] { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
    .card__body[data-rozie-s-a88c221e] { padding: 1rem; }`}</style>
    <>
    <article class={"card"} data-rozie-s-a88c221e="">
      <CardHeader title={local.title} onClose={local.onClose} />
      <div class={"card__body"} data-rozie-s-a88c221e="">
        {resolved()}
      </div>
    </article>
    </>
    </>
  );
}
