---
"@omnicourse/backend": patch
---

The degree audit no longer reports credits still to go for a group it counts as met, keeps a failed or in-progress course's own status in every group that needs it (so the planner names it as missing there too), no longer lists a group with no minimum of its own as a graduation condition met, and gives both credit figures with a credits_differ warning.
