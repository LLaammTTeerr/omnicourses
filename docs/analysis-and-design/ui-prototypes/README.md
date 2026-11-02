# UI prototypes

Static prototypes for OmniCourse. Open any page in a browser; nothing to install. The fonts load from Google Fonts, so the pages need an internet connection to look right.

```bash
python -m http.server 5178 --directory docs/analysis-and-design/ui-prototypes
```

Then open `http://localhost:5178/index.html`. Press **G** on any page, or the round button at the bottom right, to jump to any of the 26 screens and states.

## Design direction

- **Colour per requirement group.** Each of the 8 groups has its own colour and glyph: Tin học cốt lõi blue `</>`, Toán orange `∑`, Vật lý teal `ℏ`, Tiếng Anh yellow `Aa`, Lý luận chính trị rose `§`, Đại cương green `&`, Tự chọn violet `★`, Khóa luận graphite `∎`. The glyph keeps the meaning when colour is not seen.
- **Calm and professional.** A plain light grey page, white cards with a hairline border and a soft shadow, grey boxes inside cards. Colour is kept for the requirement groups and for status. Be Vietnam Pro for all text, JetBrains Mono for course codes. Both have the Vietnamese subset.
- **Course tiles.** Every course is a tile in its group colour. Solid means passed, an inner light ring means in progress, white with a side bar means planned, dashed means a slot with no course chosen yet. Small squares and bars use the same idea: solid passed, half filled in progress, faint still to take.
- Light and dark themes, from the god panel or Settings.
- **English and Vietnamese.** The globe button in the sidebar, the public header, the god panel or Settings switches language. Pages are written in Vietnamese; `assets/i18n.js` swaps the text in English mode (whole strings, then patterns with numbers, then known phrases).
- **Collapsible sidebar.** The panel button at the bottom of the sidebar, or the `[` key, narrows it to icons.

## Pages

| Page | Feature | What to try |
| --- | --- | --- |
| `index.html` | Landing | Signed-out home |
| `sign-in.html`, `sign-up.html` | F1 | Consent at sign-up, password strength |
| `onboarding.html` | F1 | Five questions: program, cohort, target term, credits per term (10–22), transcript |
| `import.html` | F2 | Drop any PDF, then review rows. One row is unreadable on purpose and blocks the save until fixed |
| `dashboard.html` | F3 | Donut of credits: every group's passed credits, then in progress (outer half of the ring), then still to take (shown on hover). Hover a group to lift its segments and see a tooltip. GPA with change from last term, expected graduation, credits left, conduct score. One bar per group: click it for passed, in-progress and still-needed courses. This term's courses, a "needs attention" list, and a "by term" strip with one square per credit |
| `inbox.html` | F10 | Filters, mark all read |
| `audit.html#core` | F3 | One group at a time, every course with status, grade and term |
| `explorer.html`, `#graph` | F4 | Search without diacritics, course drawer, prerequisite graph (click a node to light its chain) |
| `planner.html` | F5, F6, F7, F9 | One row per term, stacked vertically, each with a credit meter marking the 10 TC minimum and 22 TC cap. While dragging, the target row previews its new load and a placeholder, every row turns green or red with the reason, and the issues panel on the right shows new and resolved issues live. The panel collapses. Keyboard: Space lifts, up and down arrows move, Enter drops. Fix suggestions, undo, several plans, goal box, what-if, share link |
| `advisor.html` | F8 | Consent dialog, streamed answers, rule engine result card, clause citations. States: `#consent`, `#general`, `#unavailable`, `#limit` |
| `guides.html` | F11 | Readable signed out (`?guest`). Rule values and the plan's course codes only when signed in. Stale guide warning after 6 months |
| `shared.html`, `#dead` | F9 | Read-only plan for an advisor, and the "not shared" page |
| `settings.html` | | Consent withdrawal, sessions, theme, export, deletion with the 30-day grace period (ADR 0004) |
| `admin.html` | F12 | Groups, courses, shared catalog with impact warning, code format and prerequisite cycle checks (UC-11) |

## Rules the prototype follows

- **Hard rule 1.** AI never decides a rule. The goal box only fills four form fields, and the advisor shows the rule engine's result next to its text. `assets/data.js` has a toy engine that copies what the backend engine will answer: prerequisites, offering terms, the 10–22 TC cap for Tiên tiến (Điều 7.2) and requirement coverage.
- **Hard rule 2.** Nothing logs in to a portal. Guides only link out, and the advisor refuses to register for the student.
- **Hard rule 3.** The persona "Nguyễn Minh Phương", class APCS 24A01 and student ID 24125369 are made up for the demo.
- Clause summaries in the citation drawer paraphrase QĐ 1175/QĐ-KHTN. The PDF is the authority.
- No timetable or Moodle deadlines. Both would need data OmniCourse does not have (Vision §4: integration by link and uploaded data only).

## Illustrative data

Course codes, prerequisites, offering terms and grades are made up for the demo. The guide steps have not been checked against the real portals, and the portal buttons link nowhere.

State such as plans, consent and theme is kept in `localStorage` under `oc2-*`. "Đặt lại dữ liệu demo" in the god panel clears it.
