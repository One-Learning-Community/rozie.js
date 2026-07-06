import type { JSX } from 'solid-js';
import { createMemo, createSignal, splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';

interface ModelParamShadowProps {
  token?: string;
  defaultToken?: string;
  onTokenChange?: (token: string) => void;
  onVerify?: (...args: unknown[]) => void;
}

export default function ModelParamShadow(_props: ModelParamShadowProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['token']);

  const [token, setToken] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'token', '');
  const [status, setStatus] = createSignal('');
  const label = createMemo(() => status() + '!');

  // solve(token): param == the model prop name. `$model.token = token` lowers on
  // Vue to `token.value = token` (param shadows the defineModel ref) pre-fix.
  function solve(token$local: any) {
    setToken(token$local);
    _props.onVerify?.({
      token: token$local
    });
  }

  // setStatus(status): param == the $data key. `$data.status = status` lowers on
  // Vue to `status.value = status` (param shadows the state ref) pre-fix.
  function setStatus$local(status: any) {
    setStatus(status);
  }

  // logLabel(label): param == the $computed name. The bare `label` read lowers on
  // Vue to `label.value` (reads the computed ref, not the param) pre-fix.
  function logLabel(label: any) {
    _props.onVerify?.({
      token: label()
    });
  }

  return (
    <>
    <div {...attrs} class={"model-param-shadow" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-9db1b80e="">
      <button onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { solve('demo-token'); }} data-rozie-s-9db1b80e="">solve</button>
      <button onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { setStatus('ready'); }} data-rozie-s-9db1b80e="">status</button>
      <button onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { logLabel('hi'); }} data-rozie-s-9db1b80e="">label</button>
      <span class={"status"} data-rozie-s-9db1b80e="">{status()}</span>
    </div>
    </>
  );
}
