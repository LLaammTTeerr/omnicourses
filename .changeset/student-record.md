---
"@omnicourse/backend": minor
---

Students can save their transcript (`PUT /api/users/me/transcript`) and read it back (`GET /api/users/me/transcript`): course, credits, term and result (a grade, in progress, exempt, pass or fail) for each course taken, with retakes kept as separate rows.
