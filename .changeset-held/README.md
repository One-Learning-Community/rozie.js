# Held-back changesets

These are **pending, unconsumed changesets deliberately excluded from the current
release wave**. They are NOT abandoned — they must be moved back into `.changeset/`
before the next wave, or the work they describe ships with no changelog entry and
its packages stay stale on npm.

## Why this directory exists

`.changeset/config.json`'s `ignore` list is the repo's mechanism for families that
**never** publish (see `806ff5f51`). That is the wrong tool here: these packages DO
publish, they are just not in *this* wave. An `ignore` entry is a permanent-looking
config edit for a temporary purpose, and a forgotten entry silently suppresses a
later wave.

A holding directory outside `.changeset/` is inert, reversible with `git mv`, and
leaves `config.json` untouched. It must live OUTSIDE `.changeset/` — a subdirectory
such as `.changeset/held/` does NOT work: changesets treats the directory entry as a
changeset id and fails with `ENOENT: .changeset/held/changes.md`.

## Restore

```bash
git mv .changeset-held/*.md .changeset/
git rm .changeset-held/README.md   # or keep the dir for the next scoped wave
```

## Held as of the @rozie-ui/rete-* 0.3.0 wave (2026-08-27)

| Changeset | Bump |
|---|---|
| `81-per-target-example-jsdoc.md` | `@rozie/core` minor |
| `82-multi-root-slot-fallthrough.md` | `@rozie/core` minor |
| `quick-260824-rhi-match-host-fallthrough.md` | `@rozie/core` minor |
| `rozie-language-service.md` | `@rozie/core` minor |
| `81-rozie-ui-example-jsdoc-leaves.md` | 102 `@rozie-ui` leaves, patch |

The unscoped tarball-drift audit run for the rete wave found **103 stale-published
packages**: those same 102 leaves, plus `@rozie/unplugin` (`src/emitSidecar.ts`).
`@rozie/unplugin` carries no changeset of its own but sits in the `fixed` version
group with `@rozie/core`, so the four core minors above bump it in lockstep.

Every stale package is therefore covered by the changesets in this directory.
Releasing them clears the drift; leaving them held keeps it. Do not delete them.
