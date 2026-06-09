import { useContext } from 'react';
import { clsx, rozieAttr, rozieContext } from '@rozie/runtime-react';
import './Tab.css';

interface TabProps {
  label?: string;
  index?: number;
}

export default function Tab(_props: TabProps): JSX.Element {
  const tabs = useContext(rozieContext("tabs"));
  const props: Omit<TabProps, 'label' | 'index'> & { label: string; index: number } = {
    ..._props,
    label: _props.label ?? '',
    index: _props.index ?? 0,
  };
  const attrs: Record<string, unknown> = (() => {
    const { label, index, ...rest } = _props as TabProps & Record<string, unknown>;
    void label; void index;
    return rest;
  })();

  return (
    <>
    <button data-tab="" type="button" role="tab" data-active={rozieAttr(tabs && tabs.active === props.index)} {...attrs} className={clsx(clsx("tab", { "is-active": tabs && tabs.active === props.index }), (attrs.className as string | undefined))} onClick={($event) => { tabs && tabs.setActive(props.index); }} data-rozie-s-18645a16="">
      {props.label}
    </button>
    </>
  );
}
