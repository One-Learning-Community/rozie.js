import { clsx } from '@rozie/runtime-react';
import './CardHeader.css';

interface CardHeaderProps {
  title?: string;
  onClose?: ((...args: any[]) => any) | null;
}

export default function CardHeader(_props: CardHeaderProps): JSX.Element {
  const props: Omit<CardHeaderProps, 'title' | 'onClose'> & { title: string; onClose: ((...args: any[]) => any) | null } = {
    ..._props,
    title: _props.title ?? '',
    onClose: _props.onClose ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { title, onClose, ...rest } = _props as CardHeaderProps & Record<string, unknown>;
    void title; void onClose;
    return rest;
  })();

  return (
    <>
    <header {...attrs} className={clsx("card-header", (attrs.className as string | undefined))} data-rozie-s-f3e60f5a="">
      <h3 className={"card-header__title"} data-rozie-s-f3e60f5a="">{props.title}</h3>
      {(props.onClose) && <button className={"card-header__close"} onClick={($event) => { ((props.onClose) as ((...args: any[]) => any) | undefined)?.($event); }} data-rozie-s-f3e60f5a="">×</button>}</header>
    </>
  );
}
