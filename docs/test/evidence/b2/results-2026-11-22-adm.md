# B2 run: ADM-01, ADM-05 and ADM-06 results, 22 November 2026

Tester: Dũng, with Claude Code sending the API requests. Lâm's bot ran the server steps. These are working notes and raw results, not the B2 report. Times are UTC. The staging server's clock was about 3 s behind the test machine's: A5's deletion request ran at 02:41:13 by the script's clock and was stored as 02:41:10.388.

## Build and setup

| Item | Value |
| --- | --- |
| Server | Staging, https://stag-omnicourses.lamter.cc |
| Build | Staging `7f7974f`, build tag none (B2 not tagged yet). Its staging deploy ran at 23:42:33Z on 21 November, and none came after it during the run. Staging serves no version or commit (`GET /api/health` answers `{"status":"ok","database":"up"}`), so the build was read from the deploy runs. `7f7974f` and the cases' `main` (`defe3ce`, then `f96ddce`) have the same `src/`: the code the cases were read from is the code that ran. |
| API client | `a-adm.mjs`, a Node `fetch` script with no dependencies (Node 24.19.0 on Windows 10; the repository pins 22.22.1, and the script uses only `fetch`), instead of the Swagger page: the same requests, with the bodies of §6. Each run checks the expected results and prints `OK` or `MISMATCH`. It never prints a token. The full output of each run is in the `a-adm-*-output.txt` files next to this one. |
| Server steps | ADM-06b's bootstrap and the database steps of ADM-06e and f: Lâm's bot ran them on staging after "ADM-06b ready", "ADM-06e ready" and "ADM-06f ready" in the #136 thread on Discord. Its posts are copied by hand into `a-adm-06b-bot-output.txt`, `a-adm-06e-db-output.txt` and `a-adm-06f-db-output.txt`. |
| Screens | None: the administration screens are not built. Every screen part of §6 is left for when they land. |

Accounts, all with the §1 password. A1–A4 already existed, with the grants of §1: the pre-check at 02:31:51Z found A1 APCS only, A2 CNTT-TCTA-KHMT only, A3 `catalog_maintainer` only, A4 `access_manager` only with `grantedBy: null`, and S1 none (`a-adm-pre-output.txt`). S6, A5 and A6 were signed up and onboarded to APCS 2024 by their first case.

| Account | User ID |
| --- | --- |
| S6 `b2-s6` | `e81f163c-f53d-4b67-a5e1-6584902dc46a` |
| A5 `b2-a5` | `1e18e2fe-224c-4f02-8d83-7e41bbb1339a` (deleted in ADM-06e) |
| A6 `b2-a6` | `e641029b-391c-45f8-9737-c6ba13bc9970` (deleted in ADM-06f) |

The values of §6, read by the script: `{APCS}` `d3f524f8-e51b-42dd-91ac-013b15d5e033`, `{APCS24}` `4a941965-834b-4d5a-a9c3-91a0607c3cbc`, `{KHMT}` `74ce84b9-c698-43ea-8470-1988a50656a8`, `{KHMT25}` `f7622c13-3e5b-4d6c-95b0-17308c767846`, `{AC}` `c052bbaf-ceda-4f6d-aad6-16be64e37324`, `{KG}` `307a0d8d-a333-418c-8399-ad4bd8fd74b3`.

## Results

### TC-B2-ADM-01: Global catalog permission (A1, A3), 02:32Z

| ID | Result | Notes |
| --- | --- | --- |
| ADM-01a | passed | R1 read N0 in the course, APCS 2024 and CNTT-TCTA-KHMT 2025, with 11 memberships. The first `PATCH` answered **409** `impact_confirmation_required` with a `reviewVersion` and 11 `affectedCurricula`, each with the four fields: APCS2024, APCS2025, then CNTT-TCTA-ATTT, CNTTHUC, CNTTIN, HTTT, KHDL, KHMT, KTPM, MMT and TGMT 2025, the curricula of R1's memberships. R1 still read N0. The confirmed `PATCH` answered **200** with `nameEn` N1 and 2 credits, and R1 read N1 in all three places. The restore answered **409** with another `reviewVersion`, then **200**, and R1 read N0 again. |
| ADM-01b | passed | Both `PATCH`es as A1 answered **403** `permission_required`, `catalog_maintainer`, with no `affectedCurricula` or `reviewVersion`. R1 still read N0. |
| ADM-01c | passed | **400** `validation_failed`, `["curriculumId: property curriculumId should not exist"]`, then `["cohortYear: property cohortYear should not exist"]`. No 409 came first. R1 still read N0. |

### TC-B2-ADM-05: Validation, atomicity and impact (A1, A2, A3, S6), 02:32–02:34Z

| ID | Result | Notes |
| --- | --- | --- |
| ADM-05a | passed | (1)–(3) **400** `validation_failed` with `code: "<code>" is not a course code (letters A-Z and digits, 2 to 20)`; (4) and (5) **400** `["credits must not be less than 1"]`; (6) **400** `["credits must be an integer number"]`; the `GET` **404**. (7) **201** with `"code": "ZZADM05"`. (8) and (9) **400**, (10) **400** `courseCode: "cs-1" is not a course code (…)`, (11) **400** `validation_failed`, not 409. ZZADM05 kept 3 credits and BAA00104 2. (12) **409** `duplicate_code`, "The catalog already has ZZADM05". (13) **404** `not_found`, "No catalog course has the code ZZADM99; a catalog maintainer adds it first". (14) **400** `courseCode: "cs-1" is not a course code (…)`. `{AC}` kept its courses, without ZZADM99. |
| ADM-05b | passed | Run a second time, see the note below. Both links **204**. The first `PATCH` **409** `impact_confirmation_required`, APCS2024 only. The `PATCH` with V1 **409** `impact_changed`, APCS2024 and CNTT-TCTA-KHMT-2025, with a new `reviewVersion`. The `GET` showed 3 credits and 2 memberships. The `PATCH` with V2 **200**, 4 credits, and the `GET` 4. Both unlinks **204**, and the `GET` showed no membership. |
| ADM-05c | passed | BAA00104's `DELETE` **409** `referenced_item`, `references` naming all 11 curricula (`linked in APCS2024` … `linked in CNTT-TCTA-KHMT-2025` …); the `GET` **200** with 11 memberships. T-A5 **200**. ZZADM05's `DELETE` **409** `referenced_item`, `["1 transcript rows name it"]`; the `GET` **200**. |
| ADM-05d | passed | The plan **201** (`81524606-3f89-4098-9748-b0a607ccb559`). The `PATCH` **200** at once, 5 credits, "Học phần thử ADM-05 (sửa)". S6's transcript was identical before and after, ZZADM05's row "Học phần thử ADM-05" with 4 credits. The plan's `terms` and `updatedAt` were identical: ZZADM05 alone in 2026 term 1, `credits` null. The `DELETE` **409** `["1 transcript rows name it", "1 saved plans place it"]`. Clean-up: T-A **200**, the plan **204**, ZZADM05 **204**, the `GET` **404**. |

**The first attempt at 05b–d hit the sign-in rate limit.** The first runs of 05b, 05c and 05d, at 02:32:15–02:32:20Z, came straight after the pre-check, 06a, 01 and 05a. Together they sent more than 10 sign-ins within a minute, and sign-in allows 10 a minute from one address (ADR 0002, `rate-limits.ts`): A3's and S6's sign-ins answered **429**, so their requests went without a token and answered 401. That is the test client's fault, not the app's, and it is kept as `a-adm-05b-attempt1-429-output.txt`, `…05c…` and `…05d…`. What it changed on staging: in 05b, A1 and A2 linked ZZADM05 and then unlinked it (**204** each), so the links ended as they began. In 05c, S6 was signed up and onboarded and saved T-A5, which the rerun of 05c repeats. Nothing else was written. The script was then changed to stop as soon as a sign-in fails, and 05b, 05c and 05d were run again in order at 02:34:20–02:34:27Z, from the same starting state: ZZADM05 with 3 credits and no link.

### TC-B2-ADM-06: Grant lifecycle (A3, A4, A5, A6), 02:31–04:52Z

| ID | Result | Notes |
| --- | --- | --- |
| ADM-06a | passed | A5 signed up (**201**) and onboarded at 02:31:53Z. `GET /api/admin/programs` `{"programs":[]}`; `GET /api/admin/access/programs` **403** `access_manager`; in the export, `program_admin_grants` and `global_admin_grants` `[]`. A4 read `"programs": []` and `"permissions": []`. |
| ADM-06b | passed | The bot ran the bootstrap at 02:39:15Z as `node dist/curriculum-admin/bootstrap-cli.js --user-id <A5>`, the built form of `npm run admin:bootstrap`, in the staging backend folder. It printed exactly `An active access manager already exists; they grant further permissions through the API`, exit code 1 (`a-adm-06b-bot-output.txt`). A4 then read no grant for A5. |
| ADM-06c | passed | 02:39:51Z. Each grant by A4 **200** with `grantedBy` A4; each removal **200** without it. (1) ZZADM06 **201**; after the removal, A5's `DELETE` **403** `catalog_maintainer`, and ZZADM06 still **200**. (2) W **200** `{"courseCode":"CS420","terms":[1,2]}`, its clean-up **200** `terms: null`; after the removal W **403** `program_admin`, and CS420 read `"offeringTerms": null`. (3) A5's grant to A6 **200**, `grantedBy` A5. A5's removal of its own role **200**. A5's repeated grant **403** `access_manager`, and A6's grant stayed as it was. A4's removal of its own role **409** `last_access_manager`, and A4 kept it. Clean-up **204**. |
| ADM-06d | passed | 02:41:12Z. Both exports **200**. A4's `global_admin_grants`: one row, its own `access_manager`, `granted_by` null; `program_admin_grants` `[]`; A1's, A2's and A3's IDs nowhere in the file. A6's `global_admin_grants`: one row, `catalog_maintainer`, `granted_by` A5; `program_admin_grants` `[]`. A4's file holds the tables `ai_usage`, `global_admin_grants`, `onboarding_answers`, `plan_placements`, `plans`, `program_admin_grants`, `sessions` and `transcript_rows`, no key ending in a credential suffix at any depth, and not the request's bearer token. |
| ADM-06e | passed | Before the purge: A5's deletion **202** at 02:41:10Z (server time); A6's grant unchanged, `grantedBy` A5; A4's grant to A5 **409** `recipient_deletion_pending` (`a-adm-06e-before-output.txt`). The bot's query at 02:52Z found A6 active, holding `catalog_maintainer` with `granted_by` A5, and A5 with 1 `onboarding_answers` row and 3 `sessions` rows; it set A5's `purge_after` to 02:51:47Z. At 03:48Z A5 had no `users` row and 0 rows in every user table, and A6 still held `catalog_maintainer` with `granted_by` NULL (`a-adm-06e-db-output.txt`). Through the API at 03:54:43Z: A6's grant `catalog_maintainer`, `"grantedBy": null`; A5's grants **404** `not_found`, "No account has this ID"; A6's ZZADM06 **201** and its `DELETE` **204** (`a-adm-06e-after-output.txt`). Nobody signed in as A5 after its deletion request. |
| ADM-06f | passed | A6's deletion **202** at 03:54:42Z (server time; `a-adm-06f-before-output.txt`). The bot's queries at 03:56Z, after the deletion request: shared counts programs 10, curriculums 11, groups 133, courses 249, links 1823; A6 with 1 `global_admin_grants` row, 1 `onboarding_answers` row and 4 `sessions` rows. It set A6's `purge_after` to 03:55:07Z. At 04:46Z A6 had no `users` row and 0 rows in every user table, `global_admin_grants` included, and the shared counts were unchanged (`a-adm-06f-db-output.txt`). Through the API at 04:52:12Z: A6's grants **404** `not_found`; A4 listed all 10 programs, APCS and CNTT-TCTA-KHMT among them; BAA00104 **200** with 11 memberships (`a-adm-06f-after-output.txt`). Nobody signed in as A6 after its deletion request. |

The case runs the shared-data query before A6's deletion request. The bot ran it just after, at 03:56Z. That gives the same counts: a deletion request only marks the account (`deletion_requested_at`, `purge_after`), and nothing shared changes until the purge, as in TRN-02f.

All 13 cases passed: ADM-01a–c, ADM-05a–d and ADM-06a–f. No defect was found. Two things seen on the way, neither of them a failure:

- The message of `validation_failed` is a string for a bad course code (`"code: \"cs-1\" is not a course code …"`) and an array for a DTO rule (`["credits must not be less than 1"]`). The cases say "contains", and a client branches on `code`, not on the message (`admin-errors.ts`).
- The `impact_confirmation_required` message says "ZZADM05 is shared" even when one curriculum links the course (05b's first `PATCH`). The list holds that one curriculum, as the case expects.

## State after the run

BAA00104 has its original English name, "History of Vietnamese Communist Party". ZZADM05 and ZZADM06 are deleted, and ZZADM05's links are removed. CS420's offering terms in APCS 2024 are `null`. S6 holds T-A and has no plan. A1–A4 hold the grants of §1, and A4 is still the only active access manager. A5 and A6 are deleted and purged; a rerun of ADM-06 signs them up again. `a-adm-06-ids.json` holds their old IDs, which the next `06a` and `06c` overwrite.
