import type { JSX } from 'solid-js';
import { mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';
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
  onError?: (...args: unknown[]) => void;
  onVerify?: (...args: unknown[]) => void;
  ref?: (h: RecaptchaV3Handle) => void;
}

export interface RecaptchaV3Handle {
  execute: (...args: any[]) => any;
}

export default function RecaptchaV3(_props: RecaptchaV3Props): JSX.Element {
  const _merged = mergeProps({ action: 'submit', executeOnMount: false }, _props);
  const [local, attrs] = splitProps(_merged, ['sitekey', 'action', 'token', 'executeOnMount', 'ref']);
  onMount(() => { local.ref?.({ execute }); });

  const [token, setToken] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'token', '');
  onMount(() => {
    const _cleanup = (() => {
    disposed = false;
    // Warm the script once for this sitekey. If opted in, run an initial execute.
    loadRecaptchaV3(local.sitekey).then(() => {
      if (disposed || !local.executeOnMount) return;
      execute();
    }).catch((err: any) => {
      if (disposed) return;
      _props.onError?.({
        error: err
      });
    });
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    disposed = true;
  });
  });

  // `disposed` MUST be top-level (not declared inside $onMount): the Solid emitter
  // extracts the teardown into a separate onCleanup() whose scope can't see a
  // mount-body local, so a `let disposed` inside $onMount is out of scope in the
  // teardown. Top-level — visible to both the mount body and the teardown. It also
  // guards a late execute() resolve that fires after the component unmounts.
  let disposed = false;
  // Run a v3 challenge and return a fresh token. The optional `action` arg
  // overrides the prop default for this one call. On success writes the two-way
  // token + emits @verify; on failure emits @error. NB: the resolved param must
  // NOT be named `token` — on Vue, $model.token lowers to a `defineModel('token')`
  // ref named `token`, and a same-named param shadows it (`token.value = token`
  // would write the param). Use `tok` (mirrors Captcha.rozie's `response`).
  //
  // `action = null` (an explicit DEFAULT, not a bare `action`) makes the param
  // OPTIONAL — required so the no-arg call in $onMount's executeOnMount path
  // (`execute()`) typechecks. The type-neutralizer otherwise lowers a bare param
  // to a REQUIRED `action: any`, which Vue's strict declaration emit (vue-tsc)
  // rejects at the `execute()` call (TS2554) — the other five targets don't
  // body-typecheck the emitted leaf, so the issue is Vue-only but real. The
  // default is logic-neutral: the body already guards `action != null`.
  function execute(action$local = null) {
    const a = action$local != null ? action$local : local.action;
    return loadRecaptchaV3(local.sitekey).then(() => v3Execute(local.sitekey, {
      action: a
    })).then((tok: any) => {
      if (disposed) return tok;
      setToken(tok);
      _props.onVerify?.({
        token: tok,
        action: a
      });
      return tok;
    }).catch((err: any) => {
      if (!disposed) _props.onError?.({
        error: err
      });
      throw err;
    });
  }

  return (
    <>
    <div style={{ display: "none" }} {...attrs} class={"rozie-recaptcha-v3" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-9148a0b0="" />
    </>
  );
}
