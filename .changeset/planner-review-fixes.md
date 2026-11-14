---
'@omnicourse/frontend': patch
'@omnicourse/backend': minor
---

The drag preview asks about every term in one request (`POST /plans/{id}/issues/drops`), so it stays within the rate limit. A drop whose rule cannot be checked says "Not checked" instead of looking fine, and a drop that breaks a rule in another term shows as a bad drop. The status strip shows the rule engine's graduation status as it reports it. Passed courses stay in the tray, marked, since a retake is allowed. The issues panel no longer says "no problem" while a group is still short.
