import type { NoPrerequisitesDecision, PrintedPrerequisite, PrintedPrerequisiteList } from './seed-types.js';

/**
 * APCS courses have no prerequisite, except one. The Project Lead decided "no prerequisite" on
 * 15 November 2026. The exception, CS469 before CS470, is printed in the curriculum PDFs. The seed has
 * recorded it since 21 November 2026 (#111), and the Project Lead decided it on 24 November 2026. The seeds
 * of APCS 2024 and APCS 2025 carry the decision, and `db:seed` records every course of both curricula as
 * "no prerequisite", except CS470, which needs CS469 (ADR 0011, amendment of 15 November 2026). Offering
 * terms stay not recorded.
 */
export const apcsNoPrerequisites: NoPrerequisitesDecision = {
  decided_by: 'Project Lead (Lâm)',
  date: '2026-11-15',
  source:
    'Stated by the Project Lead on the team Discord on 15 November 2026: "apcs have no prerequisite". ' +
    'One printed rule is kept: none, except CS469 before CS470, printed in the note under 7.3 ' +
    '"Kiến thức tốt nghiệp" of the APCS 2024 and 2025 curriculum PDFs (p. 8 of APCS 2024, p. 9 of APCS 2025). ' +
    'Thắng found the rule on 17 November 2026, in the review of #111. The seed has recorded it since ' +
    '21 November 2026: asked to choose, the Project Lead left the choice open, and the AI agent that works ' +
    'in his name chose to record it. On 24 November 2026 Thắng confirmed the printed rule, and the Project ' +
    'Lead decided it on the team Discord: "trust Thang". The PDFs print no prerequisite column, and the ' +
    '"Prior-course" lines of the 2021 course-description booklet below are not rules.',
  except: [
    {
      code: 'CS470',
      requires: ['CS469'],
      // Rule (iii) of the note, as printed. (i) and (ii) of the same note are counting rules, not prerequisites,
      // and are not loaded.
      printed: 'Nếu sinh viên không hoàn thành CS469 sẽ không được tiếp tục thực hiện CS470.',
      pages: { APCS2024: 8, APCS2025: 9 },
      // In the seed since 21 November 2026 (#111), by the choice of the AI agent that works in the Project
      // Lead's name. The decision is the Project Lead's, of 24 November 2026 (ADR 0011).
      decided_by: 'Project Lead (Lâm)',
      date: '2026-11-24',
    },
  ],
};

// The "Prior-course" lines of APCS_Program_Descriptions.pdf (course
// descriptions of the APCS program, March 2021, 129 pages with a text layer).
// Not loaded, and not rules: the Project Lead decided that APCS courses have no
// prerequisite except CS469 before CS470 (apcsNoPrerequisites above). The lines stay
// here as printed text, which the advisor's course descriptions spec checks.
//
// None of the seven curriculum PDFs shared on 9 November 2026 prints offering
// terms, and the curricula (CTĐT) of APCS 2021-2025 and CLC 2024 have no
// prerequisite column; their "Học kỳ n" is a suggested study term. Besides this
// booklet, the one prerequisite-like text is the note under 7.3 of the APCS 2024
// and 2025 curricula: CS469 before CS470 (apcsNoPrerequisites.except).
//
// advisor/course-descriptions/course-descriptions.spec.ts checks every
// `printed` line against the PDF's text; apcs-prerequisites.spec.ts checks `resolved` and `unresolved`.

/** line(course, printed line, resolved codes, unresolved parts, page) */
const line = (code: string, printed: string, resolved: string[], unresolved: string[], page: number): PrintedPrerequisite => ({
  code,
  printed,
  resolved,
  unresolved,
  page,
});

export const apcsPrerequisites: PrintedPrerequisiteList = {
  source: {
    file: 'APCS_Program_Descriptions.pdf',
    pages: 129,
    sha256: '6558752d046fd2f3d57ddde178fa53b0a786529daf30f22a49b5b419227bd4fb',
    issued: 'Ho Chi Minh City – March 2021',
  },
  field: 'Prior-course',
  note:
    'Each course description prints a "Prior-course" line under "General information". The booklet ' +
    'does not say whether it means a prerequisite (học phần tiên quyết: must be passed), a prior ' +
    'course (học phần học trước: must have been taken) or advice, and many lines name topics, not ' +
    'courses. The codes are the 2021 ones (CS161, CS162, CM101); the 2024/2025 curricula use CS160 ' +
    'and CM102. Decided by the Project Lead on 15 November 2026: APCS courses have no prerequisite ' +
    '(except CS469 before CS470, printed in the curriculum PDFs and decided on 24 November 2026), so ' +
    'these printed lines are not rules and are not loaded.',
  lines: [
    line('CS162', 'Introduction to Computer Science I', ['CS161'], [], 6),
    line('CS163', 'Introduction to Computer Science II', ['CS162'], [], 8),
    line('CS201', 'Introduction to Computer Science I, Introduction to Computer Science II', ['CS161', 'CS162'], [], 10),
    line('CS202', 'Introduction to Computer Science II', ['CS162'], [], 12),
    line('CS300', 'Basic application programming skills', [], ['Basic application programming skills'], 16),
    line('CS333', 'Computer Systems', [], ['Computer Systems'], 20),
    line('CS486', 'Discrete Mathematics', [], ['Discrete Mathematics'], 22),
    line('ECE341', 'System Programming', [], ['System Programming'], 24),
    line('CS251', 'Discrete Structures', [], ['Discrete Structures'], 26),
    line('CS311', 'Discrete Structures I Data Structures', [], ['Discrete Structures I Data Structures'], 28),
    line('CS320', 'CS 202 Programming Systems Object-oriented programming, practical data structures, Java, CS 251 Data Structures II Mathematical logic and proofs, CS 311 Computational Structures Formal languages and grammars, automata and Turing machines', [], ['CS 202 Programming Systems Object-oriented programming', 'practical data structures', 'Java', 'CS 251 Data Structures II Mathematical logic and proofs', 'CS 311 Computational Structures Formal languages and grammars', 'automata and Turing machines'], 30),
    line('CS350', 'Calculus I', ['MTH251'], [], 32),
    line('CS420', 'Data Structures and Algorithms', [], ['Data Structures and Algorithms'], 35),
    line('WR227', 'Scientific Research Methodologies', [], ['Scientific Research Methodologies'], 41),
    line('MTH252', 'Mth 251, Calculus I', ['MTH251'], [], 45),
    line('MTH261', 'Calculus I & II', [], ['Calculus I & II'], 47),
    line('STAT451', 'Discrete Structures I, Logical Structures', ['CS250', 'CS251'], [], 50),
    line('PH211', 'Algebra and trigonometry at a high school level None', [], ['Algebra and trigonometry at a high school level None'], 52),
    line('PH212', 'General Physics I Calculus I', [], ['General Physics I Calculus I'], 54),
    line('PH213', 'General Physics I, II, Calculus I, II', ['PH211', 'MTH251'], ['II', 'II'], 56),
    line('MTH253', 'Calculus 1, Calculus 2', [], ['Calculus 1', 'Calculus 2'], 58),
    line('MTH344', 'Discrete Mathematics', [], ['Discrete Mathematics'], 60),
    line('MTH346', 'Basic calculus, Programming, Algorithms and Data structures, Algorithms Analysis', [], ['Basic calculus', 'Programming', 'Algorithms and Data structures', 'Algorithms Analysis'], 63),
    line('STAT452', 'Applied Statistics for Engineers and Scientists I', ['STAT451'], [], 65),
    line('CS416', 'Software engineering class, database class', [], ['Software engineering class', 'database class'], 73),
    line('CS419', 'Introduction to programming language, Data Structure, Calculus, Linear Algebra', [], ['Introduction to programming language', 'Data Structure', 'Calculus', 'Linear Algebra'], 80),
    line('CS421', 'Introduction to Software Engineering', [], ['Introduction to Software Engineering'], 82),
    line('CS423', 'OOP, Database, Software Engineering, Web Application Development', ['CS424'], ['OOP', 'Database', 'Software Engineering'], 87),
    line('CS424', 'Introduction to Computer Science, Introduction to Databases, Elements of Software Engineering', ['CS300'], ['Introduction to Computer Science', 'Introduction to Databases'], 90),
    line('CS426', 'Programming Systems', ['CS202'], [], 92),
    line('CS427', 'Programming Systems', ['CS202'], [], 94),
    line('CS429', 'Data mining, Machine learning', [], ['Data mining', 'Machine learning'], 99),
    line('CS433', 'Computer networks', [], ['Computer networks'], 107),
    line('CS434', 'Programming Systems', ['CS202'], [], 109),
    line('CS494', 'Introduction to Programming (C, C++, Java) or equivalent', [], ['Introduction to Programming (C', 'C++', 'Java) or equivalent'], 111),
    line('CS404', 'CM101, CS202, CS300, CS486, SC203, WR227', ['CM101', 'CS202', 'CS300', 'CS486', 'SC203', 'WR227'], [], 113),
    line('CS407', 'Scientific Methods', [], ['Scientific Methods'], 117),
    line('CS409', 'Social, Ethical, and Legal Issues', ['CS305'], [], 121),
    line('CS469', 'Any programming-intensive CS elective, CS350, CS320, CS333, CS300', ['CS350', 'CS320', 'CS333', 'CS300'], ['Any programming-intensive CS elective'], 124),
    line('CS470', 'Capstone Project I, Any programming-intensive CS elective, CS350, CS320, CS333, CS300', ['CS469', 'CS350', 'CS320', 'CS333', 'CS300'], ['Any programming-intensive CS elective'], 126),
    line('CS386', 'Discrete Mathematics', [], ['Discrete Mathematics'], 128),
  ],
  blank: [
    { code: 'CS161', page: 4 },
    { code: 'CS250', page: 14 },
    { code: 'CS305', page: 18 },
    { code: 'CM101', page: 37 },
    { code: 'SC203', page: 39 },
    { code: 'MTH251', page: 43 },
    { code: 'CS411', page: 67 },
    { code: 'CS412', page: 69 },
    { code: 'CS415', page: 71 },
    { code: 'CS417', page: 76 },
    { code: 'CS418', page: 78 },
    { code: 'CS422', page: 84 },
    { code: 'CS428', page: 97 },
    { code: 'CS430', page: 101 },
    { code: 'CS431', page: 103 },
    { code: 'CS432', page: 105 },
    { code: 'CS405', page: 115 },
    { code: 'CS408', page: 119 },
  ],
  offering_terms: [],
};
