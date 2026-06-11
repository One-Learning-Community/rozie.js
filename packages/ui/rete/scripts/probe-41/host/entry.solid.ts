import { render } from 'solid-js/web';
import { mountTarget } from './mount-common';
// @ts-expect-error virtual .rozie module compiled by @rozie/unplugin (solid)
import ProbeConsumer from '../ProbeConsumer.rozie';

let handle: { stress?: () => void } = {};
render(() => ProbeConsumer({ ref: (h: { stress?: () => void }) => (handle = h) }), mountTarget());
window.__probe = { stress: () => handle.stress?.() };
