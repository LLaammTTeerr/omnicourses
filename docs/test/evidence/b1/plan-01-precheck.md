# PLAN-01 pre-check on production

Recorded by **Hòa**, 11 November 2026. This check confirms the expected results of TC-B1-PLAN-01 before the B1 run ([test cases B1 §7](../../test-cases-b1.md#tc-b1-plan-01-basic-plans)). It is not the B1 run: that runs on 13–15 November with the B1 build tag.

- **Where:** production, https://omnicourses.lamter.cc, with a made-up `example.com` account onboarded to APCS 2024.
- **Browser and width:** Chrome, desktop. Version and width not recorded.

| Case | Result | Note |
| --- | --- | --- |
| PLAN-01b (Screen) | passed | CS160 and CS163 in the first two rows survive a reload; after removing CS160, only CS163 remains. |
| PLAN-01c | passed | A second, private window shows exactly what the first saved. |
| PLAN-01e | passed | With `placements` blocked, the save-failed message shows, the board goes back, and a reload shows the last saved state. |

PLAN-01a, d and f are API cases, confirmed against the code and the e2e tests of #71.

## Gaps seen, not failures

Drag and drop and live validation are B2 (test plan §5), so these do not fail PLAN-01. Recorded in [#89](https://github.com/LLaammTTeerr/omnicourses/issues/89): no live drop preview, no auto-scroll while dragging, no drag and drop animation, no collapse button on the issues panel, no credit meter per term, and other differences from the planner prototype.
