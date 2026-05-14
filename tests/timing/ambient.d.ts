// Ambient declarations for build-tool and framework-internal modules that
// ship no type definitions. The timing parity test dynamically imports these
// purely to execute compiled output — it treats them as opaque runtime values.
declare module '@babel/preset-typescript';
declare module '@babel/preset-react';
declare module '@babel/plugin-proposal-decorators';
declare module '@babel/plugin-transform-class-properties';
declare module 'svelte/internal/client';
declare module 'svelte/internal/disclose-version';
