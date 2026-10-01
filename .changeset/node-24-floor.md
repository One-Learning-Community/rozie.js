---
"@rozie/core": minor
---

Node 24 is now the supported floor for the Rozie toolchain (compiler, unplugin, Babel plugin, CLI). Node 20 reached end-of-life in April 2026; CI now builds and tests on Node 24 only. No toolchain package declares `engines`, so installing on an older Node is not blocked, but it is no longer tested.
