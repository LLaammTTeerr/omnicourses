import type { Lang } from '../locale.js';
import type { Term, TranscriptResult } from './api.js';
import type { Problem } from './rows.js';

interface TranscriptMessages {
  title: string;
  lead: string;
  guides: string;
  pdfTitle: string;
  pdfText: string;
  replaceTitle: string;
  replaceText: string;
  loading: string;
  loadFailed: string;
  retry: string;
  rowsCount: (rows: number) => string;
  toFix: (rows: number) => string;
  ready: string;
  unchanged: string;
  blockedNote: string;
  replaceNote: string;
  addRow: string;
  save: string;
  saving: string;
  saved: (rows: number) => string;
  saveRefused: string;
  saveFailed: string;
  review: string;
  resultKinds: string;
  empty: string;
  full: string;
  columns: { term: string; courseCode: string; courseName: string; credits: string; result: string; grade: string; check: string; remove: string };
  term: (year: number, n: Term['number']) => string;
  results: Record<TranscriptResult, string>;
  pickResult: string;
  rowLabel: (n: number, code: string) => string;
  fieldLabel: (field: string, row: string) => string;
  removeRow: (row: string) => string;
  ok: string;
  needsFix: string;
  needsFixShort: string;
  problems: Record<Problem, string>;
  removed: (row: string) => string;
  noGrade: string;
  engineNote: string;
  leave: string;
}

export const TRANSCRIPT_MESSAGES: Record<Lang, TranscriptMessages> = {
  vi: {
    title: 'Bảng điểm',
    lead: 'Nhập từng môn đã học, đang học hoặc được miễn, theo bảng điểm trên cổng thông tin sinh viên. Duyệt từng dòng rồi lưu.',
    guides: 'Hướng dẫn thủ tục',
    pdfTitle: 'Chưa đọc được file PDF.',
    pdfText: 'Bộ đọc bảng điểm PDF cố định (không dùng AI) sẽ có ở bản sau. Bây giờ bạn nhập tay từng môn.',
    replaceTitle: 'Lưu là thay toàn bộ.',
    replaceText: 'Chỉ những dòng trong bảng này được lưu. Lưu lần sau sẽ thay toàn bộ lần trước.',
    loading: 'Đang tải bảng điểm…',
    loadFailed: 'Chưa tải được bảng điểm. Hãy thử lại sau ít phút.',
    retry: 'Thử lại',
    rowsCount: (rows) => `${rows} dòng`,
    toFix: (rows) => `${rows} dòng cần sửa`,
    ready: 'sẵn sàng lưu',
    unchanged: 'chưa có thay đổi',
    blockedNote: 'Dòng chưa đủ thông tin không lưu được.',
    replaceNote: 'Lưu sẽ thay toàn bộ bảng điểm trước đó.',
    addRow: 'Thêm dòng',
    save: 'Lưu bảng điểm',
    saving: 'Đang lưu…',
    saved: (rows) => `Đã lưu ${rows} dòng.`,
    saveRefused: 'Máy chủ từ chối một dòng chưa hợp lệ. Chưa lưu gì; hãy kiểm tra lại bảng.',
    saveFailed: 'Chưa lưu được. Các dòng vẫn còn ở đây; hãy thử lại sau ít phút.',
    review: 'Duyệt từng dòng',
    resultKinds: 'Kết quả: có điểm, đang học, miễn, đạt, không đạt',
    empty: 'Chưa có môn nào. Thêm dòng đầu tiên để bắt đầu.',
    full: 'Bảng điểm có tối đa 300 dòng.',
    columns: { term: 'Học kỳ', courseCode: 'Mã môn', courseName: 'Tên môn', credits: 'TC', result: 'Kết quả', grade: 'Điểm (thang 10)', check: 'Kiểm tra', remove: 'Xóa' },
    term: (year, n) => `${{ 1: 'HK1', 2: 'HK2', 3: 'HK3' }[n]} ${year}–${year + 1}`,
    results: { graded: 'Có điểm', in_progress: 'Đang học', exempt: 'Miễn', pass: 'Đạt', fail: 'Không đạt' },
    pickResult: 'Chọn kết quả',
    rowLabel: (n, code) => `dòng ${n}${code ? ` (${code})` : ''}`,
    fieldLabel: (field, row) => `${field}, ${row}`,
    removeRow: (row) => `Xóa ${row}`,
    ok: 'Hợp lệ',
    needsFix: 'Cần sửa:',
    needsFixShort: 'Cần sửa',
    problems: { term: 'học kỳ', courseCode: 'mã môn (2–20 chữ hoặc số)', courseName: 'tên môn', credits: 'số TC (0–30)', result: 'kết quả', grade: 'điểm (0–10, một chữ số thập phân)' },
    removed: (row) => `Đã bỏ ${row} khỏi bảng. Bảng điểm đã lưu chỉ đổi khi bạn bấm lưu.`,
    noGrade: 'Không có điểm',
    engineNote: 'Bảng điểm chỉ ghi lại kết quả. Môn nào được tính cho nhóm nào, lần học nào được tính, do rule engine quyết định khi xét tốt nghiệp.',
    leave: 'Bảng điểm có thay đổi chưa lưu. Rời trang và bỏ các thay đổi?',
  },
  en: {
    title: 'Transcript',
    lead: 'Enter every course you passed, are taking or were exempted from, as the student portal transcript lists it. Review each row, then save.',
    guides: 'School task guides',
    pdfTitle: 'PDF files cannot be read yet.',
    pdfText: 'A fixed transcript PDF reader (no AI) comes in a later release. For now, enter each course by hand.',
    replaceTitle: 'Saving replaces everything.',
    replaceText: 'Only the rows in this table are saved. A later save replaces the earlier one.',
    loading: 'Loading your transcript…',
    loadFailed: 'Could not load your transcript right now. Please try again in a moment.',
    retry: 'Try again',
    rowsCount: (rows) => `${rows} row${rows === 1 ? '' : 's'}`,
    toFix: (rows) => `${rows} to fix`,
    ready: 'ready to save',
    unchanged: 'no changes',
    blockedNote: 'An incomplete row cannot be saved.',
    replaceNote: 'Saving replaces your whole saved transcript.',
    addRow: 'Add row',
    save: 'Save transcript',
    saving: 'Saving…',
    saved: (rows) => `Saved ${rows} row${rows === 1 ? '' : 's'}.`,
    saveRefused: 'The server refused a row that is not valid. Nothing was saved; check the table.',
    saveFailed: 'Could not save. Your rows are still here; try again in a moment.',
    review: 'Review each row',
    resultKinds: 'Results: graded, in progress, exempt, pass, fail',
    empty: 'No courses yet. Add the first row to start.',
    full: 'A transcript has at most 300 rows.',
    columns: { term: 'Term', courseCode: 'Code', courseName: 'Course', credits: 'Credits', result: 'Result', grade: 'Grade (out of 10)', check: 'Check', remove: 'Remove' },
    term: (year, n) => `${{ 1: 'Term 1', 2: 'Term 2', 3: 'Term 3' }[n]} ${year}–${year + 1}`,
    results: { graded: 'Graded', in_progress: 'In progress', exempt: 'Exempt', pass: 'Pass', fail: 'Fail' },
    pickResult: 'Pick a result',
    rowLabel: (n, code) => `row ${n}${code ? ` (${code})` : ''}`,
    fieldLabel: (field, row) => `${field}, ${row}`,
    removeRow: (row) => `Remove ${row}`,
    ok: 'Valid',
    needsFix: 'Fix:',
    needsFixShort: 'Needs fixing',
    problems: { term: 'term', courseCode: 'code (2–20 letters or digits)', courseName: 'course name', credits: 'credits (0–30)', result: 'result', grade: 'grade (0–10, one decimal)' },
    removed: (row) => `Removed ${row} from the table. Your saved transcript changes only when you save.`,
    noGrade: 'No grade',
    engineNote: 'The transcript only records results. Which group a course counts for, and which attempt counts, is decided by the rule engine in the degree audit.',
    leave: 'Your transcript has unsaved changes. Leave the page and discard them?',
  },
};
