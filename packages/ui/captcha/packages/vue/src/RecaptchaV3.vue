<template>

<div class="rozie-recaptcha-v3" style="display:none" v-bind="$attrs"></div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

const props = withDefaults(
  defineProps<{ sitekey: string; action?: string; executeOnMount?: boolean }>(),
  { action: 'submit', executeOnMount: false }
);

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
function execute(action: any) {
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
