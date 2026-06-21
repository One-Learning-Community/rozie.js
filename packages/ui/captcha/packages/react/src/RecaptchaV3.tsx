import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
// The v3 api.js loader (inject-once-per-sitekey singleton + ready-gate + token
// execute) lives in a vendored internal module so its branchy logic is
// unit-tested independent of any framework (see internal/loadRecaptchaV3.test.ts).
// codegen copies src/internal/ into every leaf, so this import resolves ×6.
import { loadRecaptchaV3, execute as v3Execute } from './internal/loadRecaptchaV3';

// `disposed` MUST be top-level (not declared inside $onMount): the Solid emitter
// extracts the teardown into a separate onCleanup() whose scope can't see a
// mount-body local, so a `let disposed` inside $onMount is out of scope in the
// teardown. Top-level — visible to both the mount body and the teardown. It also
// guards a late execute() resolve that fires after the component unmounts.

interface RecaptchaV3Props {
  sitekey: string;
  action?: string;
  token?: string;
  defaultToken?: string;
  onTokenChange?: (token: string) => void;
  executeOnMount?: boolean;
  onError?: (...args: any[]) => void;
  onVerify?: (...args: any[]) => void;
}

export interface RecaptchaV3Handle {
  execute: (...args: any[]) => any;
}

const RecaptchaV3 = forwardRef<RecaptchaV3Handle, RecaptchaV3Props>(function RecaptchaV3(_props: RecaptchaV3Props, ref): JSX.Element {
  const props: Omit<RecaptchaV3Props, 'action' | 'executeOnMount'> & { action: string; executeOnMount: boolean } = {
    ..._props,
    action: _props.action ?? 'submit',
    executeOnMount: _props.executeOnMount ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { sitekey, action, token, executeOnMount, defaultValue, onTokenChange, defaultToken, ...rest } = _props as RecaptchaV3Props & Record<string, unknown>;
    void sitekey; void action; void token; void executeOnMount; void defaultValue; void onTokenChange; void defaultToken;
    return rest;
  })();
  const disposed = useRef(false);
  const [token, setToken] = useControllableState({
    value: props.token,
    defaultValue: props.defaultToken ?? '',
    onValueChange: props.onTokenChange,
  });

  // Run a v3 challenge and return a fresh token. The optional `action` arg
  // overrides the prop default for this one call. On success writes the two-way
  // token + emits @verify; on failure emits @error. NB: the resolved param must
  // NOT be named `token` — on Vue, $model.token lowers to a `defineModel('token')`
  // ref named `token`, and a same-named param shadows it (`token.value = token`
  // would write the param). Use `tok` (mirrors Captcha.rozie's `response`).
  function execute(action: any) {
    const a = action != null ? action : props.action;
    return loadRecaptchaV3(props.sitekey).then(() => v3Execute(props.sitekey, {
      action: a
    })).then((tok: any) => {
      if (disposed.current) return tok;
      setToken(tok);
      props.onVerify && props.onVerify({
        token: tok,
        action: a
      });
      return tok;
    }).catch((err: any) => {
      if (!disposed.current) props.onError && props.onError({
        error: err
      });
      throw err;
    });
  }

  useEffect(() => {
    disposed.current = false;
    // Warm the script once for this sitekey. If opted in, run an initial execute.
    loadRecaptchaV3(props.sitekey).then(() => {
      if (disposed.current || !props.executeOnMount) return;
      execute();
    }).catch((err: any) => {
      if (disposed.current) return;
      props.onError && props.onError({
        error: err
      });
    });
    return () => {
      disposed.current = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ execute });
  _rozieExposeRef.current = { execute };
  useImperativeHandle(ref, () => ({ execute: (...args: Parameters<typeof execute>): ReturnType<typeof execute> => _rozieExposeRef.current.execute(...args) }), []);

  return (
    <>
    <div style={{ display: "none" }} {...attrs} className={clsx("rozie-recaptcha-v3", (attrs.className as string | undefined))} data-rozie-s-9148a0b0="" />
    </>
  );
});
export default RecaptchaV3;
