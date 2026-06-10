import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface ConnectionProps {
  id?: string;
  source: string;
  sourceOutput?: string;
  target: string;
  targetInput?: string;
}

export default function Connection(_props: ConnectionProps): JSX.Element {
  const canvas = useContext(rozieContext("rete:canvas"));
  const props: Omit<ConnectionProps, 'id' | 'sourceOutput' | 'targetInput'> & { id: string; sourceOutput: string; targetInput: string } = {
    ..._props,
    id: _props.id ?? undefined,
    sourceOutput: _props.sourceOutput ?? undefined,
    targetInput: _props.targetInput ?? undefined,
  };
  const attrs: Record<string, unknown> = (() => {
    const { id, source, sourceOutput, target, targetInput, ...rest } = _props as ConnectionProps & Record<string, unknown>;
    void id; void source; void sourceOutput; void target; void targetInput;
    return rest;
  })();
  const connId = useRef<any>(null);
  const cv = useRef<any>(null);

  cv.current = canvas;

  // Effective edge id: explicit prop wins, else the source:out->target:in default
  // (mirrors reconcileConnections so collision dedup is consistent).
  const edgeId = useCallback(() => {
    if (props.id != null) return props.id;
    const srcOut = props.sourceOutput != null ? props.sourceOutput : 'out';
    const tgtIn = props.targetInput != null ? props.targetInput : 'in';
    return `${props.source}:${srcOut}->${props.target}:${tgtIn}`;
  }, [props.id, props.source, props.sourceOutput, props.target, props.targetInput]);

  useEffect(() => {
    connId.current = edgeId();
    if (cv.current) {
      cv.current.registerConnection(connId.current, {
        id: connId.current,
        source: props.source,
        sourceOutput: props.sourceOutput,
        target: props.target,
        targetInput: props.targetInput
      });
    }
    return () => {
      if (cv.current) cv.current.unregisterConnection(connId.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    null
  );
}
