
## Review round
- Blocking (MAX_MIB and maxRecords defined twice): correct. Now exported from shared.ts and imported by import.ts (commit c97d8cc).
- Non-blocking taken: import type for Lang and CalendarEventKind in calendar, catalog, curriculum, programs, access.
- Left out: re-indenting the shared.ts bodies (whitespace only, inside template literals; not worth the risk).
- Verify: RESULT: ALL PASS; COUNTS unit-fe=1269 browser=68.
