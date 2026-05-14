# Phase 7 Plan 02 — pinned Playwright screenshot environment (D-12, threat T-07-05).
#
# Visual-regression screenshots are deterministic ONLY inside one pinned
# container image: fonts are baked in, and content-addressed pinning by sha256
# digest means the tag cannot be silently re-pointed (threat T-07-05 mitigation).
#
# The tag `v1.60.0-jammy` matches the `@playwright/test` version pinned in
# tests/visual-regression/package.json (1.60.0 — verified via
# `npm view @playwright/test version`). The digest is the canonical multi-arch
# manifest-list digest resolved from mcr.microsoft.com.
#
# .github/workflows/visual-regression.yml runs the CI job inside this image via
# the job-level `container:` key (referencing the same digest). This Dockerfile
# is the committed record of the pin + a local escape hatch
# (`docker build` / `docker run`) for reproducing CI baselines off-CI.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy@sha256:e1529a04087193966ea15d4a1617345bdaa0791690a24ab2c42b65f9ce5b2cdc

WORKDIR /work

# The repo is bind-mounted at runtime (`docker run -v $(pwd):/work`); no COPY.
# Baseline generation (D-12):
#   docker run --rm -v $(pwd):/work -w /work \
#     mcr.microsoft.com/playwright:v1.60.0-jammy@sha256:e1529a04087193966ea15d4a1617345bdaa0791690a24ab2c42b65f9ce5b2cdc \
#     bash -c "corepack enable && pnpm install --frozen-lockfile && \
#              pnpm turbo run build && \
#              pnpm --filter @rozie/visual-regression test:visual --grep vue --update-snapshots"
