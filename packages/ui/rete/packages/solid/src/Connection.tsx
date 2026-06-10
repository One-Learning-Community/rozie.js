import type { JSX } from 'solid-js';
import { mergeProps, onCleanup, onMount, splitProps, useContext } from 'solid-js';
import { rozieContext } from '@rozie/runtime-solid';

interface ConnectionProps {
  id?: string;
  source: string;
  sourceOutput?: string;
  target: string;
  targetInput?: string;
}

export default function Connection(_props: ConnectionProps): JSX.Element {
  const _merged = mergeProps({ id: undefined, sourceOutput: undefined, targetInput: undefined }, _props);
  const [local, attrs] = splitProps(_merged, ['id', 'source', 'sourceOutput', 'target', 'targetInput']);

  const canvas = useContext(rozieContext("rete:canvas"));
  onMount(() => {
    const _cleanup = (() => {
    connId = edgeId();
    if (cv) {
      cv.registerConnection(connId, {
        id: connId,
        source: local.source,
        sourceOutput: local.sourceOutput,
        target: local.target,
        targetInput: local.targetInput
      });
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (cv) cv.unregisterConnection(connId);
  });
  });

  // $inject is typed `unknown` (Phase 36 D-4); alias through a MODULE-SCOPE null-let
  // → `any` (typeNeutralize) so .registerConnection(...) type-checks on the strict
  // bundled leaves AND the alias is in scope from the Solid hoisted teardown (the
  // MapLibre Source/Layer lesson). ZERO emitter change.
  let cv: any = null;
  cv = canvas;

  // Effective edge id: explicit prop wins, else the source:out->target:in default
  // (mirrors reconcileConnections so collision dedup is consistent).
  function edgeId() {
    if (local.id != null) return local.id;
    const srcOut = local.sourceOutput != null ? local.sourceOutput : 'out';
    const tgtIn = local.targetInput != null ? local.targetInput : 'in';
    return `${local.source}:${srcOut}->${local.target}:${tgtIn}`;
  }

  // The resolved edge id, captured at mount. MODULE-SCOPE (not $onMount-local) so the
  // teardown — which the Solid emitter hoists into a sibling onCleanup() OUTSIDE the
  // mount closure — can still reach it to unregisterConnection (the MapLibre Source/
  // Layer teardown-hoist lesson). null until mount.
  let connId: any = null;

  return (
    null
  );
}
