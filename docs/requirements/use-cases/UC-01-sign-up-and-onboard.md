# UC-01: Sign up and onboard

- Feature: F1 Account and onboarding (Vision §5)
- Owner: Lâm
- Status: draft for the use-case model (PA2)
- Built so far: email and password sign-up and sign-in, sessions (#8, [ADR 0002](../../analysis-and-design/adr/0002-authentication-and-sessions.md)); restore on sign-in (#14, [ADR 0004](../../analysis-and-design/adr/0004-account-export-and-deletion.md))

## 1. Brief description

A student creates an OmniCourse account, signs in, and tells OmniCourse which program and cohort they follow and what they want from a plan. Every other use case for a student starts after this one: the degree audit needs the program and cohort, and the planner starts from the student's planning goal.

## 2. Actors

- **Student** (primary): an HCMUS undergraduate, APCS in the first release.
- **Google** (secondary, alternative flow A4 only): confirms the student's Google identity.

## 3. Preconditions

- The student is not signed in.
- At least one program and cohort exist in the curriculum data (F12, Thắng).

## 4. Basic flow

1. The student opens OmniCourse and chooses **Sign up**.
2. The system asks for an email, a password, a display name, and consent to the terms and the privacy notice. It links the privacy notice, which states what is stored, the retention period, and how to export or delete the account.
3. The student fills in the form, ticks consent, and submits.
4. The system checks the input: a valid email, a password of 10 to 128 characters, a display name of at most 100 characters, and consent given.
5. The system creates the account, stores the password only as an argon2id hash, records the time of consent, and signs the student in on this device.
6. The system starts onboarding and asks for the student's **faculty**, **program** and **cohort**, offering only the ones that exist in the curriculum data.
7. The student chooses them.
8. The system asks for the student's default **planning goal**. Every field is optional and can be changed later:
   - target graduation term;
   - credits per term;
   - internship term, or none planned.
9. The student fills in what they know and presses **Finish**.
10. The system saves the onboarding answers and opens the degree audit (UC-03).

## 5. Alternative flows

**A1. Email already registered.** At step 5 the email belongs to an existing account. The system says the email is already registered and offers **Sign in** instead. No account is created.

**A2. Invalid input.** At step 4 a field fails its check. The system marks each failing field with what is wrong. Nothing is stored. The flow resumes at step 3.

**A3. Too many attempts.** At step 3, if one network address sends more than 10 sign-up or sign-in requests in a minute, the system refuses further attempts for the rest of the minute and says so. The flow resumes at step 3 once the minute has passed.

**A4. Sign up with Google** (not built: needs Google Cloud credentials, ADR 0002 "Deferred").
1. At step 1 the student chooses **Continue with Google**.
2. Google confirms the student's identity and verified email.
3. The system asks for consent as in step 2, then creates the account with no password.
4. The flow resumes at step 6.

If the Google email already belongs to an account, the system signs into that account instead of creating a second one.

**A5. Existing student signs in.**
1. At step 1 the student chooses **Sign in** and gives their email and password.
2. The system signs the student in on this device.
3. If onboarding is not finished, the flow resumes at step 6. Otherwise the system opens the degree audit.

If the email is unknown or the password is wrong, the system says only that the email or password is invalid. It does not reveal which, and the response time is the same in both cases.

**A6. Signing in cancels a pending deletion.** At A5 step 2 the account was scheduled for deletion less than 30 days ago (privacy NFR, ADR 0004). The system cancels the deletion, signs the student in, and tells them their account has been restored.

**A7. Program not offered yet.** At step 7 the student's program or cohort is not in the list. The system explains that only the listed programs are supported in this release. The student can leave onboarding unfinished. Guides (UC-10) work without a program; the degree audit and the planner wait until onboarding is finished.

**A8. Onboarding interrupted.** The student closes the app between steps 6 and 9. The account stays signed in. The answers already saved are kept, and onboarding resumes at the first unanswered step on the next visit.

**A9. Change onboarding answers later.** A signed-in student opens account settings and changes the program, cohort or default planning goal. The system saves the change. Existing plans keep the curriculum version they were made with (Data NFR); the degree audit follows the new choice.

## 6. Postconditions

- **Success:** an account exists with a consent time, the student is signed in on this device, and the program, cohort and default planning goal are stored.
- **Failure:** no account is created (A1, A2, A3), or the account exists with onboarding unfinished (A7, A8).

## 7. Special requirements

- **Security** (Vision §6): passwords hashed with argon2id; sessions rotate, expire after 7 days and can be revoked from any of the student's devices.
- **Privacy** (Vision §6, Luật 91/2025/QH15): consent is required and its time stored. No school-portal password is ever asked for (AGENTS.md hard rule 2).
- **Academic rules:** the credits-per-term value is the student's wish. The rule engine checks it against the program's credit cap when a plan is built; onboarding does not apply the cap itself (AGENTS.md hard rule 1).
- **Usability:** the forms work from 360 px wide, by keyboard, in Vietnamese and English.

## 8. Additional information

Account operations that belong to F1 but are not separate use cases. They are listed so the use-case model can place them:

| Operation | API (built) |
| --- | --- |
| Sign out on this device | `POST /api/auth/sign-out` |
| List and revoke my sessions | `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id` |
| Stay signed in (token rotation) | `POST /api/auth/refresh` |
| Export my whole account | `GET /api/users/me/export` (#14) |
| Delete my whole account (password again, 30-day grace) | `DELETE /api/users/me` (#14) |

Open:
- Sign-up with a verified HCMUS student email (Vision F1) needs a mail sender; not planned before B3.
- The onboarding API is not built. Program and cohort reference Triết's curriculum tables (due 28 Oct).
