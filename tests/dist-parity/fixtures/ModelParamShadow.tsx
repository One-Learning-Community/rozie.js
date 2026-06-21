import { useCallback, useMemo, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';

interface ModelParamShadowProps {
  token?: string;
  defaultToken?: string;
  onTokenChange?: (token: string) => void;
  onVerify?: (...args: any[]) => void;
}

export default function ModelParamShadow(props: ModelParamShadowProps): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { token, defaultValue, onTokenChange, defaultToken, ...rest } = props as ModelParamShadowProps & Record<string, unknown>;
    void token; void defaultValue; void onTokenChange; void defaultToken;
    return rest;
  })();
  const [token, setToken] = useControllableState({
    value: props.token,
    defaultValue: props.defaultToken ?? '',
    onValueChange: props.onTokenChange,
  });
  const [status, setStatus] = useState('');
  const label = useMemo(() => status + '!', [status]);

  const { onVerify: _rozieProp_onVerify } = props;
  const solve = useCallback((token$local: any) => {
    setToken(token$local);
    _rozieProp_onVerify && _rozieProp_onVerify({
      token: token$local
    });
  }, [_rozieProp_onVerify, setToken]);
  function setStatus$local(status: any) {
    setStatus(status);
  }
  const logLabel = useCallback((label: any) => {
    _rozieProp_onVerify && _rozieProp_onVerify({
      token: label
    });
  }, [_rozieProp_onVerify, label]);

  return (
    <>
    <div {...attrs} className={clsx("model-param-shadow", (attrs.className as string | undefined))} data-rozie-s-9db1b80e="">
      <button onClick={($event) => { solve('demo-token'); }} data-rozie-s-9db1b80e="">solve</button>
      <button onClick={($event) => { setStatus('ready'); }} data-rozie-s-9db1b80e="">status</button>
      <button onClick={($event) => { logLabel('hi'); }} data-rozie-s-9db1b80e="">label</button>
      <span className={"status"} data-rozie-s-9db1b80e="">{status}</span>
    </div>
    </>
  );
}
