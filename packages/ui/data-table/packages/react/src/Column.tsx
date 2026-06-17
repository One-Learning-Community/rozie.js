import { useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { rozieContext } from '@rozie/runtime-react';

interface CellCtx { row: any; value: any; column: any; }

interface HeaderTemplateCtx { column: any; }

interface ColumnProps {
  id?: string;
  field?: string;
  header?: string;
  sortable?: boolean;
  filterable?: boolean;
  pinned?: string;
  width?: string | number;
  renderCell?: (ctx: CellCtx) => ReactNode;
  renderHeaderTemplate?: (ctx: HeaderTemplateCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function Column(_props: ColumnProps): JSX.Element {
  const registry = useContext(rozieContext("data-table:columns"));
  const portalRoots = useRef<Set<Root>>(new Set());
  const props: Omit<ColumnProps, 'id' | 'field' | 'header' | 'sortable' | 'filterable' | 'pinned' | 'width'> & { id: string; field: string; header: string; sortable: boolean; filterable: boolean; pinned: string; width: string | number } = {
    ..._props,
    id: _props.id ?? '',
    field: _props.field ?? '',
    header: _props.header ?? '',
    sortable: _props.sortable ?? false,
    filterable: _props.filterable ?? false,
    pinned: _props.pinned ?? '',
    width: _props.width ?? '',
  };
  const _renderCellRef = useRef(props.renderCell);
  _renderCellRef.current = props.renderCell;
  const _renderHeaderTemplateRef = useRef(props.renderHeaderTemplate);
  _renderHeaderTemplateRef.current = props.renderHeaderTemplate;
  const mountCell = useRef<any>(null);
  const cellHandles = useRef<any>(null);
  const mountHeader = useRef<any>(null);
  const headerHandles = useRef<any>(null);
  const reg = useRef<any>(null);
  const registered = useRef(false);
  const _watch0First = useRef(true);

  reg.current = registry;

  // idempotency flag so a reactive late-context registration (Lit async first paint,
  // REQ-30) and the $onMount registration never double-register the column.
  cellHandles.current = new Set();
  headerHandles.current = new Set();

  // The per-cell / per-header mount closures, DEFINED INSIDE $onMount (below) so they
  // capture the emitter-synthesized `portals` local — which on React/Angular/Lit is
  // scoped to the mount effect body, NOT visible from a spec callback the parent
  // invokes later (that escaped scope is exactly why a bare `$portals.cell(...)` in the
  // spec callback threw "portals is not defined" on those 3 targets, the NodeType
  // lesson). Stored in module-scope `any` so the spec callbacks — invoked by the
  // parent's keyed r-for from its own render scope — can delegate to them.
  const colId = useCallback(() => props.id !== '' ? props.id : props.field, [props.field, props.id]);
  const buildSpec = useCallback(() => ({
    id: colId(),
    field: props.field !== '' ? props.field : colId(),
    header: props.header,
    sortable: props.sortable,
    filterable: props.filterable,
    pinned: props.pinned,
    width: props.width,
    // present only when the consumer declared a #cell template (else the parent renders
    // the plain accessor value — the template-less fast path). Delegates to the
    // mount-scoped closure; try/catch so a per-target portal hiccup can NEVER abort the
    // parent's keyed-r-for render loop (a thrown renderer would stop the whole body).
    hasCell: !!(props.renderCell ?? props.slots?.["cell"]),
    cellRenderer: (host: any, scope: any) => {
      if (host && mountCell.current) {
        try {
          return mountCell.current(host, scope);
        } catch (e: any) {}
      }
      return null;
    },
    hasHeader: !!(props.renderHeaderTemplate ?? props.slots?.["headerTemplate"]),
    headerRenderer: (host: any, scope: any) => {
      if (host && mountHeader.current) {
        try {
          return mountHeader.current(host, scope);
        } catch (e: any) {}
      }
      return null;
    }
  }), [colId, props.field, props.filterable, props.header, props.pinned, props.renderCell, props.renderHeaderTemplate, props.sortable, props.width]);

  useEffect(() => {
    interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portals = {
    cell: (container: HTMLElement, scope: { row: unknown; value: unknown; column: unknown }): ReactivePortalHandle => {
      const slot = _renderCellRef.current ?? props.slots?.['cell'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal cell { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-cell', '289f2d72');
      const root = createRoot(container);
      const renderScope = (s: { row: unknown; value: unknown; column: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { row: unknown; value: unknown; column: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
    headerTemplate: (container: HTMLElement, scope: { column: unknown }): ReactivePortalHandle => {
      const slot = _renderHeaderTemplateRef.current ?? props.slots?.['headerTemplate'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal headerTemplate { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-headerTemplate', '289f2d72');
      const root = createRoot(container);
      const renderScope = (s: { column: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { column: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
  };
    // The per-cell mount closure — captures the mount-scoped `portals` local. Mounts an
    // INDEPENDENT cell root PER rendered cell (the parent calls this once per visible
    // cell of the column), so every cell keeps its OWN #cell render — it must NOT
    // dispose any sibling's handle. The returned { dispose } deregisters ITSELF from the
    // live set; a leftover handle is swept by the component teardown below.
    mountCell.current = (host: any, scope: any) => {
      if (!host) return null;
      const s = scope || {};
      const h = portals.cell(host, {
        row: s.row,
        value: s.value,
        column: s.column
      });
      if (!h) return null;
      cellHandles.current.add(h);
      return {
        update: (next: any) => {
          if (h && h.update) {
            try {
              return h.update(next);
            } catch (e: any) {}
          }
        },
        dispose: () => {
          cellHandles.current.delete(h);
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
      };
    };
    mountHeader.current = (host: any, scope: any) => {
      if (!host) return null;
      const s = scope || {};
      const h = $portals.header(host, {
        column: s.column
      });
      if (!h) return null;
      headerHandles.current.add(h);
      return {
        update: (next: any) => {
          if (h && h.update) {
            try {
              return h.update(next);
            } catch (e: any) {}
          }
        },
        dispose: () => {
          headerHandles.current.delete(h);
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
      };
    };
    // register this column's spec INCLUDING the render callbacks. On Lit the injected
    // registry may still be undefined here (REQ-30 async context); the $onUpdate below
    // performs the registration once the value arrives.
    if (reg.current && !registered.current) {
      registered.current = true;
      reg.current.registerColumn(colId(), buildSpec());
    }
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      // sweep any cell/header projections still live at teardown (the parent normally
      // disposes each per cell unmount, but a component-level unmount must clean any
      // stragglers).
      if (cellHandles.current) {
        for (const h of cellHandles.current as any) {
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
        cellHandles.current.clear();
      }
      if (headerHandles.current) {
        for (const h of headerHandles.current as any) {
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
        headerHandles.current.clear();
      }
      if (reg.current) reg.current.unregisterColumn(colId());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (registered.current) return;
    const live = registry;
    if (live == null) return;
    reg.current = live;
    registered.current = true;
    reg.current.registerColumn(colId(), buildSpec());
  }, [buildSpec, colId, reg, registered, registry]);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    if (reg.current) reg.current.registerColumn(colId(), buildSpec());
  }, [props.field, props.filterable, props.header, props.id, props.pinned, props.sortable, props.width]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>





    <div className={"rozie-data-table-column"} style={{ display: "none" }} data-rozie-s-289f2d72="" />
    </>
  );
}
