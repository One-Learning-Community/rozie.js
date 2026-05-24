import type { JSX } from 'solid-js';
import { mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('PortalListStyled-18e5aac6', `.rozie-portal-list[data-rozie-s-18e5aac6] {
  display: block;
  font-family: system-ui, -apple-system, sans-serif;
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] ul {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  overflow: hidden;
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] li {
  padding: 0.5rem 0.75rem;
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] li + li {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}`);

interface ItemSlotCtx { item: any; }

interface PortalListStyledProps {
  items?: any[];
  itemSlot?: (ctx: ItemSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function PortalListStyled(_props: PortalListStyledProps): JSX.Element {
  const _merged = mergeProps({ items: (() => [])() }, _props);
  const [local, attrs] = splitProps(_merged, ['items']);

  const portalDisposers = new Set<() => void>();
  const portals = {
    item: (container: HTMLElement, scope: { item: unknown }): (() => void) => {
      const slot = _props.itemSlot ?? _props.slots?.['item'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-item', '18e5aac6');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
  };
  onCleanup(() => {
    for (const dispose of portalDisposers) dispose();
    portalDisposers.clear();
  });
  onMount(() => {
    const _cleanup = (() => {
    instance = new MiniListEngine(__rozieRootRef!, {
      items: local.items,
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
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => instance?.destroy());
  });
  let __rozieRootRef: HTMLElement | null = null;

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
  let instance: any = null;

  return (
    <>
    <div ref={(el) => { __rozieRootRef = el as HTMLElement; }} {...attrs} class={"rozie-portal-list" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-18e5aac6="">
      
    </div>
    </>
  );
}
