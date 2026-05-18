/**
 * Portal-slot primitive (Spike 003) — React-target scaffolding.
 *
 * Synthesizes the per-target portal-mount machinery for a Rozie wrapper that
 * uses `<slot name="X" portal />`. Three artefacts:
 *
 *   1. `portalsRefDecl`     — useRef<Set<Root>> hoisted into the hookSection
 *   2. `portalsClosureLines` — `const portals = { X: (...) => {...} };` —
 *                              prepended to the FIRST mount-phase useEffect body
 *   3. `portalsBulkDispose`  — `for (const root of portalRoots.current) root.unmount();`
 *                              prepended to the same useEffect's cleanup
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

/** Build the per-slot method body for the portals closure. */
function buildSlotMethod(slot: SlotDecl): string {
  const slotName = slot.name;
  const pascal = pascalCase(slotName);
  const renderProp = 'render' + pascal;
  const paramNames = slot.portalParamNames ?? [];
  // Scope type: `{ arg: unknown; ... }` from portalParamNames, or `unknown`
  // when no names declared.
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    const slot = props.${renderProp} ?? props.slots?.['${slotName}'];\n` +
    `    if (typeof slot !== 'function') return () => {};\n` +
    `    const root = createRoot(container);\n` +
    `    root.render(slot(scope));\n` +
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
  /** Mount-phase useEffect prepend: `const portals = { … };` */
  closureBlock: string;
  /** Cleanup prepend: bulk-dispose loop. */
  bulkDisposeBlock: string;
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
      closureBlock: '',
      bulkDisposeBlock: '',
    };
  }

  collectors.react.add('useRef');
  // `createRoot, type Root` from 'react-dom/client' — distinct from the
  // 'react' import target. Collected manually below in buildShell.
  void collectors.runtime;

  const refDeclLine =
    'const portalRoots = useRef<Set<Root>>(new Set());';

  const methodLines = portals.map(buildSlotMethod).join('\n');
  const closureBlock = `const portals = {\n${methodLines}\n};`;

  const bulkDisposeBlock =
    'for (const root of portalRoots.current) root.unmount();\n' +
    'portalRoots.current.clear();';

  return {
    hasPortals: true,
    refDeclLine,
    closureBlock,
    bulkDisposeBlock,
  };
}
