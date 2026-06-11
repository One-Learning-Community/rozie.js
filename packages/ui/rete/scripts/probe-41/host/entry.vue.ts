import { createApp, h, ref } from 'vue';
import { mountTarget } from './mount-common';
// @ts-expect-error virtual .rozie module compiled by @rozie/unplugin (vue)
import ProbeConsumer from '../ProbeConsumer.rozie';

const probeRef = ref<{ stress: () => void } | null>(null);
const app = createApp({ render: () => h(ProbeConsumer as never, { ref: probeRef }) });
app.config.compilerOptions.isCustomElement = (tag: string) => tag.startsWith('rozie-');
app.mount(mountTarget());
window.__probe = { stress: () => probeRef.value?.stress() };
