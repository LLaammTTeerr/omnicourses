---
"@omnicourse/backend": patch
---

A text field with a null character, or one character too long once an emoji style mark is counted, is now refused with a 400 instead of failing with a 500: plan names, transcript course names, the sign-up display name, catalog courses, requirement groups, calendar events and the calendar's program filter. A program code with a null character in the curriculum page's address is a 404.
