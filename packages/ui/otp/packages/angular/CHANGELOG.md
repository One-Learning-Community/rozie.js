# @rozie-ui/otp-angular

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/otp` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0` on-disk number was never published; it is a changesets ripple from `@rozie/runtime-*` bumps, not release history.

  This release adds behavior-VR coverage (paste distribution, backspace navigation, arrow/Home/End movement, mask rendering, disabled state, filled-cell overwrite) as test-only hardening — no API change. The surface is unchanged: 8 props / 2 events / a 2-verb (`focus`, `clear`) imperative handle.

  This leaf's only dependency is `tslib` — no `@rozie/runtime-*` dependency, so it is unaffected by the `@rozie/runtime-*` 0.2.2 bump landing in this same wave. `otp` is a pure-Rozie family (no third-party engine): framework peer only, no external engine peer.
