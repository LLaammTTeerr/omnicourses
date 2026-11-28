# Review round 1: 11-plan-components 

Blocking: none found so far.

Checked: scoped-style cascade for every moved rule (CapMeter, IssueCard, IssueCounts, UnknownIssueList, global .chip.line); specificity ties (.cap.ok .fill vs .cap.in-*.fill: equal, order correct; .vitem.gone vs .vitem.flag: gone still wins); parent-scope rules that reach into components (.trow.stale .cap, .vitem transition, .v-move, .vfoot .btn, .rail .stale on IssueCounts root, print .vitem) all target either component roots or slot content, so they still match; p margin reset in styles.css makes "margin-top: 2px" equal to the editor's "margin: 2px 0 0"; no other "chip line" user exists, so the new global rule only reaches the old targets.

Non-blocking candidates:
- IssueCard styles the editor-only states .new/.gone (classes the editor passes through fallthrough).
- .vitem.in-editor.gone carries a redundant in-editor qualifier.
- Shared page textContent whitespace changed in the citation link and the unknown list (not visible, tests green).
- Coverage list (named in the objective) not extracted: needs the report's reason.


## After own review: the implementer's report
report.md does not exist in /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/11-plan-components (only the proof spec and its config). So the screenshot result and the list of drifted styles that brief part C asks for are not written down anywhere a person will read.
I checked the screenshots instead: /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/shots/pm1 (04:26) and /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/shots/final2 (04:41, after the last code commit) hold the same 24 images, byte for byte (editor, editor-states, editor-states2, shared-rich, shared-clean, shared-print, each at desktop and phone width, light and dark). base1/base2 differ from each other because they were taken before rendering was made deterministic; det1 and det2 match each other. I could not confirm which tree pm1 was taken on.
What the fixtures cover: every issue kind, a term over its cap, a term under its minimum, withheld codes, coverage, the new/gone/stale states, and print media. Not covered: the editor's drop preview. Nothing in the fixtures sets row.load.delta, so the .pre bar in the CapMeter slot and .cap.preview are never drawn. From reading the CSS, those rules still match: the slot content keeps the editor's scope id.

## Verdict: approve (no blocking findings)
Tests: plans/ and sharing/ unit tests pass (13 files, 188 tests). Plans.browser and SharedPlan.browser pass (5 tests). vue-tsc passes. The batch changes no spec, backend, openapi or lockfile. depgraph finds no file cycles. The only folder edge involved, sharing to plans, already existed. All 6 commits are signed (G) and use Conventional subjects. There is one changeset, and it is empty.

## Non-blocking
1. report.md is missing. Write it, with the 24-image comparison and these drift questions for the frontend owner:
   - CapMeter, editor vs shared: padding-bottom 16 vs 14px; margin-top 2px only in the editor; track height 8 vs 6px; neutral fill colour ink-3 vs info; the fill animates (grow, transition) only in the editor; ticks are 14px bars at top -3px vs 8px ::before bars; tick label font var(--font) vs var(--mono).
   - IssueCard: violation border mix 22% vs 24%; flag border mix 26% vs 28%; overflow-wrap: anywhere on the text only on the shared page; white-space: nowrap and the hover style on the citation link only in the editor.
   - Coverage list and the .tload label were not extracted. Give the reason: the markup differs (details/cov-list vs a grid of cov-item cards).
2. IssueCard.vue (lines 60-63) styles .new and .gone, states only the editor sets, through classes passed down. Consider keeping .vitem.new and .vitem.gone in IssuesPanel (the component root carries the panel's scope id) and reaching .ic and b with :deep(). Also, the in-editor qualifier on .vitem.in-editor.gone does nothing: only the editor ever sets gone.
3. styles.css:184: .chip.line is now global, at specificity (0,2,0) instead of the editor's scoped (0,4,0). Nothing competes with it today, and IssueCard and IssueCounts are its only users.
4. CapMeter is mostly variant rules. The editor and shared copies share only the markup and about six declarations. This is honest given rule C, but it shrinks only after someone settles the drift questions.
5. On the shared page, textContent whitespace changed in the citation link and in the unknown-issue line. Nothing visible changes and the tests are green.
