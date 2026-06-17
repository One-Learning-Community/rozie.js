import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack, useContext } from 'solid-js';
import { render } from 'solid-js/web';
import { rozieContext } from '@rozie/runtime-solid';

interface CellSlotCtx { row: any; value: any; column: any; }

interface HeaderTemplateSlotCtx { column: any; }

interface ColumnProps {
  id?: string;
  field?: string;
  header?: string;
  sortable?: boolean;
  filterable?: boolean;
  pinned?: string;
  width?: string | number;
  cellSlot?: (ctx: () => CellSlotCtx) => JSX.Element;
  headerTemplateSlot?: (ctx: () => HeaderTemplateSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function Column(_props: ColumnProps): JSX.Element {
  const _merged = mergeProps({ id: '', field: '', header: '', sortable: false, filterable: false, pinned: '', width: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['id', 'field', 'header', 'sortable', 'filterable', 'pinned', 'width']);

  const registry = useContext(rozieContext("data-table:columns"));
  interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portalDisposers = new Set<() => void>();
  const portals = {
    cell: (container: HTMLElement, scope: { row: unknown; value: unknown; column: unknown }): ReactivePortalHandle => {
      const slot = _props.cellSlot ?? _props.slots?.['cell'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-cell', '289f2d72');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { row: unknown; value: unknown; column: unknown })), container);
      portalDisposers.add(dispose);
      return {
        update: (s: unknown): void => {
          setScopeSig(s);
        },
        dispose: (): void => {
          dispose();
          portalDisposers.delete(dispose);
        },
      };
    },
    headerTemplate: (container: HTMLElement, scope: { column: unknown }): ReactivePortalHandle => {
      const slot = _props.headerTemplateSlot ?? _props.slots?.['headerTemplate'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-headerTemplate', '289f2d72');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { column: unknown })), container);
      portalDisposers.add(dispose);
      return {
        update: (s: unknown): void => {
          setScopeSig(s);
        },
        dispose: (): void => {
          dispose();
          portalDisposers.delete(dispose);
        },
      };
    },
  };
  onCleanup(() => {
    for (const dispose of portalDisposers) dispose();
    portalDisposers.clear();
  });
  onMount(() => {
    const _cleanup = (() => {
    // The per-cell mount closure — captures the mount-scoped `portals` local. Mounts an
    // INDEPENDENT cell root PER rendered cell (the parent calls this once per visible
    // cell of the column), so every cell keeps its OWN #cell render — it must NOT
    // dispose any sibling's handle. The returned { dispose } deregisters ITSELF from the
    // live set; a leftover handle is swept by the component teardown below.
    mountCell = (host: any, scope: any) => {
      if (!host) return null;
      const s = scope || {};
      const h = portals.cell(host, {
        row: s.row,
        value: s.value,
        column: s.column
      });
      if (!h) return null;
      cellHandles.add(h);
      return {
        update: (next: any) => {
          if (h && h.update) {
            try {
              return h.update(next);
            } catch (e: any) {}
          }
        },
        dispose: () => {
          cellHandles.delete(h);
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
      };
    };
    mountHeader = (host: any, scope: any) => {
      if (!host) return null;
      const s = scope || {};
      const h = $portals.header(host, {
        column: s.column
      });
      if (!h) return null;
      headerHandles.add(h);
      return {
        update: (next: any) => {
          if (h && h.update) {
            try {
              return h.update(next);
            } catch (e: any) {}
          }
        },
        dispose: () => {
          headerHandles.delete(h);
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
    if (reg && !registered) {
      registered = true;
      reg.registerColumn(colId(), buildSpec());
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    // sweep any cell/header projections still live at teardown (the parent normally
    // disposes each per cell unmount, but a component-level unmount must clean any
    // stragglers).
    if (cellHandles) {
      for (const h of cellHandles as any) {
        if (h && h.dispose) {
          try {
            h.dispose();
          } catch (e: any) {}
        }
      }
      cellHandles.clear();
    }
    if (headerHandles) {
      for (const h of headerHandles as any) {
        if (h && h.dispose) {
          try {
            h.dispose();
          } catch (e: any) {}
        }
      }
      headerHandles.clear();
    }
    if (reg) reg.unregisterColumn(colId());
  });
  });
  createEffect(() => {
    if (registered) return;
    const live = registry;
    if (live == null) return;
    reg = live;
    registered = true;
    reg.registerColumn(colId(), buildSpec());
  });
  createEffect(on(() => (() => [local.id, local.field, local.header, local.sortable, local.filterable, local.pinned, local.width])(), (v) => untrack(() => (() => {
    if (reg) reg.registerColumn(colId(), buildSpec());
  })()), { defer: true }));

  // $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
  // STRICT BUNDLED-LEAF tsc rejects on `.registerColumn(...)` (TS2339). The .rozie-native
  // fix is the null-let → `any` typeNeutralize idiom: alias the injected API through a
  // MODULE-SCOPE `let reg = null` (typeNeutralize types it `any`). Module-scope (not
  // hook-local) so the alias is in scope from the Solid teardown — which the Solid
  // emitter hoists into a sibling onCleanup() OUTSIDE the mount closure. ZERO emitter
  // change.
  let reg: any = null;
  reg = registry;

  // idempotency flag so a reactive late-context registration (Lit async first paint,
  // REQ-30) and the $onMount registration never double-register the column.
  let registered = false;

  // PER-CELL FIX: a Set of INDEPENDENT cell/header handles — ONE PER rendered cell /
  // header. The parent's keyed r-for calls cellRenderer once per visible cell of this
  // column; a single shared handle torn down on each call would leave only the LAST
  // cell rendered (3 cells, 1 body — the count-only-VR-masking bug, rete 41-05). Each
  // call mounts an INDEPENDENT handle and disposes NONE of its siblings; the parent
  // owns per-cell disposal (it tears each handle down on row unmount / re-render).
  // Module-scope `any` so the Solid-hoisted teardown can sweep any leftovers.
  let cellHandles: any = null;
  cellHandles = new Set();
  let headerHandles: any = null;
  headerHandles = new Set();

  // The per-cell / per-header mount closures, DEFINED INSIDE $onMount (below) so they
  // capture the emitter-synthesized `portals` local — which on React/Angular/Lit is
  // scoped to the mount effect body, NOT visible from a spec callback the parent
  // invokes later (that escaped scope is exactly why a bare `$portals.cell(...)` in the
  // spec callback threw "portals is not defined" on those 3 targets, the NodeType
  // lesson). Stored in module-scope `any` so the spec callbacks — invoked by the
  // parent's keyed r-for from its own render scope — can delegate to them.
  let mountCell: any = null;
  let mountHeader: any = null;

  // the column SPEC builder — shared by the $onMount register and the late-context
  // $onUpdate below. Carries the column metadata PLUS the cellRenderer / headerRenderer
  // callbacks (only present when the consumer supplied a #cell / #header template; a
  // template-less column registers null renderers → the parent renders the plain value).
  function colId() {
    return local.id !== '' ? local.id : local.field;
  }
  function buildSpec() {
    return {
      id: colId(),
      field: local.field !== '' ? local.field : colId(),
      header: local.header,
      sortable: local.sortable,
      filterable: local.filterable,
      pinned: local.pinned,
      width: local.width,
      // present only when the consumer declared a #cell template (else the parent renders
      // the plain accessor value — the template-less fast path). Delegates to the
      // mount-scoped closure; try/catch so a per-target portal hiccup can NEVER abort the
      // parent's keyed-r-for render loop (a thrown renderer would stop the whole body).
      hasCell: !!(_props.cellSlot ?? _props.slots?.["cell"]),
      cellRenderer: (host: any, scope: any) => {
        if (host && mountCell) {
          try {
            return mountCell(host, scope);
          } catch (e: any) {}
        }
        return null;
      },
      hasHeader: !!(_props.headerTemplateSlot ?? _props.slots?.["headerTemplate"]),
      headerRenderer: (host: any, scope: any) => {
        if (host && mountHeader) {
          try {
            return mountHeader(host, scope);
          } catch (e: any) {}
        }
        return null;
      }
    };
  }

  return (
    <>





    <div class={"rozie-data-table-column"} style={{ display: "none" }} data-rozie-s-289f2d72="" />
    </>
  );
}
