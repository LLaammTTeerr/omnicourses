import { clc2025AtttRows } from './clc-2025-attt.rows.js';
import { clc2025CnttinRows } from './clc-2025-cnttin.rows.js';
import { clc2025CntthucRows } from './clc-2025-cntthuc.rows.js';
import { clc2025HtttRows } from './clc-2025-httt.rows.js';
import { clc2025KhdlRows } from './clc-2025-khdl.rows.js';
import { clc2025KhmtRows } from './clc-2025-khmt.rows.js';
import { clc2025KtpmRows } from './clc-2025-ktpm.rows.js';
import { clc2025MmtRows } from './clc-2025-mmt.rows.js';
import { clc2025TgmtRows } from './clc-2025-tgmt.rows.js';
import {
  ALL_SPECIALISATIONS,
  clc2025Seed,
  freeElectiveNote,
  graduationNote,
  graduationOptions,
  overflowNote,
} from './clc-2025-shared.js';
import type { CurriculumSeed } from './seed-types.js';

// The nine specialisations of the CLC (Tăng cường tiếng Anh) 2025 curriculum.
// Pages in this file are booklet pages ("Trang n/73"); row pages are in the
// *.rows.ts files and refer to each specialisation's table PDF.

const notThis = (name: string) => ALL_SPECIALISATIONS.filter((s) => s !== name);

export const clc2025Mmt: CurriculumSeed = clc2025Seed({
  key: 'MMT',
  name_vi: 'Mạng máy tính và Viễn thông',
  file: 'TCTA_CTDT_2025_MMT.pdf',
  pages: 8,
  section: '7.2.2.1',
  graduation_section: '7.2.3.1',
  bbcn: { page: 11, credits_pages: [11] },
  tccn: { page: 11, credits_pages: [11], overflow_note: overflowNote('7.2.2.1', ' hoặc mục 7.2.3.1') },
  free: { page: 12, note: freeElectiveNote('7.2.2.1', ALL_SPECIALISATIONS) },
  tn: {
    page: 25,
    credits_pages: [25],
    note: graduationNote(['CSC11111', 'CSC11112', 'CSC11119', 'CSC15010']),
    options: graduationOptions(['CSC11111', 'CSC11112', 'CSC11119', 'CSC15010']),
  },
  rows: clc2025MmtRows,
});

export const clc2025Httt: CurriculumSeed = clc2025Seed({
  key: 'HTTT',
  name_vi: 'Hệ thống thông tin',
  file: 'TCTA_CTDT_2025_HTTT.pdf',
  pages: 10,
  section: '7.2.2.2',
  graduation_section: '7.2.3.2',
  bbcn: { page: 12, credits_pages: [12] },
  tccn: { page: 12, credits_pages: [13], overflow_note: overflowNote('7.2.2.2') },
  free: { page: 13, note: freeElectiveNote('7.2.2.2', ALL_SPECIALISATIONS) },
  tn: {
    page: 26,
    credits_pages: [26],
    note: graduationNote(['CSC12107', 'CSC12108', 'CSC12111']),
    options: graduationOptions(['CSC12107', 'CSC12108', 'CSC12111']),
  },
  rows: clc2025HtttRows,
});

export const clc2025Ktpm: CurriculumSeed = clc2025Seed({
  key: 'KTPM',
  name_vi: 'Kỹ thuật phần mềm',
  file: 'TCTA_CTDT_2025_KTPM.pdf',
  pages: 8,
  section: '7.2.2.3',
  graduation_section: '7.2.3.3',
  bbcn: { page: 13, credits_pages: [14] },
  tccn: { page: 14, credits_pages: [15], overflow_note: overflowNote('7.2.2.3') },
  free: { page: 15, note: freeElectiveNote('7.2.2.3', ALL_SPECIALISATIONS) },
  tn: {
    page: 26,
    credits_pages: [26],
    note: graduationNote(['CSC13114', 'CSC13115', 'CSC13116', 'CSC13118']),
    options: graduationOptions(['CSC13114', 'CSC13115', 'CSC13116', 'CSC13118']),
  },
  rows: clc2025KtpmRows,
});

export const clc2025Khmt: CurriculumSeed = clc2025Seed({
  key: 'KHMT',
  name_vi: 'Khoa học máy tính',
  file: 'TCTA_CTDT_2025_KHMT.pdf',
  pages: 8,
  section: '7.2.2.4',
  graduation_section: '7.2.3.4',
  bbcn: { page: 15, credits_pages: [16] },
  tccn: { page: 16, credits_pages: [16], overflow_note: overflowNote('7.2.2.4') },
  free: { page: 17, note: freeElectiveNote('7.2.2.4', ALL_SPECIALISATIONS) },
  tn: {
    page: 27,
    credits_pages: [27],
    note: graduationNote(['CSC14114', 'CSC14115', 'CSC14116', 'CSC16107', 'CSC18105']),
    options: graduationOptions(['CSC14114', 'CSC14115', 'CSC14116', 'CSC16107', 'CSC18105']),
  },
  rows: clc2025KhmtRows,
});

const CNTTHUC_SIX = ['CSC10204', 'CSC15201', 'CSC15202'];
const CNTTHUC_FOUR = ['CSC15104', 'CSC15105', 'CSC15106'];

export const clc2025Cntthuc: CurriculumSeed = clc2025Seed({
  key: 'CNTTHUC',
  name_vi: 'Công nghệ tri thức',
  file: 'TCTA_CTDT_2025_CNTTHUC.pdf',
  pages: 8,
  section: '7.2.2.5',
  graduation_section: '7.2.3.5',
  bbcn: { page: 17, credits_pages: [17] },
  tccn: { page: 17, credits_pages: [18], overflow_note: overflowNote('7.2.2.5') },
  free: { page: 18, note: freeElectiveNote('7.2.2.5', ALL_SPECIALISATIONS) },
  tn: {
    page: 27,
    credits_pages: [27],
    note:
      'Sinh viên tích lũy tối thiểu 10 tín chỉ, chọn 01 trong 03 phương án sau đây: (1) CSC10251 Khóa luận tốt nghiệp; ' +
      '(2) CSC10252 Thực tập tốt nghiệp; (3) chọn 01 học phần (06 tín chỉ) từ các học phần tốt nghiệp sau: CSC10204, ' +
      'CSC15201, CSC15202 và chọn 01 học phần (04 tín chỉ) từ các học phần tốt nghiệp sau: CSC15104, CSC15105, CSC15106.',
    options: [
      { codes: ['CSC10251'] },
      { codes: ['CSC10252'] },
      ...CNTTHUC_SIX.flatMap((six) => CNTTHUC_FOUR.map((four) => ({ codes: [six, four] }))),
    ],
  },
  rows: clc2025CntthucRows,
});

export const clc2025Tgmt: CurriculumSeed = clc2025Seed({
  key: 'TGMT',
  name_vi: 'Thị giác máy tính',
  file: 'TCTA_CTDT_2025_TGMT.pdf',
  pages: 8,
  section: '7.2.2.6',
  graduation_section: '7.2.3.6',
  bbcn: { page: 18, credits_pages: [19] },
  tccn: { page: 19, credits_pages: [19], overflow_note: overflowNote('7.2.2.6') },
  free: { page: 19, note: freeElectiveNote('7.2.2.6', ALL_SPECIALISATIONS) },
  tn: {
    page: 28,
    credits_pages: [28],
    note: graduationNote(['CSC16110', 'CSC16111', 'CSC16112']),
    options: graduationOptions(['CSC16110', 'CSC16111', 'CSC16112']),
  },
  rows: clc2025TgmtRows,
});

export const clc2025Attt: CurriculumSeed = clc2025Seed({
  key: 'ATTT',
  name_vi: 'An toàn thông tin',
  file: 'TCTA_CTDT_2025_ATTT.pdf',
  pages: 8,
  section: '7.2.2.7',
  graduation_section: '7.2.3.7',
  bbcn: { page: 20, credits_pages: [20] },
  tccn: { page: 20, credits_pages: [21], overflow_note: overflowNote('7.2.2.7') },
  free: { page: 21, note: freeElectiveNote('7.2.2.7', ALL_SPECIALISATIONS) },
  tn: {
    page: 28,
    credits_pages: [28],
    note:
      'Sinh viên tích lũy tối thiểu 10 tín chỉ, chọn 01 trong 03 phương án sau đây: (1) CSC10251 Khóa luận tốt nghiệp; ' +
      '(2) CSC10252 Thực tập tốt nghiệp; (3) chọn 01 học phần (06 tín chỉ) từ các học phần tốt nghiệp sau: CSC10204, ' +
      'CSC15201 và 01 học phần (04 tín chỉ) từ (các) học phần tốt nghiệp sau: CSC15104.',
    options: [
      { codes: ['CSC10251'] },
      { codes: ['CSC10252'] },
      { codes: ['CSC10204', 'CSC15104'] },
      { codes: ['CSC15201', 'CSC15104'] },
    ],
  },
  rows: clc2025AtttRows,
});

export const clc2025Khdl: CurriculumSeed = clc2025Seed({
  key: 'KHDL',
  name_vi: 'Khoa học dữ liệu',
  file: 'TCTA_CTDT_2025_KHDL.pdf',
  pages: 8,
  section: '7.2.2.8',
  graduation_section: '7.2.3.8',
  bbcn: { page: 21, credits_pages: [21] },
  tccn: { page: 21, credits_pages: [22], overflow_note: overflowNote('7.2.2.8') },
  free: { page: 22, note: freeElectiveNote('7.2.2.8', notThis('Công nghệ thông tin')) },
  tn: {
    page: 28,
    credits_pages: [29],
    note: graduationNote(['CSC14115', 'CSC14116', 'CSC17107']),
    options: graduationOptions(['CSC14115', 'CSC14116', 'CSC17107']),
  },
  rows: clc2025KhdlRows,
  known_discrepancies: [
    {
      pages: [22],
      description:
        'Booklet 7.2.2.8.3 (p.22) lists the specialisations whose 7.2.2 courses count as free electives and omits ' +
        '"Công nghệ thông tin". The KHDL table PDF (p.8, STT 179-186) still lists the eight courses of mục 7.2.2.9.3 ' +
        '(CSC00008, CSC11114, CSC12112, CSC12113, CSC13119-CSC13122) as Tự chọn tự do.',
      resolution: 'The seed links them, as the table PDF does. A reviewer should confirm with the faculty.',
    },
  ],
});

export const clc2025Cnttin: CurriculumSeed = clc2025Seed({
  key: 'CNTTIN',
  name_vi: 'Công nghệ thông tin',
  file: 'TCTA_CTDT_2025_CNTTIN.pdf',
  pages: 8,
  section: '7.2.2.9',
  graduation_section: '7.2.3.9',
  bbcn: { page: 22, credits_pages: [23] },
  tccn: { page: 23, credits_pages: [24], overflow_note: overflowNote('7.2.2.9') },
  free: {
    page: 24,
    note:
      'Nếu số tín chỉ tích luỹ từ các học phần ở mục 7.2.2.9.1 và 7.2.2.9.2 chưa đạt 34 tín chỉ, sinh viên chọn thêm ' +
      'các học phần dưới đây: CSC00008, CSC11114, CSC12112, CSC12113, CSC13119, CSC13120, CSC13121, CSC13122. ' +
      `Hoặc các học phần thuộc các mục sau đây: Mục 7.2.2 Kiến thức chuyên ngành của các chuyên ngành sau: ` +
      `${notThis('Công nghệ thông tin').map((s) => `chuyên ngành ${s}`).join(', ')}; Mục 7.2.3 Kiến thức tốt nghiệp. ` +
      'Chi tiết xem tại Phụ lục 2: Danh mục học phần tự chọn tự do.',
  },
  tn: {
    page: 29,
    credits_pages: [29],
    note:
      'Sinh viên tích lũy tối thiểu 10 tín chỉ, chọn 01 trong 03 phương án sau đây: (1) CSC10251 Khóa luận tốt nghiệp; ' +
      '(2) CSC10252 Thực tập tốt nghiệp; (3) CSC10204 Thực tập dự án tốt nghiệp và chọn 01 học phần (để đạt tối thiểu 04 ' +
      'tín chỉ) từ các học phần tốt nghiệp sau: CSC10202, CSC10203, CSC13123; hoặc các học phần thuộc mục 7.2.3 Kiến ' +
      'thức tốt nghiệp của các chuyên ngành khác. Chi tiết xem tại Phụ lục 3.',
    options: [
      { codes: ['CSC10251'] },
      { codes: ['CSC10252'] },
      { codes: ['CSC10204', 'CSC10202'], at_least: true },
      { codes: ['CSC10204', 'CSC10203'], at_least: true },
      { codes: ['CSC10204', 'CSC13123'], at_least: true },
    ],
    needs_check:
      'Option 3 adds "hoặc các học phần thuộc mục 7.2.3 ... của các chuyên ngành sau" (p.29): any graduation course of ' +
      'another specialisation may replace the 6-credit pick. The table PDF links those 23 courses to this group; only ' +
      'the three printed pairs are listed as options. Phụ lục 3 is not bound into the booklet.',
  },
  rows: clc2025CnttinRows,
});

/** In the booklet's order (7.2.2.1 to 7.2.2.9). */
export const CLC_2025_SEEDS: CurriculumSeed[] = [
  clc2025Mmt,
  clc2025Httt,
  clc2025Ktpm,
  clc2025Khmt,
  clc2025Cntthuc,
  clc2025Tgmt,
  clc2025Attt,
  clc2025Khdl,
  clc2025Cnttin,
];
