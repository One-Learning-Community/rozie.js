<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';
import { getContext, onMount, untrack } from 'svelte';

interface Props {
  id?: string;
  field?: string;
  header?: string;
  sortable?: boolean;
  filterable?: boolean;
  pinned?: string;
  width?: string | number;
  cell?: Snippet<[{ row: any; value: any; column: any }]>;
  headerTemplate?: Snippet<[{ column: any }]>;
  snippets?: Record<string, any>;
}

let {
  id = '',
  field = '',
  header = '',
  sortable = false,
  filterable = false,
  pinned = '',
  width = '',
  cell: __cellProp,
  headerTemplate: __headerTemplateProp,
  snippets
}: Props = $props();

const cell = $derived(__cellProp ?? snippets?.cell);
const headerTemplate = $derived(__headerTemplateProp ?? snippets?.headerTemplate);

const registry = getContext('data-table:columns');

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
// the column SPEC builder — shared by the $onMount register and the late-context
// $onUpdate below. Carries the column metadata PLUS the cellRenderer / headerRenderer
// callbacks (only present when the consumer supplied a #cell / #header template; a
// template-less column registers null renderers → the parent renders the plain value).
const colId = () => id !== '' ? id : field;
const buildSpec = () => ({
  id: colId(),
  field: field !== '' ? field : colId(),
  header: header,
  sortable: sortable,
  filterable: filterable,
  pinned: pinned,
  width: width,
  // present only when the consumer declared a #cell template (else the parent renders
  // the plain accessor value — the template-less fast path). Delegates to the
  // mount-scoped closure; try/catch so a per-target portal hiccup can NEVER abort the
  // parent's keyed-r-for render loop (a thrown renderer would stop the whole body).
  hasCell: !!cell,
  cellRenderer: (host: any, scope: any) => {
    if (host && mountCell) {
      try {
        return mountCell(host, scope);
      } catch (e: any) {}
    }
    return null;
  },
  hasHeader: !!headerTemplate,
  headerRenderer: (host: any, scope: any) => {
    if (host && mountHeader) {
      try {
        return mountHeader(host, scope);
      } catch (e: any) {}
    }
    return null;
  }
});

interface ReactivePortalHandle {
  update(scope: unknown): void;
  dispose(): void;
}
const portalInstances = new Set<Record<string, unknown>>();
const portals = {
  cell: (container: HTMLElement, scope: { row: unknown; value: unknown; column: unknown }): ReactivePortalHandle => {
    if (!cell) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-cell', '289f2d72');
    const inst = mount(PortalHostReactive, {
      target: container,
      props: { snippet: cell, initialScope: scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return {
      update: (s: unknown): void => {
        (inst as unknown as { update(s: unknown): void }).update(s);
      },
      dispose: (): void => {
        unmount(inst as Parameters<typeof unmount>[0]);
        portalInstances.delete(inst as Record<string, unknown>);
      },
    };
  },
  headerTemplate: (container: HTMLElement, scope: { column: unknown }): ReactivePortalHandle => {
    if (!headerTemplate) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-headerTemplate', '289f2d72');
    const inst = mount(PortalHostReactive, {
      target: container,
      props: { snippet: headerTemplate, initialScope: scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return {
      update: (s: unknown): void => {
        (inst as unknown as { update(s: unknown): void }).update(s);
      },
      dispose: (): void => {
        unmount(inst as Parameters<typeof unmount>[0]);
        portalInstances.delete(inst as Record<string, unknown>);
      },
    };
  },
};
$effect(() => () => {
  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);
  portalInstances.clear();
});

onMount(() => {
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
  return () => {
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
  };
});
$effect(() => (() => {
  if (registered) return;
  const live = registry;
  if (live == null) return;
  reg = live;
  registered = true;
  reg.registerColumn(colId(), buildSpec());
})());

let __rozieWatchInitial_0 = true;
$effect(() => { (() => [id, field, header, sortable, filterable, pinned, width])(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (reg) reg.registerColumn(colId(), buildSpec());
})(); }); });
</script>

<div class="rozie-data-table-column" style="display:none" data-rozie-s-289f2d72></div>
