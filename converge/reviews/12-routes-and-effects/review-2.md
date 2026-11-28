# Review round 2: 12-routes-and-effects (cvb/12-routes-and-effects, c05b603..fb601d3)

Verdict: approve. Both round-1 blocking findings are fixed. The new commit fb601d3 changes only the two moved specs and class-model.md.

## Round-1 fixes
1. notifications/unread-polling.spec.ts sign-in case: Host now renders h(RouterView), so SignInView mounts at /sign-in?redirect=/guides. The case fills #sign-in-email and #sign-in-password, submits the form and flushes, then asserts path '/guides' and unreadReads() === 1. This matches the base App.spec.ts case line for line. Fixed.
2. admin/access-session.spec.ts retry case: Host renders AppSidebar next to useGrantsFollowSession(). It asserts [data-test="nav-admin"] absent, then href '/admin' after the next page, then no extra grant read. Same assertions as the base. Fixed.
3. Non-blocking from round 1, also done: class-model.md lists useUnreadPolling and useGrantsFollowSession. The spec imports MAX_FAILED_LOADS (already exported at base) instead of keeping its own copy.

## Non-blocking
- admin/access-session.spec.ts:66-67: the #160 case now asserts toBe(MAX_FAILED_LOADS) / toHaveLength(MAX_FAILED_LOADS) where base asserted the literal 3. On its own this would let a change of the constant through. But admin/access.spec.ts:167-180 still pins three failed loads with literals (retryable true after 1, false after 3, fetch called 3 times), so the value of the cap is still guarded. This was what round 1 suggested. Optional: go back to the literal 3, so the moved case is exactly the original.

## What I checked
- git log c05b603..HEAD: 4 commits, all signed G, Conventional subjects. Exactly one changeset (.changeset/12-routes-and-effects.md).
- git diff 0ea81cb..HEAD: only class-model.md, access-session.spec.ts and unread-polling.spec.ts. No route file changed, so the round-1 route proof still holds: base and 0ea81cb serialisations were byte-identical (myproof/base.json = head.json, base2.json = head2.json).
- No comments were added. No off-limits file was touched. No backend, openapi, migration or lockfile change.
- Targeted vitest (App.spec, admin/access-session, notifications/unread-polling, shell/): 10 files, 73 tests pass. Frontend typecheck exits 0. npm run lint exits 0.
- it( count: App.spec.ts 17 -> 12. access-session.spec.ts +3 (retry, signed out, #160). unread-polling.spec.ts +2 (polling, sign-in). Nothing lost. All five moved cases now keep their original assertions; the signed-out case gained one.
