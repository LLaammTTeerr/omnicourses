# Student handbook passages

The student handbook (Sổ tay sinh viên) as passages the F8 advisor retrieves and cites next to the regulation clauses in `../regulations` ([ADR 0016](../../../../../docs/analysis-and-design/adr/0016-advisor-harness.md)). This folder holds data and its extractor only.

| File | Written by | What it is |
| --- | --- | --- |
| `sources/<id>.source.json` | a person | Title, issuer, the PDF's and the text layer's sha256, the sections with their PDF pages, hand overrides, excluded pages and notes. |
| `<id>.json` | `handbook:extract` | The source file plus `passages` and the redaction counts. |
| `<id>.md` | `handbook:extract` | The same, readable. Never edit it by hand. |

Neither the PDF nor its text layer is committed: the repository is public and the handbook prints staff names, phone numbers and e-mail addresses.

## Passages

- An excerpted regulation (`kind: regulation`) gives one passage per khoản, and one for an article's text before its first khoản: `<id>/hoc-bong/d2/k2`, labelled `Quy định xét cấp học bổng khuyến khích học tập, Điều 2, khoản 2`. Each excerpt keeps its own Điều numbering, which is not QĐ 1175's.
- A prose section (offices, faculties, the calendar) gives one passage per printed upper-case heading: `<id>/ke-hoach-nam-hoc/p4`, labelled with the section, the faculty or programme it sits under, and the heading.
- A passage over 1,500 characters is split at paragraph breaks into `/p1`, `/p2`…
- `pages` are the printed page numbers (PDF page minus `printedPageOffset`).

## Redaction

Every line passes `redactionRule` before it becomes text. A line with an e-mail address, a phone number or extension, an academic title before a name, Ông/Bà before a name, or a common surname followed by two or three capitalised words is dropped. In prose sections a contact block (from "Thông tin chung", "Ban Chủ nhiệm", "Liên hệ"…) is dropped line by line until the first line that is not a role, a label, a name, an address or a web address; only public web addresses survive, for referrals. The JSON keeps the counts per rule, never the lines. `handbook.spec.ts` re-runs the rules on every committed line, so a leak fails CI.

## Regenerating

```bash
pdftotext <handbook>.pdf /tmp/<id>.txt      # in an empty folder outside the repository
npm run build -w src/backend
npm run handbook:extract -w src/backend -- <id> /tmp/<id>.txt
HANDBOOK_TEXT_DIR=/tmp npm test -w src/backend -- handbook   # also proves the JSON is reproducible
```

The extractor refuses a text layer whose sha256 is not the one in the source file. Read the generated Markdown against the PDF, and search it for names, before committing.
