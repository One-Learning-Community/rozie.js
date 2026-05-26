import type { JSX } from 'solid-js';
import { children, mergeProps, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';
import CardHeader from './CardHeader';

__rozieInjectStyle('Card-a88c221e', `.card[data-rozie-s-a88c221e] { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
.card__body[data-rozie-s-a88c221e] { padding: 1rem; }`);

interface CardProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function Card(_props: CardProps): JSX.Element {
  const _merged = mergeProps({ title: '', onClose: null }, _props);
  const [local, attrs] = splitProps(_merged, ['title', 'onClose', 'children']);
  const resolved = children(() => local.children);

  return (
    <>
    <article {...attrs} class={"card" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-a88c221e="">
      <CardHeader title={local.title} onClose={local.onClose} data-rozie-s-a88c221e="" />
      <div class={"card__body"} data-rozie-s-a88c221e="">
        {resolved()}
      </div>
    </article>
    </>
  );
}
