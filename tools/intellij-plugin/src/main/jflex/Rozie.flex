package js.rozie.intellij.lexer;

import com.intellij.lexer.FlexLexer;
import com.intellij.psi.tree.IElementType;
import static js.rozie.intellij.lexer.RozieTokenTypes.*;

/*
 * Rozie.flex — JFlex source for the .rozie host lexer.
 *
 * POST-PIVOT (Phase 08.2): injection-first architecture. The lexer's only job
 * is to split the file into SFC block boundaries; each block body emits as ONE
 * contiguous BODY token so JetBrains' built-in HTML/JS/CSS PSI handles parsing
 * inside the block. Any token-fragmenting rule inside IN_TEMPLATE_BODY
 * re-creates the Phase 08.1 P0-UAT-01 bug — DO NOT add carve-outs.
 *
 * Architecture (Pitfall 9 — DO NOT re-implement HTML lexing inside template):
 *   - YYINITIAL handles top-level block boundaries: <rozie>, <template>, <script>,
 *     <props>, <data>, <listeners>, <style>, plus HTML comments and whitespace.
 *   - IN_BLOCK_OPEN_TAG scans attributes inside a block opening tag (e.g.,
 *     `lang="scss"`, `name="Counter"`) until `>`, then transitions to whichever
 *     block-body state was queued by the YYINITIAL rule that matched the open.
 *   - IN_<X>_BODY (one per block kind — script, props, data, listeners,
 *     components, template, style) consumes everything up to the matching
 *     close tag as a single body token. Body content is NOT tokenized further
 *     here — RozieMultiHostInjector splits each body via HTMLLanguage /
 *     JavaScript / CSS injection.
 *
 * Pitfall 4 (state leak) is handled by the FlexAdapter wrapping the generated
 * lexer; YYINITIAL is restored on every reset(...).
 */

%%

%public
%class _RozieLexer
%implements FlexLexer
%function advance
%type IElementType
%unicode

%state IN_BLOCK_OPEN_TAG
%state IN_BLOCK_ATTR_VALUE_DQ
%state IN_BLOCK_ATTR_VALUE_SQ
%state IN_LANG_ATTR_VALUE_DQ
%state IN_LANG_ATTR_VALUE_SQ

%state IN_SCRIPT_BODY
%state IN_PROPS_BODY
%state IN_DATA_BODY
%state IN_LISTENERS_BODY
%state IN_COMPONENTS_BODY
%state IN_STYLE_BODY

%state IN_TEMPLATE_BODY

%state IN_HTML_COMMENT

%{
  /**
   * Body state to enter when we hit `>` inside an IN_BLOCK_OPEN_TAG. Set by
   * the YYINITIAL rule that recognized the block opening tag.
   *
   * Default of `YYINITIAL` is a safe fallback for unrecognized opens (which
   * shouldn't happen, but guarantees we never wedge on weird input).
   */
  private int pendingBodyState = YYINITIAL;

  /**
   * Return state for IN_HTML_COMMENT. Comments can appear at the top level
   * (YYINITIAL) or inside <template> (IN_TEMPLATE_BODY). Set by whichever
   * state opens the comment.
   */
  private int htmlCommentReturnState = YYINITIAL;
%}

// ——— Macro definitions ———
WHITESPACE         = [\ \t\f]+
EOL                = \r|\n|\r\n
WS                 = ({WHITESPACE}|{EOL})+
// `:` is not in this character class — block-tag attribute names today never
// use namespaced HTML attrs (xml:lang, xlink:href). If they're needed later
// add a dedicated NAMESPACED_ATTR_IDENT rule.
ATTR_IDENT         = [A-Za-z_][A-Za-z0-9_.\-]*

%%

// =====================================================================
// YYINITIAL — between top-level blocks (default state)
// =====================================================================
<YYINITIAL> {
  "<!--"                          { htmlCommentReturnState = YYINITIAL; yybegin(IN_HTML_COMMENT); return HTML_COMMENT_OPEN; }

  "<rozie"                        { pendingBodyState = YYINITIAL;        yybegin(IN_BLOCK_OPEN_TAG); return ROZIE_BLOCK_TAG; }
  "<template"                     { pendingBodyState = IN_TEMPLATE_BODY; yybegin(IN_BLOCK_OPEN_TAG); return TEMPLATE_BLOCK_TAG; }
  "<script"                       { pendingBodyState = IN_SCRIPT_BODY;   yybegin(IN_BLOCK_OPEN_TAG); return SCRIPT_BLOCK_TAG; }
  "<props"                        { pendingBodyState = IN_PROPS_BODY;    yybegin(IN_BLOCK_OPEN_TAG); return PROPS_BLOCK_TAG; }
  "<data"                         { pendingBodyState = IN_DATA_BODY;     yybegin(IN_BLOCK_OPEN_TAG); return DATA_BLOCK_TAG; }
  "<listeners"                    { pendingBodyState = IN_LISTENERS_BODY;yybegin(IN_BLOCK_OPEN_TAG); return LISTENERS_BLOCK_TAG; }
  "<components"                   { pendingBodyState = IN_COMPONENTS_BODY; yybegin(IN_BLOCK_OPEN_TAG); return COMPONENTS_BLOCK_TAG; }
  "<style"                        { pendingBodyState = IN_STYLE_BODY;    yybegin(IN_BLOCK_OPEN_TAG); return STYLE_BLOCK_TAG; }

  "</rozie>"                      { return ROZIE_CLOSE_TAG; }
  "</template>"                   { return TEMPLATE_CLOSE_TAG; }
  "</script>"                     { return SCRIPT_CLOSE_TAG; }
  "</props>"                      { return PROPS_CLOSE_TAG; }
  "</data>"                       { return DATA_CLOSE_TAG; }
  "</listeners>"                  { return LISTENERS_CLOSE_TAG; }
  "</components>"                 { return COMPONENTS_CLOSE_TAG; }
  "</style>"                      { return STYLE_CLOSE_TAG; }

  {WS}                            { return WHITE_SPACE; }
  [^]                             { return BAD_CHARACTER; }
}

// =====================================================================
// IN_BLOCK_OPEN_TAG — inside `<rozie ...>`, `<template ...>`, etc.
// =====================================================================
<IN_BLOCK_OPEN_TAG> {
  "lang"                          { return LANG_ATTR_NAME; }
  "="                             { return EQ; }

  // Lang attribute values get their own state so we can return LANG_ATTR_VALUE
  // (vs ATTR_VALUE_PLAIN). The opening quote is consumed as part of the value
  // state via lookbehind on the following rule.
  \" / [^\"]                      {
                                    // open dq for either lang or generic;
                                    // we can't tell from the quote alone, so
                                    // switch to a generic value state and let
                                    // the token kind disambiguate.
                                    yybegin(IN_BLOCK_ATTR_VALUE_DQ);
                                    return ATTR_VALUE_PLAIN; // partial; returned separately
                                  }
  // Simple cases: empty quoted strings, full quoted strings inline.
  \"[^\"]*\"                      { return ATTR_VALUE_PLAIN; }
  \'[^\']*\'                      { return ATTR_VALUE_PLAIN; }

  ">"                             {
                                    int next = pendingBodyState;
                                    pendingBodyState = YYINITIAL;
                                    yybegin(next);
                                    return GT;
                                  }
  "/>"                            {
                                    pendingBodyState = YYINITIAL;
                                    yybegin(YYINITIAL);
                                    return GT;
                                  }

  {ATTR_IDENT}                    { return ATTR_NAME; }
  {WS}                            { return WHITE_SPACE; }
  [^]                             { return BAD_CHARACTER; }
}

// IN_BLOCK_ATTR_VALUE_DQ / SQ are intentionally left as catch-all consumers so
// that the lookahead-based partial rule in IN_BLOCK_OPEN_TAG above never gets
// stuck. In practice the inline `"..."` and `'...'` rules above handle every
// real-world block-attribute value, but these states are kept defensively.
<IN_BLOCK_ATTR_VALUE_DQ> {
  \"                              { yybegin(IN_BLOCK_OPEN_TAG); return ATTR_VALUE_PLAIN; }
  [^\"]+                          { return ATTR_VALUE_PLAIN; }
}
<IN_BLOCK_ATTR_VALUE_SQ> {
  \'                              { yybegin(IN_BLOCK_OPEN_TAG); return ATTR_VALUE_PLAIN; }
  [^\']+                          { return ATTR_VALUE_PLAIN; }
}

// IN_LANG_ATTR_VALUE_* — currently unreachable (we return ATTR_VALUE_PLAIN for
// all block-attribute values today). Kept reserved for a future pass that
// distinguishes `lang=` values for SCSS/Less detection without re-parsing the
// token stream.
<IN_LANG_ATTR_VALUE_DQ> {
  \"                              { yybegin(IN_BLOCK_OPEN_TAG); return LANG_ATTR_VALUE; }
  [^\"]+                          { return LANG_ATTR_VALUE; }
}
<IN_LANG_ATTR_VALUE_SQ> {
  \'                              { yybegin(IN_BLOCK_OPEN_TAG); return LANG_ATTR_VALUE; }
  [^\']+                          { return LANG_ATTR_VALUE; }
}

// =====================================================================
// IN_HTML_COMMENT — inside `<!-- ... -->`. Returns to whichever state opened
// the comment (htmlCommentReturnState set by the YYINITIAL or IN_TEMPLATE_BODY
// open rule).
// =====================================================================
<IN_HTML_COMMENT> {
  "-->"                           { yybegin(htmlCommentReturnState); return HTML_COMMENT_CLOSE; }
  // Greedy chunk: everything up to the next `-` (which might or might not be
  // the `-->` close). JFlex prefers longest match so the literal `-->` rule
  // above always wins when applicable.
  [^\-]+                          { return HTML_COMMENT_CONTENT; }
  "-"                             { return HTML_COMMENT_CONTENT; }
}

// =====================================================================
// IN_SCRIPT_BODY / IN_PROPS_BODY / IN_DATA_BODY / IN_LISTENERS_BODY
// Single-token greedy bodies up to matching close tag.
// =====================================================================
<IN_SCRIPT_BODY> {
  "</script>"                     { yybegin(YYINITIAL); return SCRIPT_CLOSE_TAG; }
  // Greedy: consume up to (but not including) the next "<" — JFlex's longest-
  // match rule then prefers `</script>` if it applies.
  [^<]+                           { return SCRIPT_BODY; }
  "<"                             { return SCRIPT_BODY; }
}
<IN_PROPS_BODY> {
  "</props>"                      { yybegin(YYINITIAL); return PROPS_CLOSE_TAG; }
  [^<]+                           { return PROPS_BODY; }
  "<"                             { return PROPS_BODY; }
}
<IN_DATA_BODY> {
  "</data>"                       { yybegin(YYINITIAL); return DATA_CLOSE_TAG; }
  [^<]+                           { return DATA_BODY; }
  "<"                             { return DATA_BODY; }
}
<IN_LISTENERS_BODY> {
  "</listeners>"                  { yybegin(YYINITIAL); return LISTENERS_CLOSE_TAG; }
  [^<]+                           { return LISTENERS_BODY; }
  "<"                             { return LISTENERS_BODY; }
}
<IN_COMPONENTS_BODY> {
  "</components>"                 { yybegin(YYINITIAL); return COMPONENTS_CLOSE_TAG; }
  [^<]+                           { return COMPONENTS_BODY; }
  "<"                             { return COMPONENTS_BODY; }
}
<IN_STYLE_BODY> {
  "</style>"                      { yybegin(YYINITIAL); return STYLE_CLOSE_TAG; }
  [^<]+                           { return STYLE_BODY; }
  "<"                             { return STYLE_BODY; }
}

// =====================================================================
// IN_TEMPLATE_BODY — inside <template> ... </template>
//
// POST-PIVOT (Phase 08.2): three rules only — close-tag (line-anchored),
// greedy non-`<` body chunk, plain `<`. Any token-fragmenting rule here
// re-creates the Phase 08.1 P0-UAT-01 bug (HTML injection sees fragmented
// ranges -> can't parse -> blank coloring). DO NOT add carve-outs.
//
// The line-anchor `^` on the close rule is the JFlex equivalent of the
// TextMate line-anchored fix at rozie.tmLanguage.json:55 — top-level SFC
// closes MUST be at column 0 (project convention). This means an inner
// `<template #foo>...</template>` (slot fill) lives inside the greedy
// TEMPLATE_BODY run; no nesting-depth counter required.
//
// The body uses the same `[^<]+` + `<` shape as IN_SCRIPT_BODY (lines
// for IN_SCRIPT_BODY above) — JFlex longest-match still prefers
// `^"</template>"` (11 chars) over a stray `<` (1 char) when both apply,
// so the close-tag rule wins at column-0 positions.
// =====================================================================
<IN_TEMPLATE_BODY> {
  ^"</template>"                  { yybegin(YYINITIAL); return TEMPLATE_CLOSE_TAG; }
  [^<]+                           { return TEMPLATE_BODY; }
  "<"                             { return TEMPLATE_BODY; }
}
