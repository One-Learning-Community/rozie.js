package js.rozie.intellij.lexer

import com.intellij.lexer.FlexAdapter

/**
 * Thin adapter wrapping the JFlex-generated [_RozieLexer] so the platform's
 * `Lexer` API surface is satisfied.
 *
 * Pitfall 4 (lexer state leak between files) mitigation: [FlexAdapter.reset]
 * resets the underlying flex lexer to `YYINITIAL` whenever a new buffer is
 * passed in, which is exactly what `LexerTestCase`'s per-fixture flow expects.
 * Do NOT subclass `LexerBase` and call `reset` manually here — that bypasses
 * the platform's state-reset machinery.
 *
 * Generated lexer note: `_RozieLexer(null)` is the two-arg constructor JFlex
 * emits when no `%init { ... %}` block is declared; the `null` Reader is
 * replaced by the buffer the FlexAdapter feeds in via `reset(...)`.
 */
class RozieLexerAdapter : FlexAdapter(_RozieLexer(null))
