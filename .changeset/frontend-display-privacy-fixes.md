---
"@omnicourse/frontend": patch
---

Fix display and privacy defects found by the survey:

- When a requirement group cannot be deleted because saved plans use it, the administration screen now says how many saved plans use it, in Vietnamese and English, instead of showing the API's English sentence.
- The sign-up display name, a plan name and a transcript course name are now counted in characters, as the API counts them. A name with emoji is no longer refused early or cut off while you type.
- The onboarding page has one main landmark, so the skip link and screen readers find one main area.
- The course drawer in the curriculum explorer shows the offering terms that are recorded for a course. It says "not recorded" only when none are recorded.
- Signing out now removes the last opened plan and the plan locks that this browser kept, so the next account on the same browser does not get them.
- A new transcript row and the year choices now follow the date in Vietnam, not the time zone of the browser.
