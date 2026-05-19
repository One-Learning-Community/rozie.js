/**
 * Portal-slot primitive (Spike 003) — React-target scaffolding.
 *
 * Synthesizes the per-target portal-mount machinery for a Rozie wrapper that
 * uses `<slot name="X" portal />`. Four artefacts:
 *
 *   1. `refDeclLine`           — useRef<Set<Root>> hoisted into the hookSection
 *   2. `rendererRefLines`      — `const _renderXRef = useRef(props.renderX);` plus
 *                                a re-bind line `_renderXRef.current = props.renderX;`
 *                                per portal-slot, hoisted into the hookSection. These
 *                                lines exist so the mount-phase useEffect can read
 *                                the latest consumer-supplied renderer via
 *                                `_renderXRef.current` without keeping the renderer
 *                                prop in its dep array (closes the FullCalendar
 *                                React VR gap — fresh-arrow consumer renderers
 *                                were triggering useEffect cleanup → setup every
 *                                consumer render, unmounting just-scheduled-but-
 *                                not-yet-committed portal `createRoot()` calls).
 *   3. `closureBlock`          — `const portals = { X: (...) => {...} };` —
 *                                prepended to the FIRST mount-phase useEffect body
 *   4. `bulkDisposeBlock`      — `for (const root of portalRoots.current) root.unmount();`
 *                                prepended to the same useEffect's cleanup
 *
 * The portal closure wraps React 18's imperative createRoot/render/unmount
 * mount-API in the `$portals.NAME(container, scope) => disposeFn` contract.
 * Per Spike 002 Demo.react.tsx ground truth: dispose is per-cell AND bulk —
 * the engine destroy() in user cleanup must run AFTER portal roots are
 * unmounted, otherwise React unmounts trees from already-detached containers.
 *
 * V1 reactivity constraint (REQ-5): portal slots are NOT reactive after mount.
 * They re-render only when the wrapper's script re-invokes them via the
 * cellRenderer callback (FullCalendar's render-flow already does this).
 */
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import type {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function pascalCase(name: string): string {
  const parts = name.split(/[-_]/).filter(Boolean);
  return parts.map((p) => capitalize(p)).join('');
}

/** Per-slot identifier triple — derived once and reused across emit helpers. */
interface SlotIds {
  /** Original slot name as authored in `<slot name="X" portal />`. */
  slotName: string;
  /** React-side render-prop name: `render<Pascal>`. */
  renderProp: string;
  /** Internal stable ref identifier: `_render<Pascal>Ref`. */
  refIdent: string;
}

function slotIdsFor(slot: SlotDecl): SlotIds {
  const pascal = pascalCase(slot.name);
  return {
    slotName: slot.name,
    renderProp: 'render' + pascal,
    refIdent: '_render' + pascal + 'Ref',
  };
}

/**
 * Build the per-slot method body for the portals closure.
 *
 * The renderer is read via `<refIdent>.current` (not `props.<renderProp>`) so
 * the closure picks up the latest consumer-supplied renderer at engine-
 * callback invocation time. Without this indirection, the closure would
 * capture the value of `props.<renderProp>` at useEffect-setup time only —
 * and emitScript drops the renderer prop from the useEffect dep array, so
 * useEffect would never re-run to refresh that captured value. The ref's
 * `.current` is mutated on every render by a sibling line in hookSection,
 * which gives the closure stale-free reads on the engine's timetable.
 *
 * `props.slots?.['<name>']` is preserved as a fallback for the
 * `<Wrapper slots={{ X: fn }} />` consumer shape used by per-target
 * conformance tests.
 */
function buildSlotMethod(slot: SlotDecl): string {
  const { slotName, refIdent } = slotIdsFor(slot);
  const paramNames = slot.portalParamNames ?? [];
  // Scope type: `{ arg: unknown; ... }` from portalParamNames, or `unknown`
  // when no names declared.
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    const slot = ${refIdent}.current ?? props.slots?.['${slotName}'];\n` +
    `    if (typeof slot !== 'function') return () => {};\n` +
    `    const root = createRoot(container);\n` +
    // flushSync forces React to commit the portal render synchronously
    // BEFORE returning to the engine. Without flushSync, React schedules
    // the render asynchronously; if the engine then immediately disposes
    // the cell (e.g., when reconciling a fresh \`events\` array) before
    // React commits, the portal tree is unmounted before it ever paints.
    // The FullCalendar VR react cell hit this: \`$watch(() => $props.events,
    // ...)\` runs \`removeAllEvents\` + \`addEvent\` per event, and the
    // dispose-then-recreate cycle outpaced React's commit scheduler.
    // flushSync turns the schedule into a synchronous flush — the portal
    // is painted before \`eventContent\` returns to FullCalendar, so the
    // engine never observes an unmounted-but-attached portal node.
    `    flushSync(() => root.render(slot(scope)));\n` +
    `    portalRoots.current.add(root);\n` +
    `    return () => {\n` +
    `      root.unmount();\n` +
    `      portalRoots.current.delete(root);\n` +
    `    };\n` +
    `  },`
  );
}

export interface PortalsEmit {
  /** Empty when no portal slots — caller skips all portal injection. */
  hasPortals: boolean;
  /** Hook-section line: `const portalRoots = useRef<Set<Root>>(new Set());` */
  refDeclLine: string;
  /**
   * Per-portal-slot stable-renderer ref declarations + mutation lines, joined
   * by '\n'. Empty when no portal slots. Hoisted into hookSection by
   * emitScript so the closure inside the mount-phase useEffect can read
   * `<ref>.current` for the latest consumer-supplied renderer.
   */
  rendererRefLines: string;
  /** Mount-phase useEffect prepend: `const portals = { … };` */
  closureBlock: string;
  /** Cleanup prepend: bulk-dispose loop. */
  bulkDisposeBlock: string;
  /**
   * Names of portal slots — emitScript filters
   * `{ scope: 'slots', path: [<name>] }` SignalRefs out of every
   * lifecycle hook's dep array so the mount-phase useEffect doesn't re-fire
   * on every consumer render when the renderer prop is a fresh arrow.
   * Per V1 portal constraint (REQ-5): portal slots are NOT reactive after
   * mount, so the dep filtering matches the documented runtime semantics.
   */
  portalSlotNames: ReadonlySet<string>;
}

export function emitPortals(
  ir: IRComponent,
  collectors: {
    react: ReactImportCollector;
    runtime: RuntimeReactImportCollector;
  },
): PortalsEmit {
  const portals = ir.slots.filter((s) => s.isPortal === true);
  if (portals.length === 0) {
    return {
      hasPortals: false,
      refDeclLine: '',
      rendererRefLines: '',
      closureBlock: '',
      bulkDisposeBlock: '',
      portalSlotNames: new Set(),
    };
  }

  collectors.react.add('useRef');
  // `createRoot, type Root` from 'react-dom/client' — distinct from the
  // 'react' import target. Collected manually below in buildShell.
  void collectors.runtime;

  const refDeclLine =
    'const portalRoots = useRef<Set<Root>>(new Set());';

  // One declaration + one mutation per portal slot:
  //   const _renderEventRef = useRef(props.renderEvent);
  //   _renderEventRef.current = props.renderEvent;
  // The mutation runs every render (React allows ref mutation outside
  // effects when the ref isn't a `useRef` value bound to a DOM node) so the
  // closure inside the mount-phase useEffect always reads the freshest
  // consumer-supplied renderer via `_renderEventRef.current`. This is the
  // canonical React workaround for "stable handler that updates value via
  // ref" — see React 18 docs on `useEvent` / referenced in
  // `useEffectEvent` RFC.
  const rendererRefLines = portals
    .map((slot) => {
      const { renderProp, refIdent } = slotIdsFor(slot);
      return (
        `const ${refIdent} = useRef(props.${renderProp});\n` +
        `${refIdent}.current = props.${renderProp};`
      );
    })
    .join('\n');

  const methodLines = portals.map(buildSlotMethod).join('\n');
  const closureBlock = `const portals = {\n${methodLines}\n};`;

  const bulkDisposeBlock =
    'for (const root of portalRoots.current) root.unmount();\n' +
    'portalRoots.current.clear();';

  const portalSlotNames = new Set(portals.map((s) => s.name));

  return {
    hasPortals: true,
    refDeclLine,
    rendererRefLines,
    closureBlock,
    bulkDisposeBlock,
    portalSlotNames,
  };
}
