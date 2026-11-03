// Transcribed from CTTT_Danh-sach-hoc-phan-tuong-duong.pdf (2 scanned pages):
// "Danh mục các học phần tương đương/thay thế đối với Chương trình tiên tiến
// ngành Khoa học máy tính" (Phụ lục 08), dated 1 August 2023.
//
// The seed script does not load this file and no table exists for it. It
// mirrors the printed table: each STT row has an old course (HP01), a course
// that may replace it (HP02) and, for some rows, a course or set that may
// replace HP02 (HP03). Names are as printed, including the PDF's spelling.

import type { EquivalenceCourse, EquivalenceList } from './seed-types.js';

const c = (code_printed: string, name: string, credits: number, code: string | null = code_printed): EquivalenceCourse => ({
  code,
  code_printed,
  name,
  credits,
});

const DOTTED_CODE =
  'The printed code contains a dot, which neither the normalisation rule (trim, upper-case, strip spaces and ' +
  'dashes) nor the courses.code CHECK allows; code left null until someone decides how dotted legacy codes map.';

const MARX_SET =
  'HP03 lists three courses (BAA00101, BAA00102, BAA00103) in one cell; the PDF does not say whether all three ' +
  'together replace HP02 or each one does.';

const marxSet = [
  c('BAA00101', 'Triết học Mác - Lênin', 3),
  c('BAA00102', 'Kinh tế chính trị Mác - Lênin', 2),
  c('BAA00103', 'Chủ nghĩa xã hội khoa học', 2),
];

export const apcsEquivalences: EquivalenceList = {
  source: { file: 'CTTT_Danh-sach-hoc-phan-tuong-duong.pdf', pages: 2 },
  title: 'Danh mục các học phần tương đương/thay thế đối với Chương trình tiên tiến ngành Khoa học máy tính',
  issued: '2023-08-01',
  program_code: 'APCS',
  cohort_scope: null,
  note: 'Nếu học phần HP02 tương đương với học phần HP01 và học phần HP03 tương đương với HP02 thì HP03 cũng tương đương với HP01.',
  rows: [
    {
      stt: [1],
      page: 1,
      hp01: [c('CTH001', 'Những nguyên lý cơ bản của chủ nghĩa Mác – Lênin', 5)],
      hp02: [c('BAA00001', 'Những nguyên lý cơ bản của chủ nghĩa Mác – Lênin', 5)],
      hp03: marxSet,
      needs_check: MARX_SET,
    },
    {
      stt: [2],
      page: 1,
      hp01: [c('CTH001.2', 'Những nguyên lý cơ bản của chủ nghĩa Mác – LeNin', 4, null)],
      hp02: [c('BAA00001', 'Những nguyên lý cơ bản của chủ nghĩa Mác – Lênin', 5)],
      hp03: marxSet,
      needs_check: `${DOTTED_CODE} ${MARX_SET}`,
    },
    {
      stt: [3],
      page: 1,
      hp01: [c('CTH002', 'Đường lối cách mạng của Đảng Cộng sản Việt Nam', 3)],
      hp02: [c('BAA00002', 'Đường lối cách mạng của Đảng Cộng sản Việt Nam', 3)],
      hp03: [c('BAA00104', 'Lịch sử Đảng Cộng sản Việt Nam', 2)],
    },
    {
      stt: [4],
      page: 1,
      hp01: [c('CTH002.2', 'Đường lối cách mạng của Đảng Cộng sản Việt Nam', 4, null)],
      hp02: [c('BAA00002', 'Đường lối cách mạng của Đảng Cộng sản Việt Nam', 3)],
      hp03: [c('BAA00104', 'Lịch sử Đảng Cộng sản Việt Nam', 2)],
      needs_check: DOTTED_CODE,
    },
    {
      stt: [5],
      page: 1,
      hp01: [c('CTH003', 'Tư tưởng Hồ Chí Minh', 2)],
      hp02: [c('BAA00003', 'Tư tưởng Hồ Chí Minh', 2)],
      hp03: [],
    },
    {
      stt: [6],
      page: 1,
      hp01: [c('PLD001', 'Pháp luật đại cương', 3)],
      hp02: [c('BAA00004', 'Pháp luật đại cương', 3)],
      hp03: [],
    },
    {
      stt: [7],
      page: 1,
      hp01: [c('TC001.2', 'Giáo dục thể chất 1', 2, null)],
      hp02: [c('BAA00021', 'Thể dục 1', 2)],
      hp03: [],
      needs_check: DOTTED_CODE,
    },
    {
      stt: [8],
      page: 1,
      hp01: [c('TC002.2', 'Giáo dục thể chất 2', 2, null)],
      hp02: [c('BAA00022', 'Thể dục 2', 2)],
      hp03: [],
      needs_check: DOTTED_CODE,
    },
    {
      stt: [9],
      page: 1,
      hp01: [c('TC001.21', 'Giáo dục thể chất (Khiêu vũ)', 3, null)],
      hp02: [c('BAA00021', 'Thể dục 1', 2)],
      hp03: [],
      needs_check: DOTTED_CODE,
    },
    {
      stt: [10],
      page: 1,
      hp01: [c('QPH010', 'Giáo dục quốc phòng', 4)],
      hp02: [c('BAA00030', 'Giáo dục quốc phòng - An ninh', 4)],
      hp03: [],
    },
    {
      stt: [11],
      page: 1,
      hp01: [c('CS321', 'Languages and Compiler Design I', 4)],
      hp02: [c('CS320', 'Principles of Programming Languages', 4)],
      hp03: [],
    },
    {
      stt: [12],
      page: 1,
      hp01: [c('CS322', 'Languages and Compiler Design II', 4)],
      hp02: [c('CS320', 'Principles of Programming Languages', 4)],
      hp03: [],
    },
    {
      stt: [13],
      page: 1,
      hp01: [c('CS321', 'Languages and Compiler Design I', 4)],
      hp02: [c('CS420', 'Artificial Intelligence', 4)],
      hp03: [],
    },
    {
      stt: [14],
      page: 2,
      hp01: [c('CS322', 'Languages and Compiler Design II', 4)],
      hp02: [c('CS420', 'Artificial Intelligence', 4)],
      hp03: [],
    },
    {
      stt: [15, 16, 17, 18],
      page: 2,
      hp01: [
        c('CS321', 'Languages and Compiler Design I', 4),
        c('CS322', 'Languages and Compiler Design II', 4),
        c('CS420', 'Artificial Intelligence', 4),
        c('CS320', 'Principles of Programming Languages', 4),
      ],
      hp02: [],
      hp03: [],
      printed_rule:
        'CS321 + CS322 = CS320 + CS420 (nếu sinh viên thiếu cả hai môn CS321 lẫn CS322 thì cần học cả hai môn CS320 và CS420 để thay thế)',
      needs_check:
        'Rows 15-18 share one merged HP02 cell holding the rule. Rows 17-18 print CS420 and CS320 under "Học phần cũ ' +
        'đã giảng dạy" although the rule makes them the replacements; read as one rule: {CS321, CS322} = {CS320, CS420}.',
    },
    {
      stt: [19],
      page: 2,
      hp01: [c('CS386', 'Introduction to Database Systems', 4)],
      hp02: [c('CS486', 'Introduction to Database Systems', 4)],
      hp03: [],
    },
    {
      stt: [20],
      page: 2,
      hp01: [c('CS429', 'Mining on Big Data', 4)],
      hp02: [c('CS435', 'Introduction to Big Data Analytics', 4)],
      hp03: [],
    },
  ],
};
