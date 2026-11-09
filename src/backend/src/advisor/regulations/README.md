# Regulation clauses

Clause-level text of the regulations the F8 advisor answers from, so it can cite the document and the clause ([ADR 0003](../../../../../docs/analysis-and-design/adr/0003-language-model-scope.md)). This folder holds data only: retrieval and prompts live elsewhere.

| File | Written by | What it is |
| --- | --- | --- |
| `sources/<id>.pdftotext.txt` | `pdftotext -layout` | The PDF's text layer, unchanged. Anyone with the PDF can reproduce it byte for byte. The PDF itself stays out of git. |
| `sources/<id>.source.json` | a person | Title, issuer, date, source URL, the PDF's sha256 and page count, the text file's sha256, and notes. |
| `sources/<id>.overrides.json` | a person (a model may draft it) | Every hand correction, each with its page, the exact source lines, the replacement and the reason. |
| `<id>.json` | `extract-regulation` | The document metadata plus `clauses`, in source order. |
| `<id>.md` | `extract-regulation` | The same, readable. Never edit it by hand. |

## Clauses

A clause is the finest unit the document numbers: Điều › khoản › điểm. Each one has

- `id`: `<id>/d7/k2/b` (`đ` is written `dd`; a number the source repeats gets `-2` on its second use);
- `label`: the citation as a student writes it, `Điều 7, khoản 2, điểm b`, or `Điều 8, khoản 3 (thứ hai)` for a repeat;
- `level`, `chapter`, `article` (number and title), `khoan`, `diem`, `pages`;
- `text`: the exact wording, marker included. Wrapped lines are joined into paragraphs (`\n` between them), tables are Markdown, and nothing else changes.

A khoản's clause holds only its own lead-in text; each of its điểm is a clause of its own. Text under a Điều before its first khoản is a clause with level `article`.

## Verification

`regulation.spec.ts` runs for every document in `sources/` and fails when:

- the committed JSON is not exactly what the script writes, or the Markdown is not exactly what it renders from the JSON;
- the words of the clause texts (with the preamble, the chapter and article headings and the closing) differ in any way from the words of the text layer, page numbers aside, other than the residue the `text` overrides declare. A `layout` override (a table) may not change a single word;
- ids repeat or do not match their labels, a label does not parse, a Điều is missing, or a source line led by a khoản or điểm marker does not open a clause.

## Adding a document

1. Download the PDF into an empty folder outside the repository, then run `sha256sum` and `pdfinfo` on it.
2. `pdftotext -layout <file>.pdf src/backend/src/advisor/regulations/sources/<id>.pdftotext.txt`
3. Write `sources/<id>.source.json` (copy an existing one) and an empty `sources/<id>.overrides.json` (`[]`).
4. Build and extract: `npm run build -w src/backend && npm run regulations:extract -w src/backend -- <id>`.
5. The script fails loudly on anything it cannot explain: a page that does not start with its number, a gap in the numbering, an override that does not match exactly one place. Fix each with an override, never by editing the generated files. Tables and multi-column headers are `layout` overrides; unreadable glyphs (formulas, symbol fonts) and page-break repeats are `text` overrides.
6. Read the generated Markdown against the PDF, then run `npm test -w src/backend`.

The parser assumes the layout of a Vietnamese decision: the page number as each page's first line, a paragraph start indented at least three columns deeper than its page's wrapped lines, `Chương`, `Điều N.`, `N.` and `a)` headings, and an optional `Nơi nhận:` block at the end. A document laid out differently, such as a handbook, may need a new rule in `regulation.ts`, with a test.
