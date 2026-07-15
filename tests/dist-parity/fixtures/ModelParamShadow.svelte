<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  token?: string;
  onverify?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let {
  token = $bindable(''),
  onverify,
  ...__rozieAttrs
}: Props = $props();

let status = $state('');

// solve(token): param == the model prop name. `$model.token = token` lowers on
// Vue to `token.value = token` (param shadows the defineModel ref) pre-fix.
const solve = (token$local: any) => {
  token = token$local;
  onverify?.({
    token: token$local
  });
};
// setStatus(status): param == the $data key. `$data.status = status` lowers on
// Vue to `status.value = status` (param shadows the state ref) pre-fix.
const setStatus = (status: any) => {
  status = status;
};
// logLabel(label): param == the $computed name. The bare `label` read lowers on
// Vue to `label.value` (reads the computed ref, not the param) pre-fix.
const logLabel = (label: any) => {
  onverify?.({
    token: label
  });
};

const label = $derived(status + '!');
</script>

<div {...__rozieAttrs} class={["model-param-shadow", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-9db1b80e><button onclick={($event) => { solve('demo-token'); }} data-rozie-s-9db1b80e>solve</button><button onclick={($event) => { setStatus('ready'); }} data-rozie-s-9db1b80e>status</button><button onclick={($event) => { logLabel('hi'); }} data-rozie-s-9db1b80e>label</button><span class="status" data-rozie-s-9db1b80e>{status}</span></div>
