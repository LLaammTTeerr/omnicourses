# Guides plan: content model and school tasks

- Feature: F11 Quicklinks and step-by-step guides (Vision §5); use case UC-10 (`docs/requirements/use-cases/UC-10-follow-a-school-task-guide.md`)
- Owner: Dũng
- Status: draft, 30 October 2026. The B1 batch, public reading and file storage were agreed by Lâm on 30 October. No portal address, account or step below has been checked on a portal yet.
- Due: this list and the content model by 1 Nov (week 4 report); the first batch of guides in B1 (15 Nov)

## 1. Purpose

This plan says which school tasks get a guide, in what order, and what every guide contains. UC-10 says how a student finds and follows one.

A guide covers one school task that OmniCourse does not perform: the direct link, the steps, the account needed and the notes (glossary **Guide**). OmniCourse only links to the portal. It never asks for a portal password and never acts on a portal (AGENTS.md hard rule 2). Anyone can read a guide without an account (ADR 0010).

## 2. What every guide contains

| Field | What it holds | Required |
| --- | --- | --- |
| ID | A stable short name, such as `register-courses`. It never changes, so links to the guide keep working. | Yes |
| Title | The task, in Vietnamese and English. | Yes |
| Group | One of: Accounts and portals, Registration, Timetable and exams, Tuition and fees, Records and certificates, Scholarships, Internship and thesis, Graduation. | Yes |
| Keywords | Words a student might search for, in both languages, such as "đăng ký học phần", "dkhp", "register". Search ignores diacritics. | Yes |
| Summary | What the task is for and who needs to do it, in one or two sentences. | Yes |
| When | When the task is done (each term, once, before graduation), with a link to the school's announcement for the dates. Dates that change every term are not typed in. | Yes |
| Applies to | All programs, or the programs and cohorts listed. | Yes |
| Portal | The portal's name, the direct link (a deep link where the school allows one) and the account it needs. For a task done at an office: the office, its location and its published hours. | Yes |
| Prepare | Documents, fees and earlier steps needed before starting, with links into OmniCourse where they help. | No |
| Steps | Numbered steps. Each quotes the portal's labels as they appear on screen, and may have a screenshot and a link. | Yes |
| Notes | What commonly goes wrong and what to do. Each note says where it comes from: a regulation clause, or the team's experience. | No |
| Rule values | Named values that OmniCourse fills in from the rule engine for the student's program, such as the credit cap. Never typed into the text. From B3 (UC-10 A3); until then the guide says the value depends on the program and cites the clause. | No |
| Citations | The regulation documents and clauses the guide relies on. B1 guides link the official document and clause directly. They switch to the regulation files of the advisor chat (UC-08) once those exist in B3. | No |
| If the portal is down | Another way to do the task, only when the school publishes one. | No |
| Related | Other guides and OmniCourse features, such as the planner or the transcript import. | No |
| Version | A number that goes up by one with every published change. | Yes |
| Change note | What changed in this version. | Yes |
| Last checked | The date a team member last followed the guide on the real portal, and who did. | Yes |
| Status | Draft, published or withdrawn. Only published guides are shown. | Yes |

Storage (ADR 0010): one content file per guide and language in the repository, reviewed in a pull request and loaded into the database by a seed. Git keeps every version. There is no admin screen.

## 3. Rules for writing a guide

1. **Check it on the portal first.** Follow every step on the real portal with your own account before publishing, and record the date and your name as **Last checked**.
2. **Quote the portal exactly.** Use the button and menu labels as the portal shows them, usually in Vietnamese. The English version gives the Vietnamese label and its meaning.
3. **No academic rule values in the text.** Use a rule value or cite the clause (AGENTS.md hard rule 1). Write "you may register up to the credit cap for your program", never a number.
4. **No dates that change every term.** Link the school's announcement instead.
5. **No personal data.** Screenshots use a synthetic account or hide every name, student ID and grade (AGENTS.md hard rule 3).
6. **Nothing that automates a portal.** No scripts, bookmarklets or browser extensions, and never a step that sends a portal password anywhere but the portal (AGENTS.md hard rule 2).
7. **Every change is a new version**, with a change note and a new last-checked date. A guide that no longer matches the portal is a bug (Vision F11).

## 4. School tasks to cover

**B1 batch** (first, by 15 Nov, agreed by Lâm): the tasks every student meets every term, plus the transcript download that UC-02 needs. **B3**: the rest. **Later**: only if time allows.

| ID | Guide | Vietnamese name | Group | Batch | Why it is needed |
| --- | --- | --- | --- | --- | --- |
| G01 | Your school accounts and portals | Tài khoản và cổng thông tin | Accounts and portals | B1 | The link board: every other guide sends the student to one of these sites. |
| G02 | Register for courses | Đăng ký học phần | Registration | B1 | Every student, every term. Pain peaks in the registration window (Vision). |
| G03 | Change or cancel a course registration | Điều chỉnh, hủy đăng ký học phần | Registration | B3 | Follows G02 when a section is full or a plan changes. |
| G04 | Retake or improve a course | Học lại, học cải thiện | Registration | B3 | Vision F11 note: a failed course must be registered again. |
| G05 | Find your timetable and exam schedule | Thời khóa biểu, lịch thi | Timetable and exams | B3 | Every student, every term. |
| G06 | Pay tuition | Đóng học phí | Tuition and fees | B1 | Every student, every term (Vision F11). |
| G07 | View your grades and download your transcript PDF | Xem điểm, tải bảng điểm | Records and certificates | B1 | Transcript import (UC-02) needs this exact file. |
| G08 | Request an official transcript | Xin bảng điểm có xác nhận | Records and certificates | B3 | Vision F11: "requesting a transcript". |
| G09 | Request a student certificate | Xin giấy xác nhận sinh viên | Records and certificates | B3 | Vision F11: "requesting a certificate". |
| G10 | Apply for a scholarship | Đăng ký học bổng | Scholarships | B3 | Vision F11: "applying for a scholarship". |
| G11 | Register for an internship | Đăng ký thực tập | Internship and thesis | B3 | Part of the planning goal (UC-01, UC-07). |
| G12 | Register your thesis | Đăng ký khóa luận tốt nghiệp | Internship and thesis | B3 | Vision F11: "registering the thesis". |
| G13 | Submit a foreign-language certificate | Nộp chứng chỉ ngoại ngữ | Graduation | B3 | The degree audit flags a missing English certificate (Vision F3). |
| G14 | Apply for graduation | Đăng ký xét tốt nghiệp | Graduation | B3 | The last step after the degree audit shows every requirement met. |
| G15 | Take a leave of study | Bảo lưu, tạm dừng học tập | Registration | Later | Needed by few students. |
| G16 | Ask for a course exemption or credit transfer | Miễn, công nhận học phần | Records and certificates | Later | For students with courses from another program or school. |

## 5. What each guide shows

"To find out" lists what the writer must check on the portal or with the school before the guide is published. Every guide also has the fields of section 2.

### G01 Your school accounts and portals (B1)

- **Shows:** a board of every portal the other guides use. Each entry gives what the site is for, its direct link and which account signs in to it.
- How to get each account at the start of the course, and where the school resets its password. OmniCourse never asks for it.
- **Notes:** never share a portal password, including with OmniCourse. OmniCourse is unofficial and only links.
- **To find out:** the full list of sites APCS students use (registration and grades portal, student email, Moodle, faculty site), their addresses, and which sites share a sign-in.

### G02 Register for courses (B1)

- **When:** each main term and the summer term, in the window the school announces (link).
- **Prepare:**
  - from B3: the courses the student's plan places in the next term, ready to copy (UC-10 A4);
  - from B3: the credit cap for the student's program and term, from the rule engine (UC-10 A3). Until then the guide says the cap depends on the program and cites the clause.
- **Steps cover:** signing in, opening registration, finding a course by its code, choosing a class section, checking for timetable clashes, confirming, and checking the result after the window closes.
- **Notes:** what to do when a section is full; a failed course must be registered again, citing the clause that says when.
- **To find out:**
  - the address and deep link;
  - whether APCS students register through the same portal and in the same window as other programs;
  - whether the summer term works differently;
  - whether the school can cancel a registration after the window, and why.

### G03 Change or cancel a course registration (B3)

- **When:** the adjustment window after registration, if the school opens one (link).
- **Steps cover:** removing or swapping a course, confirming, checking the result.
- **Notes:** the effect on tuition (cited); the minimum credits per term, from the rule engine.
- **To find out:** whether an adjustment window exists for APCS, and the rules for cancelling after it.

### G04 Retake or improve a course (B3)

- **Shows:** how to register a course again (links G02), and the clause that says which attempt counts. The guide does not state it itself (AGENTS.md hard rule 1).
- **From OmniCourse:** the failed courses in the student's transcript; the planner places the retake (UC-05).
- **To find out:** whether a retake is registered like any other course; its tuition; whether improving a passed grade is allowed.

### G05 Find your timetable and exam schedule (B3)

- **Shows:** where the timetable and the exam schedule are published, how to read them (rooms, periods, exam codes) and what to bring to an exam.
- **Notes:** who to contact about two exams at the same time.
- **To find out:** where each is published (portal, Moodle or faculty site), how periods are numbered, and the exam-room rules.

### G06 Pay tuition (B1)

- **When:** each term, by the deadline in the school's announcement (link).
- **Steps cover:** where to see the amount owed, each payment channel the school accepts, and how to check that the payment arrived.
- **Notes:** keep the receipt; what happens after a late payment, cited from the regulation.
- **To find out:** where the amount is shown, the accepted channels, how long a payment takes to appear, and who to contact if it does not.

### G07 View your grades and download your transcript PDF (B1)

- **Shows:** where grades appear on the portal, and step by step which file to download, so the student gets the PDF that transcript import will read. For now it ends with a link to the student's transcript page in OmniCourse. A link to transcript import (UC-02) is added when import ships.
- **Notes:** the file holds personal data, so don't post it anywhere. When import ships, the guide adds that OmniCourse reads the file on its own server and deletes it after reading (UC-02).
- **To find out:** the exact download path. The same check answers ADR 0003's open question: whether the file has a text layer and a fixed layout, to be confirmed locally before Sprint 4.

### G08 Request an official transcript (B3)

- **Shows:** how it differs from the G07 PDF, where to request it (online or at an office), the form, the fee, the processing time and how to collect it.
- **To find out:** the office or online form, the fee and the processing time.

### G09 Request a student certificate (B3)

- **Shows:** what the certificate is used for, where to request it, what to fill in, the processing time and how to collect it.
- **To find out:** whether the request is online or at an office, and which purposes need a different form.

### G10 Apply for a scholarship (B3)

- **Shows:** the kinds of scholarship open to the student's program, where each is announced, the documents needed (links G08 for the transcript) and where to submit.
- **Notes:** the school decides eligibility. The guide cites the conditions; OmniCourse never computes whether a student qualifies.
- **To find out:** the kinds open to APCS students and where each is announced.

### G11 Register for an internship (B3)

- **When:** the term the curriculum sets, and the deadlines in the faculty's announcement (link).
- **Shows:** the conditions to start, cited or from the rule engine; how to find a company or the faculty's list; the forms and who signs them; what to hand in at the end.
- **From OmniCourse:** the internship term in the student's planning goal and where the plan places the internship course (UC-07).
- **To find out:** the APCS process, forms and contacts.

### G12 Register your thesis (B3)

- **Shows:** the conditions to start, from the rule engine or cited; choosing a supervisor and a topic; how and where to register; the deadlines (link).
- **From OmniCourse:** what remains to graduate, from the degree audit (UC-03).
- **To find out:** the APCS process, and whether the program offers another route to graduation instead of a thesis.

### G13 Submit a foreign-language certificate (B3)

- **Shows:** which certificates and scores the program accepts, cited from the regulation; where and how to submit one; how long until it is recorded.
- **From OmniCourse:** the degree audit's flag for a missing certificate (Vision F3).
- **To find out:** where to submit and how the record is updated.

### G14 Apply for graduation (B3)

- **When:** the graduation review rounds the school announces (link).
- **Shows:** what must be met first, with the student's graduation status from the degree audit (UC-03); how to apply; the documents and fees; how the diploma is collected.
- **To find out:** whether certificates beyond the curriculum are required (for example physical education or national defence education); the application process; the fees.

### G15 Take a leave of study (Later)

- **Shows:** who may take a leave, how to apply, how long it can last, how to return, and the effect on tuition. All conditions are cited.

### G16 Ask for a course exemption or credit transfer (Later)

- **Shows:** when an exemption or transfer is possible, the documents needed and where to apply. Whether a course counts toward the curriculum is decided by the school and recorded in the transcript; OmniCourse does not decide it (AGENTS.md hard rule 1).

## 6. How each guide is made

1. Dũng drafts the guide in both languages from the school's published pages, typed by hand with no AI drafting: the same rule as the regulation files (Lâm, 30 Oct 2026).
2. A team member who has used that portal follows it with their own account and records **Last checked**.
3. Another team member reviews the pull request.
4. The guide is published with version 1.
5. Before each main term's registration, every published guide is checked again. A guide not checked for more than 6 months shows the out-of-date warning (UC-10 A5).

## 7. Open

- **Missing tasks.** All five team members are students and the first users (Vision). Each is asked which school tasks cost them the most time, to find tasks this list misses.
- **APCS-only processes.** Which of these tasks APCS handles differently from other HCMUS programs.
