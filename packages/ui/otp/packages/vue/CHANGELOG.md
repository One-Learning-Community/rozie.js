# @rozie-ui/otp-vue

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/otp` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` on-disk numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps, not release history.

  This release adds behavior-VR coverage (paste distribution, backspace navigation, arrow/Home/End movement, mask rendering, disabled state, filled-cell overwrite) as test-only hardening — no API change. The surface is unchanged: 8 props / 2 events / a 2-verb (`focus`, `clear`) imperative handle.

  Unlike the `-react` / `-solid` / `-lit` / `-svelte` leaves in this same wave, `otp-vue`'s `@rozie/runtime-vue` dependency stays at `0.2.1` (unchanged) — `runtime-vue` was not part of this wave's runtime bump (content-identical to the published `0.2.1`).

## 0.1.1

### Patch Changes

- @rozie/runtime-vue@0.2.0
