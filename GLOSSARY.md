# OmniCourse

Academic planning for HCMUS undergraduates on the credit system, APCS first: what a student has met, what remains, and a valid plan of courses through to graduation.

## Language

### Curriculum

**Faculty**:
The HCMUS unit that owns one or more programs.
_Avoid_: department, school

**Program**:
An undergraduate degree, such as APCS, with its own curriculum per cohort.
_Avoid_: major, degree

**Specialization**:
A path inside a program with its own requirement groups, chosen by the student.
_Avoid_: concentration, track, major

**Cohort**:
The students who entered a program in the same year; each cohort follows its own version of the curriculum.
_Avoid_: batch, intake, class, khóa

**Curriculum**:
The courses and requirement groups a cohort of a program must satisfy to graduate.
_Avoid_: syllabus, degree plan, program structure, CTĐT

**Course**:
A unit of study identified by a course code and worth a fixed number of credits.
_Avoid_: subject, class, module

**Credit**:
The unit of a course's weight under the national credit regulation (Thông tư 08/2021/TT-BGDĐT).
_Avoid_: unit, hour

**Requirement group**:
A named set of courses in a curriculum with a rule for how much of it counts toward graduation.
_Avoid_: category, block, knowledge block, khối kiến thức

**Compulsory course**:
A course every student of the cohort must pass.
_Avoid_: required course, mandatory course, core course

**Elective group**:
A requirement group the student fills by choosing among its courses up to a credit minimum.
_Avoid_: electives pool, optional courses

**Prerequisite**:
A course that must be passed before another course may be taken.
_Avoid_: requirement, dependency, pre-req

**Offering term**:
A kind of term in which a course is taught.
_Avoid_: availability, schedule

**Regulation**:
An official HCMUS or national document that states academic rules, cited clause by clause.
_Avoid_: policy, rules, quy chế (in English text)

### Student record

**Transcript**:
A student's record of the courses they have taken, with grade, credits and term for each.
_Avoid_: grade report, results, bảng điểm

**Transcript import**:
Turning an uploaded transcript file into transcript rows that the student reviews before they count.
_Avoid_: OCR, scan, upload

**Graduation status**:
Which requirements of the curriculum a student has met and which remain.
_Avoid_: progress, eligibility

**Degree audit**:
The computation of a student's graduation status from their transcript against their curriculum.
_Avoid_: audit check, graduation check, degree check

### Planning

**Term**:
An academic period in which courses are taken: a main term or a summer term.
_Avoid_: semester, session, học kỳ

**Credit cap**:
The minimum and maximum credits a student may take in one term, published per program.
_Avoid_: credit limit, load limit, max credits

**Plan**:
A student's placement of courses into terms from now until graduation; a student may keep several.
_Avoid_: roadmap, schedule, timetable

**Target graduation term**:
The term in which the student intends to graduate, set by the student.
_Avoid_: expected graduation, deadline

**Estimated graduation term**:
The earliest term in which a plan meets the whole curriculum, as computed by the rule engine.
_Avoid_: projected graduation, ETA

**Violation**:
An academic rule a plan breaks: a prerequisite not met, a credit cap exceeded, a course placed outside its offering terms, or a requirement left uncovered.
_Avoid_: error, conflict, warning

**What-if scenario**:
A hypothetical change (a failed course, another specialization, an added summer term, a heavier load) applied to a copy of a plan to see its effect on the estimated graduation term.
_Avoid_: simulation, sandbox

**Rule engine**:
The deterministic authority on every academic rule; AI features call it and explain its results, never replace them.
_Avoid_: validator, checker, solver

### People

**User**:
A person with an OmniCourse account; student, program administrator and advisor are the roles a user plays.
_Avoid_: member, account holder

**Student**:
A user who owns a transcript and plans their own terms.
_Avoid_: learner

**Program administrator**:
A user who maintains the curriculum data of one or more programs.
_Avoid_: admin, staff, editor

**Advisor**:
A lecturer or academic advisor who reads a student's shared plan.
_Avoid_: mentor, counsellor, reviewer

**Shared plan**:
A read-only link to one plan that a student gives to someone else.
_Avoid_: public plan, export

### School integration

**Portal**:
An HCMUS website where a student performs a school task (registration, grades, tuition); OmniCourse only links to it.
_Avoid_: school system, student portal account

**Guide**:
The direct link, steps, required account and notes for one school task OmniCourse does not perform; versioned.
_Avoid_: quicklink, tutorial, how-to
