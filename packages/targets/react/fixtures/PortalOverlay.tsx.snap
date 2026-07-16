import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './PortalOverlay.css';
import './PortalOverlay.global.css';

interface PortalOverlayProps {
  open?: boolean;
  to?: boolean | string;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function PortalOverlay(_props: PortalOverlayProps): JSX.Element {
  const props: Omit<PortalOverlayProps, 'open' | 'to'> & { open: boolean; to: boolean | string } = {
    ..._props,
    open: _props.open ?? false,
    to: _props.to ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { open, to, ...rest } = _props as PortalOverlayProps & Record<string, unknown>;
    void open; void to;
    return rest;
  })();

  function resolveTo(to: any) {
    if (!to) return null;
    if (typeof document === 'undefined') return null;
    if (to === true || to === 'body') return document.body;
    return document.querySelector(to);
  }

  return (
    <>
    {!!(props.open) && ((() => { const __rozieContainer = typeof document === 'undefined' ? null : (resolveTo(props.to)); return __rozieContainer ? createPortal(<div className={"rozie-portal-overlay-backdrop"} data-rozie-s-56b9c1c8="">
      <div className={"rozie-portal-overlay-box"} data-rozie-s-56b9c1c8="">
        {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.[''])) ?? "Portalled content"}
      </div>
    </div>, __rozieContainer) : (<div className={"rozie-portal-overlay-backdrop"} data-rozie-s-56b9c1c8="">
      <div className={"rozie-portal-overlay-box"} data-rozie-s-56b9c1c8="">
        {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.[''])) ?? "Portalled content"}
      </div>
    </div>); })())}</>
  );
}
