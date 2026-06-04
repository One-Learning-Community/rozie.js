import { useEffect, useState } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import './PropDefaultCoercion.css';

interface PropDefaultCoercionProps {
  a?: (Record<string, any>) | null;
  b?: number;
  c?: string;
  d?: boolean;
  e?: any[];
  f?: Record<string, any>;
}

export default function PropDefaultCoercion(_props: PropDefaultCoercionProps): JSX.Element {
  const __defaultE = useState(() => (() => [])())[0];
  const __defaultF = useState(() => (() => ({
    k: 1
  }))())[0];
  const props: Omit<PropDefaultCoercionProps, 'a' | 'b' | 'c' | 'd' | 'e' | 'f'> & { a: (Record<string, any>) | null; b: number; c: string; d: boolean; e: any[]; f: Record<string, any> } = {
    ..._props,
    a: _props.a ?? null,
    b: _props.b ?? 0,
    c: _props.c ?? '',
    d: _props.d ?? false,
    e: _props.e ?? __defaultE,
    f: _props.f ?? __defaultF,
  };
  const attrs: Record<string, unknown> = (() => {
    const { a, b, c, d, e, f, ...rest } = _props as PropDefaultCoercionProps & Record<string, unknown>;
    void a; void b; void c; void d; void e; void f;
    return rest;
  })();
  const [observed, setObserved] = useState<any>(null);

  useEffect(() => {
    setObserved({
      a: props.a,
      b: props.b,
      c: props.c,
      d: props.d,
      e: props.e,
      f: props.f
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx("pdc", (attrs.className as string | undefined))} data-rozie-s-109e595c="">
      <pre data-rozie-pdc-output="" data-rozie-s-109e595c="">{rozieDisplay(JSON.stringify(observed))}</pre>
      
      <span data-rozie-pdc-e-identity="" data-rozie-s-109e595c="">{rozieDisplay(props.e === props.e ? 'true' : 'false')}</span>
      <span data-rozie-pdc-f-identity="" data-rozie-s-109e595c="">{rozieDisplay(props.f === props.f ? 'true' : 'false')}</span>
    </div>
    </>
  );
}
