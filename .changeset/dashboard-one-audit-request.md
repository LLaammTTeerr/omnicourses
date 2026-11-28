---
"@omnicourse/backend": patch
"@omnicourse/frontend": patch
---

The dashboard now loads the degree audit once, however many terms the record has, so reloading it no longer runs into the request limit. The audit API gives, for each term, the requirement groups, combined minimums and remaining credits as they stood at its end.
