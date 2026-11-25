---
"@omnicourse/backend": patch
---

Deleting a requirement group that saved plans still use now answers 409 `referenced_item` ("Saved plans use the group") instead of a server error, and the group stays.
