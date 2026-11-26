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

const notCounted = (rows: PrintedRow[]) => rows.map((r) => ({ ...r, counts_toward_total: false, counts_toward_gpa: false }));

export function clc2025Seed(spec: ClcSpecialisation): CurriculumSeed {
  const r = spec.rows;
  const toan = 'Toán - Khoa học tự nhiên - Công nghệ - Môi trường';
  const groups: PrintedGroup[] = [
    group('Lý luận chính trị - Pháp luật', 'compulsory', 14, null, 8, [8], r.llct),
    group('Khoa học xã hội - Kinh tế - Kỹ năng', 'elective', 2, 'Chọn 01 học phần (02 tín chỉ) trong các học phần sau.', 8, [8], r.khxh),
    group(`${toan}: bắt buộc`, 'compulsory', 24, `Các học phần BB của mục 7.1.3 (tổng mục 7.1.3: 36 tín chỉ).`, 8, [8], r.toan_bb),
    group(`${toan}: chọn 01 học phần toán học`, 'elective', 4, 'Chọn 01 học phần (04 tín chỉ) từ các học phần toán học sau.', 8, [8], r.toan_math),
    group(`${toan}: chọn học 08 tín chỉ`, 'elective', 8, 'Chọn học 08 tín chỉ từ các học phần sau.', 9, [9], r.toan_science),
    group('Tin học', 'compulsory', 4, null, 9, [9], r.tin),
    group(
      'Giáo dục thể chất',
      'compulsory',
      4,
      'Không tính vào điểm trung bình, tính vào số tín chỉ tích lũy. Không kể vào 138 tín chỉ của chương trình.',
      9,
      [9],
      notCounted(r.gdtc),
      { outside_total: true },
    ),
    group(
      'Giáo dục quốc phòng - An ninh',
      'compulsory',
      4,
      'Không tính vào điểm trung bình, tính vào số tín chỉ tích lũy. Không kể vào 138 tín chỉ của chương trình.',
      9,
      [10],
      notCounted(r.gdqp),
      { outside_total: true },
    ),
    group('Kiến thức cơ sở ngành', 'compulsory', 38, null, 10, [7, 10], r.csn),
    group(
      'Kiến thức bắt buộc chuyên ngành',
      'elective',
      16,
      `Mục ${spec.section}.1. Sinh viên tích lũy tối thiểu 16 tín chỉ, được chọn trong danh sách các học phần dưới đây.`,
      spec.bbcn.page,
      [7, ...spec.bbcn.credits_pages],
      r.bbcn,
    ),
    group('Kiến thức tự chọn chuyên ngành', 'elective', 8, `Mục ${spec.section}.2. ${spec.tccn.overflow_note}`, spec.tccn.page, [7, ...spec.tccn.credits_pages], r.tccn),
    group('Kiến thức tự chọn tự do', 'elective', 10, `Mục ${spec.section}.3. ${spec.free.note}`, spec.free.page, [7], r.free),
    group('Kiến thức tốt nghiệp', 'elective', 10, `Mục ${spec.graduation_section}. ${spec.tn.note}`, spec.tn.page, [7, ...spec.tn.credits_pages], r.tn, {
      options: spec.tn.options.map((o) => ({ ...o, page: spec.tn.page })),
      ...(spec.tn.needs_check ? { needs_check: spec.tn.needs_check } : {}),
    }),
  ];

  return {
    source: { file: spec.file, pages: spec.pages, structure: CLC_2025_BOOKLET },
    program: {
      code: `CNTT-TCTA-${spec.key}`,
      name_vi: `Cử nhân Công nghệ thông tin - Chương trình tăng cường tiếng Anh - Chuyên ngành ${spec.name_vi}`,
      name_en: null,
      faculty: null,
      training_type: 'high_quality',
      page: 1,
    },
    curriculum: {
      cohort_year: 2025,
      code: `CNTT-TCTA-${spec.key}-2025`,
      name_vi: `Chương trình đào tạo ngành Công nghệ thông tin - Chương trình tăng cường tiếng Anh - Chuyên ngành ${spec.name_vi} - Khóa tuyển 2025`,
      name_en: null,
      language: 'vi',
      total_credits_min: 138,
      total_credits_pages: [7],
      decision: { number: '2852/QĐ-KHTN', date: '2025-09-19', page: 1 },
    },
    blocks: [
      {
        name: 'Giáo dục đại cương',
        credits: 56,
        at_least: false,
        groups: groups.slice(0, 6).map((g) => g.name),
        page: 7,
      },
      { name: 'Kiến thức cơ sở ngành', credits: 38, at_least: false, groups: ['Kiến thức cơ sở ngành'], page: 7 },
      {
        name: 'Chuyên ngành',
        credits: 34,
        at_least: false,
        groups: ['Kiến thức bắt buộc chuyên ngành', 'Kiến thức tự chọn chuyên ngành', 'Kiến thức tự chọn tự do'],
        page: 7,
      },
      { name: 'Tốt nghiệp', credits: 10, at_least: false, groups: ['Kiến thức tốt nghiệp'], page: 7 },
    ],
    subtotals: [
      { name: '7.1.3 Toán - Khoa học tự nhiên - Công nghệ - Môi trường', credits: 36, groups: groups.slice(2, 5).map((g) => g.name), page: 9 },
      { name: '7.1 Kiến thức giáo dục đại cương', credits: 56, groups: groups.slice(0, 6).map((g) => g.name), page: 7, note: SECTION_7_1_NOTE },
    ],
    groups,
    appendix: [],
    known_discrepancies: spec.known_discrepancies ?? [],
  };
}

export function freeElectiveNote(section: string, specialisations: string[]): string {
  return (
    `Nếu số tín chỉ tích luỹ từ các học phần ở mục ${section}.1 và ${section}.2 chưa đạt 34 tín chỉ, sinh viên chọn thêm ` +
    `các học phần thuộc các mục sau đây: Mục 7.2.2 Kiến thức chuyên ngành của các chuyên ngành sau: ` +
    `${specialisations.map((s) => `chuyên ngành ${s}`).join(', ')}; Mục 7.2.3 Kiến thức tốt nghiệp. ` +
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
  return [{ codes: ['CSC10251'] }, { codes: ['CSC10252'] }, ...fourCreditCodes.map((c) => ({ codes: ['CSC10204', c] }))];
}
