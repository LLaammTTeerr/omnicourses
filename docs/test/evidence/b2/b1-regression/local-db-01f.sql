\set ON_ERROR_ROLLBACK on
BEGIN;
-- Valid rows: each must succeed, so the refusals below are not the schema refusing everything.
INSERT INTO programs (code, name_vi) VALUES ('ZZTEST', 'ZZ test program') RETURNING id \gset prog_
INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES (:'prog_id', 2024, 'ZZTEST2024', 'ZZ test 2024') RETURNING id \gset cur_
INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES (:'cur_id', 'ZZ group', 'compulsory') RETURNING id \gset grp_
INSERT INTO courses (code, name_vi, credits) VALUES ('ZZ001', 'ZZ test course', 3);
INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES (:'grp_id', 'ZZ001');
-- 1. The same program and cohort twice
INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES (:'prog_id', 2024, 'ZZTEST2024B', 'ZZ test 2024 again');
-- 2. A course code that breaks ^[A-Z0-9]{2,20}$
INSERT INTO courses (code, name_vi, credits) VALUES ('zz-1', 'ZZ bad code', 3);
-- 3. A group link with that code
INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES (:'grp_id', 'zz-1');
-- 4. Two groups with the same name in one curriculum
INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES (:'cur_id', 'ZZ group', 'elective');
-- 5. A kind other than compulsory or elective
INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES (:'cur_id', 'ZZ other group', 'optional');
-- 6. A cohort year outside 2000-2100
INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES (:'prog_id', 1999, 'ZZTEST1999', 'ZZ test 1999');
-- 7. A course with 0 credits
INSERT INTO courses (code, name_vi, credits) VALUES ('ZZ002', 'ZZ no credits', 0);
ROLLBACK;
SELECT count(*) AS zztest_programs_left FROM programs WHERE code = 'ZZTEST';
