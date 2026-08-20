# @rozie-ui/captcha-react

## 0.1.8

### Patch Changes

- @rozie/runtime-react@0.6.0

## 0.1.7

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  All three read kinds landed here, across both components:
  - **Prop reads** — `provider` (`Captcha`); `executeOnMount` and `sitekey` (`RecaptchaV3`). Changing the provider or sitekey after mount is now seen by the mount-time API loader instead of being pinned to the first render.
  - **Helper calls** — `buildConfig()` (`Captcha`) and `execute()` (`RecaptchaV3`), so the widget is rendered with the config as it stands at call time.
  - **`$emit` handler prop** — `onError`. A consumer that swaps its error handler after mount now actually receives `error`.

- The mount effect's dependency array is now honest, so the `react-hooks/exhaustive-deps` suppression is no longer emitted (both components).
- No API surface change: same props, same events, same imperative handle.
- @rozie/runtime-react@0.2.3

## 0.1.6

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. Declared emit handlers were also landing in the root DOM fallthrough spread and firing twice per emit — the emitter now keeps them out of it. No API surface change.

## 0.1.5

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.1.4

### Patch Changes

- @rozie/runtime-react@0.2.0
