# Security & supply chain

Rozie's pitch to a design-system author is a trust claim: "write one `.rozie` file, ship six idiomatic targets — and the emitted output is safe to put upstream of your build." A trust claim that can't be verified is just marketing. So Rozie doesn't ask you to trust it — **it tests itself, and here are the batteries.**

This page is the user-facing centerpiece of that posture. Every table below mirrors an executable test in the repo (`tests/security/`), and the tests are the source of truth — if this page and a test ever disagree, the test wins and this page is the bug.

## The four self-test batteries

Rozie runs four automated security batteries over the compiled-output corpus (`tests/dist-parity/fixtures/` — every example × six targets × four entrypoints) on every CI run:

| Battery | What it proves | Source |
|---------|----------------|--------|
| **1 — Sink-scan** | No dangerous HTML/exec sink (`innerHTML`, `dangerouslySetInnerHTML`, `v-html`, `{@html`, `unsafeHTML`, `eval(`, `new Function(`, `document.write`, `insertAdjacentHTML`) escapes its explicit per-target allowlist. A sink may appear **only** in the `r-html` fixture where it legitimately belongs; a stray sink anywhere else fails the gate. Plus the positive companion: `{{ }}` interpolation lowers to each target's **text-safe** binding, never an HTML path. | `tests/security/sink-scan.test.ts` |
| **2 — Sanitizer parity** | Each of the six targets emits its documented `r-html` form; the sanitize-vs-raw matrix below is asserted byte-for-byte against the committed fixtures. | `tests/security/parity.test.ts` |
| **3 — Adversarial input** | Hostile interpolation/attribute values (`javascript:`/`data:` URI schemes, null bytes, `</script>`/`-->`/`]]>` breakout sequences, deep nesting) never produce raw executable markup, and never hang or OOM — every case finishes inside a bounded wall-clock budget. | `tests/security/adversarial.test.ts` |
| **4 — Dependency drift** | CI fails on any **new transitive package name** that isn't on a checked-in allowlist — the new-supply-chain-payload class. A version bump of an already-allowlisted package does not fail it. | `scripts/check-dep-drift.mjs` |

## Sanitizer-parity matrix

This is the trust asset. When you bind a prop into `r-html`, Rozie lowers it to each target's native raw-HTML sink. The honest finding is an **asymmetry**: exactly one target's framework sanitizes the binding at runtime; the other five render raw HTML **by design**. That asymmetry is not a bug to "fix" — it is each framework's own documented behavior, surfaced here so you can make an informed decision about where your `r-html` content comes from.

| Target  | `r-html` emit form                          | Sanitized?                         |
|---------|---------------------------------------------|------------------------------------|
| Angular | `[innerHTML]="content()"`                   | **YES** — runtime via `DomSanitizer` |
| React   | <span v-pre>`dangerouslySetInnerHTML={{ __html: … }}`</span> | No (raw-by-design)                 |
| Vue     | `v-html="…"`                                | No (raw-by-design)                 |
| Svelte  | `{@html …}`                                 | No (raw-by-design)                 |
| Solid   | `innerHTML={…}`                             | No (raw-by-design)                 |
| Lit     | `${unsafeHTML(…)}` (+ directive import)     | No (raw-by-design)                 |

The exact emit forms, transcribed from the asserting test:

```ts
// Angular — routed through DomSanitizer at runtime; NO bypassSecurityTrustHtml
// (which would defeat sanitization).
[innerHTML]="content()"

// React
dangerouslySetInnerHTML={{ __html: props.content }}

// Vue — no literal `r-html=` survives (Phase 24 emit fix)
v-html="props.content"

// Svelte
{@html content}

// Solid
innerHTML={local.content}

// Lit — element-content directive plus its conditional import
${unsafeHTML(this.content)}
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
```

**Practical guidance:** treat `r-html` as a raw sink on **every** target except Angular. Even on Angular, `DomSanitizer` strips scripts/event handlers but is not a substitute for trusting your content source. If the HTML originates from user input, sanitize it yourself (e.g. with DOMPurify) before it reaches an `r-html` binding — Rozie deliberately does not add a runtime sanitizer to the five raw targets, because doing so would diverge from each framework's native behavior and break the "Rozie is invisible at runtime" contract.

## URI-scheme finding (D-09)

A separate, documented cross-framework finding concerns `javascript:` and `data:` URI schemes on `href`/`src` attributes:

> `javascript:`/`data:` URI schemes on `href`/`src` are **accepted in escaped (quoted-attribute) position** across all six targets. Rozie emits no compile-time URI-scheme diagnostic.

This meets the project's accepted bar: hostile content lands in an **escaped attribute position** (it cannot break out of the attribute to inject markup), and **URL-scheme sanitization is the framework runtime's job**, not Rozie's compile step. The adversarial battery (Battery 3) proves the behavioral side — the scheme stays in escaped position, no raw markup, no new diagnostic expected. The parity test pins this as a stable, named policy so this page stays honest:

```ts
const POLICY = {
  uriSchemeSanitization: 'framework-runtime',
  compileTimeDiagnostic: false,
};
```

A compile-time `javascript:`/`data:` URI-scheme warning is a deferred idea for a future security-hardening phase — it would be its own feature (new diagnostic code + per-target wiring), beyond this phase's locked scope.

## Controls-not-tests register

Some supply-chain controls are **operational** — they live in publish workflows and registry settings, not in the compiler. Phase 24 **documents** these so they don't fall off the radar; **implementation is separate follow-up work** and is explicitly out of scope here. This register is the honest status of each:

| Control | Status | Action |
|---------|--------|--------|
| **npm provenance / Sigstore** — publish packages with `--provenance` so consumers can verify each tarball was built from this repo's tagged CI run | Documented (not yet enabled) | Add `--provenance` to the `changeset publish` step in the release workflow; requires the publish job to run in GitHub Actions OIDC context |
| **Publish-token 2FA** — require 2FA / automation-token scoping on the npm publishing identity so a leaked token alone cannot publish | Documented (not yet enforced) | Set the npm org/package publish setting to require 2FA-or-automation-token; rotate to a granular automation token scoped to the `@rozie`/`@rozie-ui` packages |
| **`pull_request_target` secret hygiene** — ensure no workflow exposes publish/registry secrets to untrusted fork PR code via `pull_request_target` | Documented (audited clean) | Keep secret-bearing jobs off `pull_request_target`; if used, never check out + run fork code in a secret-scoped job |

These are tracked as deferred operational follow-ups, not Phase 24 deliverables. The dependency-drift gate (Battery 4) is the one supply-chain control that **is** implemented and enforced in this phase.
