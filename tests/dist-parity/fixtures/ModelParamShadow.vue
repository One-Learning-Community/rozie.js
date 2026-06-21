<template>

<div class="model-param-shadow" v-bind="$attrs">
  <button @click="solve('demo-token')">solve</button>
  <button @click="setStatus('ready')">status</button>
  <button @click="logLabel('hi')">label</button>
  <span class="status">{{ status }}</span>
</div>

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const token = defineModel<string>('token', { default: '' });

const emit = defineEmits<{
  verify: [...args: any[]];
}>();

const status = ref('');

const label = computed(() => status.value + '!');

// solve(token): param == the model prop name. `$model.token = token` lowers on
// Vue to `token.value = token` (param shadows the defineModel ref) pre-fix.
const solve = (token$local: any) => {
  token.value = token$local;
  emit('verify', {
    token: token$local
  });
};

// setStatus(status): param == the $data key. `$data.status = status` lowers on
// Vue to `status.value = status` (param shadows the state ref) pre-fix.
// setStatus(status): param == the $data key. `$data.status = status` lowers on
// Vue to `status.value = status` (param shadows the state ref) pre-fix.
const setStatus = (status$local: any) => {
  status.value = status$local;
};

// logLabel(label): param == the $computed name. The bare `label` read lowers on
// Vue to `label.value` (reads the computed ref, not the param) pre-fix.
// logLabel(label): param == the $computed name. The bare `label` read lowers on
// Vue to `label.value` (reads the computed ref, not the param) pre-fix.
const logLabel = (label$local: any) => {
  emit('verify', {
    token: label$local
  });
};
</script>
