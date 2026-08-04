# @rozie-ui/cropper-react

## 0.1.4

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  Only the **helper-call** read kind landed here — `buildCropper()` is now invoked through a synced ref, so the Cropper.js instance is constructed from the options as they stand at call time. No prop read or `$emit` handler in this component was affected.
- The mount effect's dependency array is now honest, so the `react-hooks/exhaustive-deps` suppression is no longer emitted.
- No API surface change.
- @rozie/runtime-react@0.2.3

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. Declared emit handlers were also landing in the root DOM fallthrough spread and firing twice per emit — the emitter now keeps them out of it. No API surface change.

## 0.1.2

### Patch Changes

- First all-targets release line debut publish. `@rozie-ui/cropper-react` graduates from "deliberately out of release scope" (vue-only dogfooding) to a verified publish, aligned with `-vue`/`-solid`/`-lit`/`-svelte`/`-angular`. Build/typecheck/codegen-idempotency/family-test/VR gates all pass clean for the React target — no emitter changes were needed.
- @rozie/runtime-react@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-react@0.2.0
