import { mount } from 'svelte';
import { mountTarget } from './mount-common';
// @ts-expect-error virtual .rozie module compiled by @rozie/unplugin (svelte)
import ProbeConsumer from '../ProbeConsumer.rozie';

const inst = mount(ProbeConsumer as never, { target: mountTarget() }) as {
  stress?: () => void;
};
window.__probe = { stress: () => inst.stress?.() };
