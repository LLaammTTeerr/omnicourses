# UI prototypes

Static prototypes for OmniCourse. Open any page in a browser; nothing to install. The fonts load from Google Fonts, so the pages need an internet connection to look right.

```bash
python -m http.server 5178 --directory docs/analysis-and-design/ui-prototypes
```

Then open `http://localhost:5178/index.html`. Press **G** on any page, or the round button at the bottom right, to jump to any of the 27 screens and states.

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
| `dashboard.html` | F3 | Donut of credits: every group's passed credits, then in progress (hatched), then still to take in light gray. Hover a group in the donut or in the requirement list to light it in both. GPA with change from last term, expected graduation, credits left, conduct score. Hover a GPA dot, a conduct bar or a past term square to preview the whole page as it stood at the end of that term; click it, the arrows in the header, the term picker or the arrow keys to stay there. On load the numbers count up and the bars grow for half a second. One bar per group: click it for passed, in-progress and still-needed courses. This term's courses (or a past term's grades), a "needs attention" list (or the term summary), and a "by term" strip with one square per credit |
| `calendar.html` | | Week view by period (tiết 1–3 to 10–12) and month view. The title opens a picker for any of the 16 weeks. Click a class, exam or deadline to open its details (time, room, repeat, lecturer, credits, group, next session) in the right-hand card, in place of "Coming up": time, room, credits, group, what comes next, and a note for that class and one for the course (kept in the browser). "Coming up" lists deadlines. Below, the courses this term with every session, room and lecturer, including sessions held every other week. The student enters the timetable; nothing is read from the school portal |
| `inbox.html` | F10 | Filters on the right, mark all read. The bell in the sidebar opens a short popover with what needs attention and a link here |
| `audit.html` | F3 | Grades. Three figures (cumulative GPA, credits passed, best term) beside a line chart of term averages with the pass (5) and excellent (8) lines; a term with a failed course has a red dot. Hover a term for its figures, click it to jump to its courses. Filter by group or search by name or code. Below, the current term, the planned terms, then past terms: each course with what each graded part adds stacked on a 0–10 bar with thin cutoffs at 5 and 8, the grade and a status (in progress, planned, passed, failed). A course not finished says what the parts still to grade need to pass and to reach excellent. Click a course for each graded part and, for a retake, every sitting |
| `explorer.html`, `#graph` | F4 | Each group lists courses in progress, then available, then locked (a padlock and the missing prerequisites), then passed. Search without diacritics, course drawer, prerequisite graph (click a node to light its chain; drag or scroll inside it to pan) |
| `planner.html` | F5, F6, F7, F9 | One row per term, stacked vertically, each with a credit meter marking the 10 TC minimum and 22 TC cap. While dragging, the target row previews its new load and a placeholder, every row turns green or red with the reason, and the issues panel on the right shows new and resolved issues live. The panel collapses. While dragging, terms that cannot take the course (not offered, or before a prerequisite) fade out and refuse the drop; a plan that already has one still loads and shows the issue. Keyboard: Space lifts, up and down arrows move and skip those terms, Enter drops. Fix suggestions, undo, several plans (deleting one asks first), goal box, what-if, share link |
| `advisor.html` | F8 | Conversation list on the right (switch, new conversation), consent dialog, streamed answers, rule engine result card, clause citations. States: `#consent`, `#general`, `#unavailable`, `#limit` |
| `guides.html` | F11 | Readable signed out (`?guest`). Rule values and the plan's course codes only when signed in. Stale guide warning after 6 months. Links to the real school portals, checked 02/11/2026 |
| `shared.html`, `#dead` | F9 | Read-only plan for an advisor in the planner's own layout (status strip, term rows with credit meters, violations rail), and the "not shared" page |
| `settings.html` | | Consent withdrawal, sessions, theme, export, deletion with the 30-day grace period (ADR 0004) |
| `admin.html` | F12 | Groups, courses, shared catalog with impact warning, code format and prerequisite cycle checks (UC-11) |

## Rules the prototype follows

- **Hard rule 1.** AI never decides a rule. The goal box only fills four form fields, and the advisor shows the rule engine's result next to its text. `assets/data.js` has a toy engine that copies what the backend engine will answer: prerequisites, offering terms, the 10–22 TC cap for Tiên tiến (Điều 7.2) and requirement coverage.
- **Hard rule 2.** Nothing logs in to a portal. Guides only link out, and the advisor refuses to register for the student.
- **Hard rule 3.** The persona "Nguyễn Minh Phương", class APCS 24A01 and student ID 24125369 are made up for the demo.
- Clause summaries in the citation drawer paraphrase QĐ 1175/QĐ-KHTN. The PDF is the authority.
- The calendar is an exploratory prototype with synthetic classes, exams and deadlines. Its intended input is a timetable entered by the student; it does not read a school portal or Moodle and does not establish a new release requirement.

## Illustrative data

Course codes, prerequisites, offering terms and grades are made up for the demo. The guide steps have not been checked against the real portals, and the portal buttons link nowhere.

State such as plans, consent and theme is kept in `localStorage` under `oc2-*`. "Đặt lại dữ liệu demo" in the god panel clears it.
