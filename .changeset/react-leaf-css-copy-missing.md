---
"@rozie-ui/data-table-react": patch
"@rozie-ui/chartjs-react": patch
"@rozie-ui/codemirror-react": patch
---

Fix the React leaf failing to bundle: its built entry imports a stylesheet that the package did not ship in `dist/` (`GroupBar.css` for data-table, `Chart.global.css` for chartjs, `CodeMirror.global.css` for codemirror), so the consumer's bundler could not resolve it. The stylesheets are now copied into `dist/`.
