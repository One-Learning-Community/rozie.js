<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  /**
   * Required. The public reCAPTCHA v3 site key from your Google admin console.
   */
  sitekey: string;
  /**
   * The default action label reported to reCAPTCHA's risk analysis (e.g. `submit`, `login`). Overridable per call via `execute(action)`.
   */
  action?: string;
  /**
   * The latest verification token (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Written on each successful `execute()` — read it to attach the fresh token to your request.
   * @example
   * <RecaptchaV3 r-model:token="token" sitekey="…" action="signup" />
   */
  token?: string;
  /**
   * Opt in to running one `execute()` at mount and emitting `@verify` with the initial token. Off by default — v3 is imperative-first and tokens are short-lived (~2 min), so fetch one at the moment of submission rather than eagerly at mount.
   */
  executeOnMount?: boolean;
  onerror?: (...args: unknown[]) => void;
  onverify?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let {
  sitekey,
  action = 'submit',
  token = $bindable(''),
  executeOnMount = false,
  onerror,
  onverify,
  ...__rozieAttrs
}: Props = $props();

// The v3 api.js loader (inject-once-per-sitekey singleton + ready-gate + token
// execute) lives in a vendored internal module so its branchy logic is
// unit-tested independent of any framework (see internal/loadRecaptchaV3.test.ts).
// codegen copies src/internal/ into every leaf, so this import resolves ×6.
import { loadRecaptchaV3, execute as v3Execute } from './internal/loadRecaptchaV3';
// `disposed` MUST be top-level (not $onMount-local): the exported `execute()`
// below — callable any time via `$expose({ execute })`, including after
// unmount — reads it to guard a late resolve that fires post-unmount. That
// cross-function visibility (not a per-target emitter limitation) is why this
// one stays top-level even after emitter-hardening backlog item #2 landed
// (contrast Captcha.rozie's `disposed`, which IS $onMount-local — its
// exposed handle functions don't read it).
let disposed = false;
// Run a v3 challenge and return a fresh token. The optional `action` arg
// overrides the prop default for this one call. On success writes the two-way
// token + emits @verify; on failure emits @error. NB: the resolved param must
// NOT be named `token` — on Vue, $model.token lowers to a `defineModel('token')`
// ref named `token`, and a same-named param shadows it (`token.value = token`
// would write the param). Use `tok` (mirrors Captcha.rozie's `response`).
//
// A bare `action` (no author default) is fine — the emitter now lowers a
// TRAILING `$expose` verb param optional (`action?: any`) whenever it sees a
// fewer-arg internal call to the SAME verb, which the no-arg
// executeOnMount path (`execute()`) below is (emitter-hardening backlog
// item #5). The `action = null` author-side default this comment used to
// require is gone — the compiler owns the arity now, not this source.
export function execute(action$local?: any) {
  const a = action$local != null ? action$local : action;
  return loadRecaptchaV3(sitekey).then(() => v3Execute(sitekey, {
    action: a
  })).then((tok: any) => {
    if (disposed) return tok;
    token = tok;
    onverify?.({
      token: tok,
      action: a
    });
    return tok;
  }).catch((err: any) => {
    if (!disposed) onerror?.({
      error: err
    });
    throw err;
  });
}

onMount(() => {
  disposed = false;
  // Warm the script once for this sitekey. If opted in, run an initial execute.
  loadRecaptchaV3(sitekey).then(() => {
    if (disposed || !executeOnMount) return;
    execute();
  }).catch((err: any) => {
    if (disposed) return;
    onerror?.({
      error: err
    });
  });
  return () => {
    disposed = true;
  };
});
</script>

<div style="display:none" {...__rozieAttrs} class={["rozie-recaptcha-v3", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-9148a0b0></div>
