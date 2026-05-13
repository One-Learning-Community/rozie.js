// Phase 06.4 P3 — page-component registry shim.
//
// The vue-vite demo does NOT use @vue/router (single-page App.vue switches via
// a reactive ref + <component :is>). Files-listed in 06.4-03-PLAN.md include
// `src/router.ts` because that's the conventional file in a vue-router setup;
// here we expose only the lit-interop page binding so the App.vue switch
// statement can import it from a stable path.
import LitInterop from './routes/lit-interop.vue';

export const litInteropRoute = {
  name: 'lit-interop' as const,
  component: LitInterop,
};
