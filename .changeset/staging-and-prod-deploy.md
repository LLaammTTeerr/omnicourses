---
"@omnicourse/backend": patch
---

Behind a reverse proxy, rate limits now count each visitor separately (`TRUST_PROXY`), and the API can listen on one interface only (`LISTEN_HOST`).
