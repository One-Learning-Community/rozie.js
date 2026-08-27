#!/usr/bin/env bash
# Spike 017 — re-derive the verdict from upstream source. No IDE required.
# Requires: git, curl, gh (authenticated).
set -uo pipefail

echo "== 017-a  LSP4IJ: injected-language awareness (expect ZERO) =="
T=$(mktemp -d)
git clone --depth 1 --quiet https://github.com/redhat-developer/lsp4ij.git "$T/lsp4ij"
N=$(grep -rl "InjectedLanguageManager\|VirtualFileWindow\|DocumentWindow\|getInjectionHost" \
      "$T/lsp4ij/src/main" --include='*.java' --include='*.kt' 2>/dev/null | wc -l | tr -d ' ')
echo "   files with injection awareness: $N   (expected: 0)"
[ "$N" = "0" ] && echo "   ✓ INVALIDATED as recorded" || echo "   ✗ VERDICT DRIFT — re-open 017-a"
rm -rf "$T"
echo

echo "== 017-b  Native platform LSP: injection handling (expect ~20) =="
M=$(gh api -X GET search/code \
      -f q='repo:JetBrains/intellij-community path:platform/lsp-impl VirtualFileWindow' \
      --jq '.total_count' 2>/dev/null || echo "?")
echo "   files with injection awareness: $M   (expected: ~20)"
echo

echo "== The primitive LSP4IJ lacks (platform/lsp-impl/src/impl/LspDocumentMapping.kt) =="
curl -fsSL https://raw.githubusercontent.com/JetBrains/intellij-community/master/platform/lsp-impl/src/impl/LspDocumentMapping.kt \
  | sed -n '/fun unwrapInjection/,/^  }$/p'
