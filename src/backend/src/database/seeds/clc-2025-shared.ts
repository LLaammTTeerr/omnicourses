import type { CurriculumSeed, KnownDiscrepancy, Page, PrintedGroup, PrintedRow } from './seed-types.js';

const CLC_2025_BOOKLET = { file: 'TCTA_CTDT_2025_Khoa-2025-all.pdf', pages: 73 };

export interface ClcRows {
  llct: PrintedRow[];
  khxh: PrintedRow[];
  toan_bb: PrintedRow[];
  toan_math: PrintedRow[];
  toan_science: PrintedRow[];
  tin: PrintedRow[];
  gdtc: PrintedRow[];
  gdqp: PrintedRow[];
  csn: PrintedRow[];
  bbcn: PrintedRow[];
  tccn: PrintedRow[];
  tn: PrintedRow[];
  free: PrintedRow[];
}

interface ClcSpecialisation {
  key: string;
  name_vi: string;
  file: string;
  pages: number;
  section: string;
  graduation_section: string;
  bbcn: { page: Page; credits_pages: Page[] };
  tccn: { page: Page; credits_pages: Page[]; overflow_note: string };
  free: { page: Page; note: string };
  tn: { page: Page; credits_pages: Page[]; note: string; options: { codes: string[]; at_least?: boolean }[]; needs_check?: string };
  rows: ClcRows;
  known_discrepancies?: KnownDiscrepancy[];
}

const SECTION_7_1_NOTE = 'Khối kiến thức giáo dục đại cương: tích lũy tổng cộng 56 tín chỉ (không kể Giáo dục thể chất và Giáo dục quốc phòng - An ninh).';

function group(
  name: string,
  kind: PrintedGroup['kind'],
  credits: number,
  official_notes: string | null,
  page: Page,
  credits_pages: Page[],
  rows: PrintedRow[],
  extra: Partial<PrintedGroup> = {},
): PrintedGroup {
  return {
    name,
    kind,
    credits_total: kind === 'compulsory' ? credits : null,
    credits_total_min: kind === 'elective' ? credits : null,
    official_notes,
    page,
    credits_pages,
    rows,
    ...extra,
  };
}

const notCounted = (rows: PrintedRow[]) => rows.map((row) => ({ ...row, counts_toward_total: false, counts_toward_gpa: false }));

const MATH_SCIENCE = 'Toán - Khoa học tự nhiên - Công nghệ - Môi trường';
const OUTSIDE_TOTAL_NOTE = 'Không tính vào điểm trung bình, tính vào số tín chỉ tích lũy. Không kể vào 138 tín chỉ của chương trình.';

const namesOf = (groups: PrintedGroup[]): string[] => groups.map((each) => each.name);

function mathScienceGroups(rows: ClcRows): PrintedGroup[] {
  return [
    group(`${MATH_SCIENCE}: bắt buộc`, 'compulsory', 24, `Các học phần BB của mục 7.1.3 (tổng mục 7.1.3: 36 tín chỉ).`, 8, [8], rows.toan_bb),
    group(`${MATH_SCIENCE}: chọn 01 học phần toán học`, 'elective', 4, 'Chọn 01 học phần (04 tín chỉ) từ các học phần toán học sau.', 8, [8], rows.toan_math),
    group(`${MATH_SCIENCE}: chọn học 08 tín chỉ`, 'elective', 8, 'Chọn học 08 tín chỉ từ các học phần sau.', 9, [9], rows.toan_science),
  ];
}

function generalEducationGroups(rows: ClcRows, mathScience: PrintedGroup[]): PrintedGroup[] {
  return [
    group('Lý luận chính trị - Pháp luật', 'compulsory', 14, null, 8, [8], rows.llct),
    group('Khoa học xã hội - Kinh tế - Kỹ năng', 'elective', 2, 'Chọn 01 học phần (02 tín chỉ) trong các học phần sau.', 8, [8], rows.khxh),
    ...mathScience,
    group('Tin học', 'compulsory', 4, null, 9, [9], rows.tin),
  ];
}

function outsideTotalGroups(rows: ClcRows): PrintedGroup[] {
  return [
    group('Giáo dục thể chất', 'compulsory', 4, OUTSIDE_TOTAL_NOTE, 9, [9], notCounted(rows.gdtc), { outside_total: true }),
    group('Giáo dục quốc phòng - An ninh', 'compulsory', 4, OUTSIDE_TOTAL_NOTE, 9, [10], notCounted(rows.gdqp), { outside_total: true }),
  ];
}

function majorGroups(spec: ClcSpecialisation): PrintedGroup[] {
  const { rows } = spec;
  return [
    group('Kiến thức cơ sở ngành', 'compulsory', 38, null, 10, [7, 10], rows.csn),
    group(
      'Kiến thức bắt buộc chuyên ngành',
      'elective',
      16,
      `Mục ${spec.section}.1. Sinh viên tích lũy tối thiểu 16 tín chỉ, được chọn trong danh sách các học phần dưới đây.`,
      spec.bbcn.page,
      [7, ...spec.bbcn.credits_pages],
      rows.bbcn,
    ),
    group('Kiến thức tự chọn chuyên ngành', 'elective', 8, `Mục ${spec.section}.2. ${spec.tccn.overflow_note}`, spec.tccn.page, [7, ...spec.tccn.credits_pages], rows.tccn),
    group('Kiến thức tự chọn tự do', 'elective', 10, `Mục ${spec.section}.3. ${spec.free.note}`, spec.free.page, [7], rows.free),
    group('Kiến thức tốt nghiệp', 'elective', 10, `Mục ${spec.graduation_section}. ${spec.tn.note}`, spec.tn.page, [7, ...spec.tn.credits_pages], rows.tn, {
      options: spec.tn.options.map((option) => ({ ...option, page: spec.tn.page })),
      ...(spec.tn.needs_check ? { needs_check: spec.tn.needs_check } : {}),
    }),
  ];
}

function clcProgram(spec: ClcSpecialisation): CurriculumSeed['program'] {
  return {
    code: `CNTT-TCTA-${spec.key}`,
    name_vi: `Cử nhân Công nghệ thông tin - Chương trình tăng cường tiếng Anh - Chuyên ngành ${spec.name_vi}`,
    name_en: null,
    faculty: null,
    training_type: 'high_quality',
    page: 1,
  };
}

function clcCurriculum(spec: ClcSpecialisation): CurriculumSeed['curriculum'] {
  return {
    cohort_year: 2025,
    code: `CNTT-TCTA-${spec.key}-2025`,
    name_vi: `Chương trình đào tạo ngành Công nghệ thông tin - Chương trình tăng cường tiếng Anh - Chuyên ngành ${spec.name_vi} - Khóa tuyển 2025`,
    name_en: null,
    language: 'vi',
    total_credits_min: 138,
    total_credits_pages: [7],
    decision: { number: '2852/QĐ-KHTN', date: '2025-09-19', page: 1 },
  };
}

function clcBlocks(generalEducation: string[]): CurriculumSeed['blocks'] {
  return [
    { name: 'Giáo dục đại cương', credits: 56, at_least: false, groups: generalEducation, page: 7 },
    { name: 'Kiến thức cơ sở ngành', credits: 38, at_least: false, groups: ['Kiến thức cơ sở ngành'], page: 7 },
    {
      name: 'Chuyên ngành',
      credits: 34,
      at_least: false,
      groups: ['Kiến thức bắt buộc chuyên ngành', 'Kiến thức tự chọn chuyên ngành', 'Kiến thức tự chọn tự do'],
      page: 7,
    },
    { name: 'Tốt nghiệp', credits: 10, at_least: false, groups: ['Kiến thức tốt nghiệp'], page: 7 },
  ];
}

function clcSubtotals(mathScience: string[], generalEducation: string[]): CurriculumSeed['subtotals'] {
  return [
    { name: '7.1.3 Toán - Khoa học tự nhiên - Công nghệ - Môi trường', credits: 36, groups: mathScience, page: 9 },
    { name: '7.1 Kiến thức giáo dục đại cương', credits: 56, groups: generalEducation, page: 7, note: SECTION_7_1_NOTE },
  ];
}

export function clc2025Seed(spec: ClcSpecialisation): CurriculumSeed {
  const mathScience = mathScienceGroups(spec.rows);
  const generalEducation = generalEducationGroups(spec.rows, mathScience);
  return {
    source: { file: spec.file, pages: spec.pages, structure: CLC_2025_BOOKLET },
    program: clcProgram(spec),
    curriculum: clcCurriculum(spec),
    blocks: clcBlocks(namesOf(generalEducation)),
    subtotals: clcSubtotals(namesOf(mathScience), namesOf(generalEducation)),
    groups: [...generalEducation, ...outsideTotalGroups(spec.rows), ...majorGroups(spec)],
    appendix: [],
    known_discrepancies: spec.known_discrepancies ?? [],
  };
}

export function freeElectiveNote(section: string, specialisations: string[]): string {
  return (
    `Nếu số tín chỉ tích luỹ từ các học phần ở mục ${section}.1 và ${section}.2 chưa đạt 34 tín chỉ, sinh viên chọn thêm ` +
    `các học phần thuộc các mục sau đây: Mục 7.2.2 Kiến thức chuyên ngành của các chuyên ngành sau: ` +
    `${specialisations.map((name) => `chuyên ngành ${name}`).join(', ')}; Mục 7.2.3 Kiến thức tốt nghiệp. ` +
    'Chi tiết xem tại Phụ lục 2: Danh mục học phần tự chọn tự do.'
  );
}

export const ALL_SPECIALISATIONS = [
  'Mạng máy tính và Viễn thông',
  'Hệ thống thông tin',
  'Kỹ thuật phần mềm',
  'Khoa học máy tính',
  'Công nghệ tri thức',
  'Thị giác máy tính',
  'An toàn thông tin',
  'Khoa học dữ liệu',
  'Công nghệ thông tin',
];

export function overflowNote(section: string, extra = ''): string {
  return (
    `Sinh viên tích lũy tối thiểu 08 tín chỉ, được chọn trong danh sách các học phần sau đây hoặc các học phần mục ` +
    `${section}.1 vượt quá số tín chỉ yêu cầu của mục đó${extra}.`
  );
}

export function graduationNote(fourCreditCodes: string[]): string {
  return (
    'Sinh viên tích lũy tối thiểu 10 tín chỉ, chọn 01 trong 03 phương án sau đây: (1) CSC10251 Khóa luận tốt nghiệp; ' +
    '(2) CSC10252 Thực tập tốt nghiệp; (3) CSC10204 Thực tập dự án tốt nghiệp và chọn 01 học phần (04 tín chỉ) từ các ' +
    `học phần tốt nghiệp sau: ${fourCreditCodes.join(', ')}.`
  );
}

export function graduationOptions(fourCreditCodes: string[]): { codes: string[] }[] {
  return [{ codes: ['CSC10251'] }, { codes: ['CSC10252'] }, ...fourCreditCodes.map((code) => ({ codes: ['CSC10204', code] }))];
}
