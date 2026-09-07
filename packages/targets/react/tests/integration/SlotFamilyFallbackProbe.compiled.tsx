// Phase 88 Plan 01 Task 1 — this file is EMITTER OUTPUT, not hand-authored.
//
// Compiled with `emitReact` (parse + lowerToIR + emitReact from `@rozie/core`)
// from the source below, using the FIXED emitter (post-D-06 paren in
// `renderInvocationFallback`) — regenerated at Task 1 Step E. Never
// hand-edit this file. If it drifts from what the emitter now produces,
// recompile and replace it wholesale.
//
// Source compiled:
//
//   <rozie name="SlotFamilyFallbackProbe">
//   <props>
//   {
//     columns: { type: Array, default: () => [] },
//   }
//   </props>
//   <template>
//   <div>
//     <div r-for="col in $props.columns" :key="col.key" data-testid="row" :data-col-key="col.key">
//       <slot :name="`cell-${col.key}`" :value="col.value">
//         <slot name="cell" :value="col.value">{{ col.value }}</slot>
//       </slot>
//     </div>
//   </div>
//   </template>
//   </rozie>
//
// This is the three-tier shape all 12 `@rozie-ui/data-table` slot-family
// sites (Phase 88) will adopt: a params-bearing dynamic-name (family) slot
// (`cell-<columnId>`) whose inline fallback is a nested STATIC named slot
// (`#cell`), whose own inline fallback is a bare `{{ }}` interpolation.
//
// See `../slot-family-fallback-precedence.test.tsx` for the mounted
// behavioral proof: pre-fix (D-06), passing a NON-FUNCTION `slots` record
// entry for one column with NO generic `#cell` fill throws a TypeError at
// render time (`(undefined as Function)(...)` — the merged `??` chain
// mis-parses as `(A ?? cond) ? x : y`, so the falsy branch of the
// mis-parsed ternary is taken even though `A` was truthy). Post-fix, the
// parenthesized `A ?? (cond ? x : y)` short-circuits correctly and renders
// the passed node.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-react';

interface CellCtx { value: any; }

interface SlotFamilyFallbackProbeProps {
  columns?: any[];
  renderCell?: (ctx: CellCtx) => ReactNode;
  slots?: { [key: `cell-${string}`]: ((params: { value: any }) => import('react').ReactNode) | undefined; [key: string]: ((...args: any[]) => import('react').ReactNode) | undefined; };
}

export default function SlotFamilyFallbackProbe(_props: SlotFamilyFallbackProbeProps): JSX.Element {
  const __defaultColumns = useState(() => (() => [])())[0];
  const props: Omit<SlotFamilyFallbackProbeProps, 'columns'> & { columns: any[] } = {
    ..._props,
    columns: _props.columns ?? __defaultColumns,
  };
  const attrs: Record<string, unknown> = (() => {
    const { columns, ...rest } = _props as SlotFamilyFallbackProbeProps & Record<string, unknown>;
    void columns;
    return rest;
  })();

  return (
    <>
    <div {...attrs} data-rozie-s-af468a87="">
      {props.columns.map((col) => <div key={col.key} data-testid="row" data-col-key={rozieAttr(col.key)} data-rozie-s-af468a87="">
        {typeof props.slots?.[`cell-${col.key}`] === 'function' ? (props.slots?.[`cell-${col.key}`] as Function)({ value: col.value }) : (props.slots?.[`cell-${col.key}`] ?? ((props.renderCell ?? props.slots?.['cell']) ? ((props.renderCell ?? props.slots?.['cell']) as Function)({ value: col.value }) : (rozieDisplay(col.value))))}
      </div>)}
    </div>
    </>
  );
}
