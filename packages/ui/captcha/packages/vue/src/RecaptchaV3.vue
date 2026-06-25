<template>

<div class="rozie-recaptcha-v3" style="display:none" v-bind="$attrs"></div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Required. The public reCAPTCHA v3 site key from your Google admin console.
     */
    sitekey: string;
    /**
     * The default action label reported to reCAPTCHA's risk analysis (e.g. `submit`, `login`). Overridable per call via `execute(action)`.
     */
    action?: string;
    /**
     * Opt in to running one `execute()` at mount and emitting `@verify` with the initial token. Off by default — v3 is imperative-first and tokens are short-lived (~2 min), so fetch one at the moment of submission rather than eagerly at mount.
     */
    executeOnMount?: boolean;
  }>(),
  { action: 'submit', executeOnMount: false }
);

/**
 * The latest verification token (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Written on each successful `execute()` — read it to attach the fresh token to your request.
 * @example
 * <RecaptchaV3 r-model:token="token" sitekey="…" action="signup" />
 */
const token = defineModel<string>('token', { default: '' });

const emit = defineEmits<{
  error: [...args: any[]];
  verify: [...args: any[]];
}>();

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
function execute(action = null) {
  const a = action != null ? action : props.action;
  return loadRecaptchaV3(props.sitekey).then(() => v3Execute(props.sitekey, {
    action: a
  })).then((tok: any) => {
    if (disposed) return tok;
    token.value = tok;
    emit('verify', {
      token: tok,
      action: a
    });
    return tok;
  }).catch((err: any) => {
    if (!disposed) emit('error', {
      error: err
    });
    throw err;
  });
}

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  disposed = false;
  // Warm the script once for this sitekey. If opted in, run an initial execute.
  loadRecaptchaV3(props.sitekey).then(() => {
    if (disposed || !props.executeOnMount) return;
    execute();
  }).catch((err: any) => {
    if (disposed) return;
    emit('error', {
      error: err
    });
  });
  _cleanup_0 = () => {
    disposed = true;
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

defineExpose({ execute });
</script>
