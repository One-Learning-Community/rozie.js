// tsvGrid.ts — pure TSV/clipboard-grid helpers extracted from clipboardFill.rzts
// (D-22, Phase 87 plan 87-01). Sigil-free, self-contained: no $props/$data/$emit/
// $computed/$onMount/$refs/$el/$expose/$watch, and no cross-partial host-symbol
// calls. Moved verbatim (bodies + explanatory comments intact) — behavior-neutral
// extraction, proven by dist-parity zero drift + the data-table VR gate.

// B10: escape a TSV field per the spreadsheet convention — a field containing a tab, a CR/LF,
// or a double-quote is wrapped in double-quotes with internal quotes DOUBLED; an ordinary
// field is emitted verbatim. parseTsv() unescapes symmetrically, so a cell carrying a tab /
// newline / quote round-trips without smearing into adjacent cells (T-63-03-02).
const escapeTsvField = (s: any) => {
  if (s.indexOf('\t') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0 || s.indexOf('"') >= 0) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// parseTsv(text): a TSV string → string[][] (rows of cells). Tolerates \r\n; a trailing
// newline does not add a phantom empty row. Pure — produces plain string DATA only (T-51-01:
// the cells are NEVER eval'd / interpolated into a selector / rendered as markup).
const parseTsv = (text: any) => {
  const str = text != null ? String(text) : ''
  // CR-03: length guard BEFORE the parse — an empty string is a no-op, and a pathologically
  // large clipboard payload (>2M chars) is rejected outright (DoS-shaped input) before the
  // single-pass scan allocates a cell-per-character grid.
  if (str === '' || str.length > 2000000) return []
  // B10: a quote-aware single-pass state machine (replaces the naive split, which corrupted a
  // cell containing a tab/newline). A field that OPENS with a double-quote is "quoted": tabs,
  // newlines, and doubled quotes ("") inside it are literal content until the closing quote;
  // an unquoted field ends at the next tab/newline. CR/LF and CRLF all delimit a row.
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = str.length
  while (i < n) {
    const ch = str[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < n && str[i + 1] === '"') { field = field + '"'; i = i + 2; continue }
        inQuotes = false; i = i + 1; continue
      }
      field = field + ch; i = i + 1; continue
    }
    if (ch === '"' && field === '') { inQuotes = true; i = i + 1; continue }
    if (ch === '\t') { row.push(field); field = ''; i = i + 1; continue }
    if (ch === '\r') {
      if (i + 1 < n && str[i + 1] === '\n') i = i + 1
      row.push(field); field = ''; rows.push(row); row = []; i = i + 1; continue
    }
    if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; i = i + 1; continue }
    field = field + ch; i = i + 1
  }
  // Flush the trailing field + row.
  row.push(field)
  rows.push(row)
  // Drop a single trailing empty row (a TSV that ends with a newline → a phantom [''] row).
  if (rows.length > 1) {
    const last = rows[rows.length - 1]
    if (last.length === 1 && last[0] === '') rows.pop()
  }
  return rows
}

// C3: tile a parsed clipboard `grid` (string[][]) to fill a destination `box` — the spreadsheet
// paste-into-range semantics. The target rectangle is the MAX of the box dims and the source
// dims per axis, so a SMALLER clipboard TILES across a LARGER selection (a single 1×1 cell fills
// the whole range; a 2×2 block repeats — tiled[dr][dc] = src[dr % srcRows][dc % srcCols]), while a
// clipboard LARGER than the selection pastes its full block from the top-left (preserving the
// no-range "clipboard-sized block at the active cell" behavior — a 1×1 destBox + a 1×N clipboard
// yields the full 1×N block, byte-for-byte the prior path). Pure — returns a fresh grid; applies
// nothing. A ragged/short source row defaults the missing cell to '' (coerced per column on write).
const tileGridToBox = (grid: any, box: any) => {
  const srcRows = grid.length
  // srcCols is the MAX row width across ALL rows (not grid[0].length): a RAGGED clipboard
  // (a later row WIDER than the first, e.g. TSV "a\tb\nc\td\te") would otherwise never read
  // the extra column and silently drop those cells. A row SHORTER than srcCols tiles its
  // missing cells as '' (the `v != null ? v : ''` coercion below), never undefined.
  let srcCols = 0
  for (let i = 0; i < srcRows; i++) {
    const w = grid[i] && grid[i].length ? grid[i].length : 0
    if (w > srcCols) srcCols = w
  }
  if (srcRows <= 0 || srcCols <= 0) return grid
  const boxRows = (box.r1 - box.r0) + 1
  const boxCols = (box.c1 - box.c0) + 1
  const rows = boxRows > srcRows ? boxRows : srcRows
  const cols = boxCols > srcCols ? boxCols : srcCols
  const out = []
  for (let r = 0; r < rows; r++) {
    const srcLine = grid[r % srcRows] || []
    const line = []
    for (let c = 0; c < cols; c++) {
      const v = srcLine[c % srcCols]
      line.push(v != null ? v : '')
    }
    out.push(line)
  }
  return out
}

// tileIndex(i, lo, hi): map an index into the inclusive [lo,hi] source span by TILING (repeat
// the source block), handling indices below lo (negative offset) correctly. A 1-wide source
// (lo===hi) always returns lo. Used by fillRange to resolve, per target cell, WHICH source
// cell it copies — so each column copies its OWN source value down its OWN column.
const tileIndex = (i: any, lo: any, hi: any) => {
  const span = (hi - lo) + 1
  if (span <= 1) return lo
  let k = (i - lo) % span
  if (k < 0) k = k + span
  return lo + k
}

export { escapeTsvField, parseTsv, tileGridToBox, tileIndex }
