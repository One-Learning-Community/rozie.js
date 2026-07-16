import type { JSX } from 'solid-js';
import { Show, children, mergeProps, splitProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('PortalOverlay-56b9c1c8', `.rozie-portal-overlay-backdrop[data-rozie-s-56b9c1c8] {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: var(--rozie-portal-overlay-z, 3000);
}
.rozie-portal-overlay-box[data-rozie-s-56b9c1c8] {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  min-width: 16rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
:root {
  --rozie-portal-overlay-z: 3000;
}`);

interface PortalOverlayProps {
  open?: boolean;
  to?: boolean | string;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function PortalOverlay(_props: PortalOverlayProps): JSX.Element {
  const _merged = mergeProps({ open: false, to: false }, _props);
  const [local, attrs] = splitProps(_merged, ['open', 'to', 'children']);
  const resolved = children(() => local.children);

  function resolveTo(to: any) {
    if (!to) return null;
    if (typeof document === 'undefined') return null;
    if (to === true || to === 'body') return document.body;
    return document.querySelector(to);
  }

  return (
    <>
    {<Show when={local.open}><Show when={(typeof document === 'undefined' ? null : (resolveTo(local.to)))} fallback={<div class={"rozie-portal-overlay-backdrop"} data-rozie-s-56b9c1c8="">
      <div class={"rozie-portal-overlay-box"} data-rozie-s-56b9c1c8="">
        {resolved() ?? "Portalled content"}
      </div>
    </div>}><Portal mount={(typeof document === 'undefined' ? null : (resolveTo(local.to)))}><div class={"rozie-portal-overlay-backdrop"} data-rozie-s-56b9c1c8="">
      <div class={"rozie-portal-overlay-box"} data-rozie-s-56b9c1c8="">
        {resolved() ?? "Portalled content"}
      </div>
    </div></Portal></Show></Show>}</>
  );
}
