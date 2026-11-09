---
"@omnicourse/backend": patch
"@omnicourse/frontend": patch
---

Security pass fixes: two sign-ups with the same email now answer 409 instead of 500, the health check no longer reveals the database version, the API docs are hidden in production, and responses no longer advertise Express.
