import { useContext, useMemo } from 'react';
import { clsx, rozieAttr, rozieContext } from '@rozie/runtime-react';
import './Tab.css';

interface TabProps {
  label?: string;
}

export default function Tab(_props: TabProps): JSX.Element {
  const tabs = useContext(rozieContext('tabs'));
  const props: Omit<TabProps, 'label'> & { label: string } = {
    ..._props,
    label: _props.label ?? '',
  };
  const attrs: Record<string, unknown> = (() => {
    const { label, ...rest } = _props as TabProps & Record<string, unknown>;
    void label;
    return rest;
  })();

  const myIndex = useMemo(() => tabs ? tabs.register() : 0, []);

  return (
    <>
    <button data-tab="" type="button" role="tab" data-active={rozieAttr(tabs && tabs.active === myIndex)} {...attrs} className={clsx(clsx("tab", { "is-active": tabs && tabs.active === myIndex }), (attrs.className as string | undefined))} onClick={($event) => { tabs && tabs.setActive(myIndex); }} data-rozie-s-18645a16="">
      {props.label}
    </button>
    </>
  );
}
