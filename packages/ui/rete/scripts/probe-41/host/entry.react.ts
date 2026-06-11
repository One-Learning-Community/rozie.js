import { createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { mountTarget } from './mount-common';
// @ts-expect-error virtual .rozie module compiled by @rozie/unplugin (react)
import ProbeConsumer from '../ProbeConsumer.rozie';

const handleRef = createRef<{ stress: () => void }>();
createRoot(mountTarget()).render(createElement(ProbeConsumer, { ref: handleRef }));
window.__probe = { stress: () => handleRef.current?.stress() };
