---
"@omnicourse/backend": patch
---

A blank or invalid `SESSION_TTL_DAYS` or `PORT` now falls back to its default (7 days, port 3000) instead of signing everyone out at once or picking a random port.
