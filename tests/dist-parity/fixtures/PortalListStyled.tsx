import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { clsx } from '@rozie/runtime-react';
import styles from './PortalListStyled.module.css';

interface ItemCtx { item: any; }

interface PortalListStyledProps {
  items?: any[];
  renderItem?: (ctx: ItemCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function PortalListStyled(_props: PortalListStyledProps): JSX.Element {
  const portalRoots = useRef<Set<Root>>(new Set());
  const props: PortalListStyledProps & { items: any[] } = {
    ..._props,
    items: _props.items ?? (() => [])(),
  };
  const attrs: Record<string, unknown> = (() => {
    const { items, ...rest } = _props as PortalListStyledProps & Record<string, unknown>;
    void items;
    return rest;
  })();
  const _renderItemRef = useRef(props.renderItem);
  _renderItemRef.current = props.renderItem;
  const instance = useRef<any>(null);
  const __rozieRoot = useRef<HTMLDivElement | null>(null);

  // Tiny inline "engine" — same shape as examples/PortalList.rozie but
  // with the inline-style ceremony removed. The engine now just creates
  // structural DOM; cosmetic styling is the wrapper's <style> block's job.
  //
  // Destruction order still matters: dispose all cells BEFORE removing
  // the structural container (same constraint as FullCalendar / AG-Grid).
  class MiniListEngine {
    constructor(rootEl: any, opts: any) {
      this.rootEl = rootEl;
      this.items = opts.items;
      this.cellRenderer = opts.cellRenderer;
      this.disposers = [];
      this._mount();
    }
    _mount() {
      const ul = document.createElement('ul');
      for (const item of this.items as any) {
        const li = document.createElement('li');
        const cell = this.cellRenderer(item);
        li.appendChild(cell.node);
        this.disposers.push(cell.dispose);
        ul.appendChild(li);
      }
      this.rootEl.appendChild(ul);
    }
    destroy() {
      for (const dispose of this.disposers as any) dispose();
      this.disposers = [];
      while (this.rootEl.firstChild) this.rootEl.removeChild(this.rootEl.firstChild);
    }
  }

  useEffect(() => {
    const portals = {
    item: (container: HTMLElement, scope: { item: unknown }): (() => void) => {
      const slot = _renderItemRef.current ?? props.slots?.['item'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal item { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-item', '18e5aac6');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
  };
    instance.current = new MiniListEngine(__rozieRoot.current!, {
      items: props.items,
      cellRenderer: (item: any) => {
        const node = document.createElement('div');
        const dispose = portals.item(node, {
          item
        });
        return {
          node,
          dispose
        };
      }
    });
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      instance.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div ref={__rozieRoot} {...attrs} className={clsx(styles["rozie-portal-list"], (attrs.className as string | undefined))} {...attrs} data-rozie-s-18e5aac6="">
      
    </div>
    </>
  );
}
