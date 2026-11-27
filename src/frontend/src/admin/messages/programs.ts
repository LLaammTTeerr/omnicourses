import { type Lang } from '../../locale.js';
import type { CohortField, ProgramField } from '../forms.js';

export interface ProgramMessages {
  programsTitle: string;
  programsLead: string;
  addProgram: string;
  editProgram: string;
  editProgramLabel: (program: string) => string;
  programNew: string;
  programEdit: (program: string) => string;
  fields: Record<ProgramField, string>;
  codeHint: string;
  codeFixed: string;
  blankHint: string;
  programNotHere: string;
  programCreated: (program: string) => string;
  programSaved: (program: string) => string;
  duplicateProgramCode: string;
  programLoadFailed: string;
  addCohort: string;
  editCohort: string;
  editCohortLabel: (year: number) => string;
  cohortNew: (program: string) => string;
  cohortEdit: (program: string, year: number) => string;
  cohortFields: Record<CohortField, string>;
  cohortYearHint: string;
  cohortCodeHint: string;
  languageHint: string;
  identityFixed: string;
  cohortNotHere: string;
  cohortCreated: (year: string) => string;
  cohortSaved: (year: number) => string;
  duplicateCohortCode: string;
  cohortLoadFailed: string;
  noChange: string;
}

export const PROGRAMS_MESSAGES: Record<Lang, ProgramMessages> = {
  vi: {
    programsTitle: 'Chương trình',
    programsLead: 'Tạo chương trình mới theo văn bản chính thức. Người tạo không tự có quyền quản trị chương trình đó: sau khi tạo, cấp quyền quản trị chương trình cho người phụ trách.',
    addProgram: 'Thêm chương trình',
    editProgram: 'Sửa chương trình',
    editProgramLabel: (program) => `Sửa thông tin chương trình ${program}`,
    programNew: 'Chương trình mới',
    programEdit: (program) => `Sửa chương trình ${program}`,
    fields: { code: 'Mã chương trình', nameVi: 'Tên tiếng Việt', nameEn: 'Tên tiếng Anh', faculty: 'Khoa quản lý' },
    codeHint: 'Chữ in hoa và số, các phần nối bằng một dấu gạch ngang, ví dụ ZZ-PROG. Không đổi được sau khi tạo.',
    codeFixed: 'Mã không đổi được ở đây.',
    blankHint: 'Để trống nếu văn bản chính thức không ghi.',
    programNotHere: 'Loại hình đào tạo (quyết định mức tín chỉ mỗi học kỳ) chưa nhập được ở đây.',
    programCreated: (program) => `Đã tạo chương trình ${program}. Chưa ai quản trị chương trình này: cấp quyền quản trị chương trình cho người phụ trách.`,
    programSaved: (program) => `Đã lưu chương trình ${program}.`,
    duplicateProgramCode: 'Đã có chương trình mang mã này. Chưa lưu gì.',
    programLoadFailed: 'Chưa tải được thông tin của chương trình. Thử lại.',
    addCohort: 'Thêm khóa',
    editCohort: 'Sửa khóa',
    editCohortLabel: (year) => `Sửa thông tin khóa ${year}`,
    cohortNew: (program) => `Khóa mới của ${program}`,
    cohortEdit: (program, year) => `Sửa khóa ${year} của ${program}`,
    cohortFields: { cohortYear: 'Năm vào học', code: 'Mã chương trình đào tạo của khóa', nameVi: 'Tên tiếng Việt', nameEn: 'Tên tiếng Anh', language: 'Ngôn ngữ giảng dạy' },
    cohortYearHint: 'Năm khóa này vào học, ví dụ 2026. Mỗi chương trình có một khóa cho mỗi năm.',
    cohortCodeHint: 'Chữ in hoa và số, các phần nối bằng một dấu gạch ngang, ví dụ ZZ-PROG-2026. Không trùng với chương trình đào tạo nào khác.',
    languageHint: 'Ví dụ vi hoặc en. Để trống nếu văn bản chính thức không ghi.',
    identityFixed: 'Năm vào học và mã không đổi được sau khi tạo.',
    cohortNotHere: 'Khóa mới chưa có nhóm yêu cầu nào; các khóa khác không đổi. Tổng số tín chỉ của khóa chưa nhập được ở đây.',
    cohortCreated: (year) => `Đã thêm khóa ${year}. Khóa này chưa có nhóm yêu cầu nào.`,
    cohortSaved: (year) => `Đã lưu khóa ${year}.`,
    duplicateCohortCode: 'Đã có chương trình đào tạo mang mã này. Chưa lưu gì.',
    cohortLoadFailed: 'Chưa tải được thông tin của khóa. Thử lại.',
    noChange: 'Không có gì thay đổi, nên chưa gửi gì.',
  },
  en: {
    programsTitle: 'Programs',
    programsLead: 'Create a program from the official documents. Creating it gives you no right to administer it: once it exists, grant program administrator to the person in charge.',
    addProgram: 'Add a program',
    editProgram: 'Edit the program',
    editProgramLabel: (program) => `Edit the details of the program ${program}`,
    programNew: 'New program',
    programEdit: (program) => `Edit the program ${program}`,
    fields: { code: 'Program code', nameVi: 'Vietnamese name', nameEn: 'English name', faculty: 'Faculty' },
    codeHint: 'Capital letters and digits, in parts joined by single hyphens, for example ZZ-PROG. It cannot change after it is created.',
    codeFixed: 'The code cannot change here.',
    blankHint: 'Leave it empty when the official document does not give it.',
    programNotHere: 'The training type (it sets the credits per term) cannot be entered here yet.',
    programCreated: (program) => `Created the program ${program}. Nobody administers it yet: grant program administrator to the person in charge.`,
    programSaved: (program) => `Saved the program ${program}.`,
    duplicateProgramCode: 'A program has this code already. Nothing was saved.',
    programLoadFailed: 'Could not load the details of the program. Try again.',
    addCohort: 'Add a cohort',
    editCohort: 'Edit the cohort',
    editCohortLabel: (year) => `Edit the details of the cohort ${year}`,
    cohortNew: (program) => `New cohort of ${program}`,
    cohortEdit: (program, year) => `Edit the cohort ${year} of ${program}`,
    cohortFields: { cohortYear: 'Year of entry', code: "Code of the cohort's curriculum", nameVi: 'Vietnamese name', nameEn: 'English name', language: 'Language of instruction' },
    cohortYearHint: 'The year this cohort entered, for example 2026. A program has one cohort per year.',
    cohortCodeHint: 'Capital letters and digits, in parts joined by single hyphens, for example ZZ-PROG-2026. No other curriculum may have it.',
    languageHint: 'For example vi or en. Leave it empty when the official document does not give it.',
    identityFixed: 'The year of entry and the code cannot change after it is created.',
    cohortNotHere: 'A new cohort has no requirement group yet; other cohorts do not change. The credit total of the cohort cannot be entered here yet.',
    cohortCreated: (year) => `Added the cohort ${year}. It has no requirement group yet.`,
    cohortSaved: (year) => `Saved the cohort ${year}.`,
    duplicateCohortCode: 'A curriculum has this code already. Nothing was saved.',
    cohortLoadFailed: 'Could not load the details of the cohort. Try again.',
    noChange: 'Nothing changed, so nothing was sent.',
  },
};
