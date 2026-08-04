import { useEffect, useRef, useState } from 'react';
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
  const _aRef = useRef(props.a);
  _aRef.current = props.a;
  const _bRef = useRef(props.b);
  _bRef.current = props.b;
  const _cRef = useRef(props.c);
  _cRef.current = props.c;
  const _dRef = useRef(props.d);
  _dRef.current = props.d;
  const _eRef = useRef(props.e);
  _eRef.current = props.e;
  const _fRef = useRef(props.f);
  _fRef.current = props.f;
  const [observed, setObserved] = useState<any>(null);

  useEffect(() => {
    setObserved({
      a: _aRef.current,
      b: _bRef.current,
      c: _cRef.current,
      d: _dRef.current,
      e: _eRef.current,
      f: _fRef.current
    });
  }, []);

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
