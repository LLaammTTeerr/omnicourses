import type { Lang } from '../locale.js';
import { termName } from '../terms.js';
import type { Term, TranscriptResult } from './api.js';
import type { PasteReason } from './paste.js';
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
  diffSummary: (added: number, changed: number, removed: number) => string;
  blockedNote: string;
  replaceNote: string;
  openPaste: string;
  cancelChanges: string;
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
  notInCurriculum: string;
  problems: Record<Problem, string>;
  removed: (row: string) => string;
  noGrade: string;
  engineNote: string;
  leave: string;
  pasteTitle: string;
  pasteLead: string;
  pasteLabel: string;
  pastePlaceholder: string;
  pasteHint: string;
  pasteParsedCount: (rows: number) => string;
  pasteErrorCount: (errors: number) => string;
  pasteFixFirst: string;
  pasteOverLimit: string;
  pasteLineError: (line: number, reason: string) => string;
  pasteReasons: Record<PasteReason, string>;
  pasteCancel: string;
  pasteReplace: string;
  pasteAppend: string;
  pastedAdded: (rows: number) => string;
  pastedReplaced: (rows: number) => string;
}

export const TRANSCRIPT_MESSAGES: Record<Lang, TranscriptMessages> = {
  vi: {
    title: 'Bảng điểm',
    lead: 'Nhập từng môn đã học, đang học hoặc được miễn, theo bảng điểm trên cổng thông tin sinh viên. Duyệt từng dòng rồi lưu.',
    guides: 'Hướng dẫn thủ tục',
    pdfTitle: 'Chưa đọc được file PDF.',
    pdfText: 'Không tải file PDF lên: hãy dán bảng điểm từ cổng sinh viên hoặc nhập tay từng môn ngay trên trình duyệt.',
    replaceTitle: 'Lưu là thay toàn bộ.',
    replaceText: 'Chỉ những dòng trong bảng này được lưu. Lưu lần sau sẽ thay toàn bộ lần trước.',
    loading: 'Đang tải bảng điểm…',
    loadFailed: 'Chưa tải được bảng điểm. Hãy thử lại sau ít phút.',
    retry: 'Thử lại',
    rowsCount: (rows) => `${rows} dòng`,
    toFix: (rows) => `${rows} dòng cần sửa`,
    ready: 'sẵn sàng lưu',
    unchanged: 'chưa có thay đổi',
    diffSummary: (added, changed, removed) => `+${added} thêm / ~${changed} sửa / -${removed} xóa`,
    blockedNote: 'Dòng chưa đủ thông tin không lưu được.',
    replaceNote: 'Lưu sẽ thay toàn bộ bảng điểm trước đó.',
    openPaste: 'Dán bảng điểm',
    cancelChanges: 'Hủy thay đổi',
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
    term: (year, number) => termName({ year, number }, 'vi'),
    results: { graded: 'Có điểm', in_progress: 'Đang học', exempt: 'Miễn', pass: 'Đạt', fail: 'Không đạt' },
    pickResult: 'Chọn kết quả',
    rowLabel: (n, code) => `dòng ${n}${code ? ` (${code})` : ''}`,
    fieldLabel: (field, row) => `${field}, ${row}`,
    removeRow: (row) => `Xóa ${row}`,
    ok: 'Hợp lệ',
    needsFix: 'Cần sửa:',
    needsFixShort: 'Cần sửa',
    notInCurriculum: 'Ngoài CTĐT của bạn',
    problems: { term: 'học kỳ', courseCode: 'mã môn (2–20 chữ hoặc số)', courseName: 'tên môn (tối đa 255 ký tự)', credits: 'số TC (0–30)', result: 'kết quả', grade: 'điểm (0–10, một chữ số thập phân)' },
    removed: (row) => `Đã bỏ ${row} khỏi bảng. Bảng điểm đã lưu chỉ đổi khi bạn bấm lưu.`,
    noGrade: 'Không có điểm',
    engineNote: 'Bảng điểm chỉ ghi lại kết quả. Môn nào được tính cho nhóm nào, lần học nào được tính, do rule engine quyết định khi xét tốt nghiệp.',
    leave: 'Bảng điểm có thay đổi chưa lưu. Rời trang và bỏ các thay đổi?',
    pasteTitle: 'Dán bảng điểm',
    pasteLead: 'Sao chép các dòng điểm từ cổng thông tin sinh viên hoặc bảng tính rồi dán vào ô dưới. Dữ liệu chỉ được đọc cố định ngay trên trình duyệt và chưa gửi đi cho tới khi bạn bấm lưu.',
    pasteLabel: 'Nội dung bảng điểm',
    pastePlaceholder: 'HK1 2024-2025\tCSC10001\tNhập môn lập trình\t4\t8,5',
    pasteHint: 'Hỗ trợ cột phân tách bằng tab (TSV), dấu gạch đứng (|) hoặc dấu chấm phẩy (;): Học kỳ, Mã môn, Tên môn, TC, Điểm/Kết quả.',
    pasteParsedCount: (rows) => `${rows} dòng hợp lệ`,
    pasteErrorCount: (errors) => `${errors} dòng lỗi`,
    pasteFixFirst: 'Hãy sửa hoặc bỏ các dòng báo lỗi trước khi đưa vào bảng duyệt.',
    pasteOverLimit: 'Tổng số dòng vượt quá giới hạn tối đa 300 dòng của bảng điểm.',
    pasteLineError: (line, reason) => `Dòng ${line}: ${reason}`,
    pasteReasons: {
      columns: 'sai số cột (cần 5–7 cột)',
      term: 'học kỳ không hợp lệ (ví dụ: 2024-1 hoặc HK1 2024-2025)',
      courseCode: 'mã môn không hợp lệ (2–20 chữ hoặc số)',
      courseName: 'tên môn trống hoặc quá 255 ký tự',
      credits: 'số tín chỉ không hợp lệ (0–30)',
      result: 'kết quả không nhận diện được',
      grade: 'điểm không hợp lệ (0–10, một chữ số thập phân)',
    },
    pasteCancel: 'Đóng',
    pasteReplace: 'Thay các dòng nháp',
    pasteAppend: 'Thêm vào bảng duyệt',
    pastedAdded: (rows) => `Đã thêm ${rows} dòng vào bảng duyệt. Bảng điểm đã lưu chỉ đổi khi bạn bấm lưu.`,
    pastedReplaced: (rows) => `Đã thay các dòng nháp bằng ${rows} dòng. Bảng điểm đã lưu chỉ đổi khi bạn bấm lưu.`,
  },
  en: {
    title: 'Transcript',
    lead: 'Enter every course you passed, are taking or were exempted from, as the student portal transcript lists it. Review each row, then save.',
    guides: 'School task guides',
    pdfTitle: 'PDF files cannot be read yet.',
    pdfText: 'No file is uploaded: paste your grades table from the student portal or enter each course by hand right in your browser.',
    replaceTitle: 'Saving replaces everything.',
    replaceText: 'Only the rows in this table are saved. A later save replaces the earlier one.',
    loading: 'Loading your transcript…',
    loadFailed: 'Could not load your transcript right now. Please try again in a moment.',
    retry: 'Try again',
    rowsCount: (rows) => `${rows} row${rows === 1 ? '' : 's'}`,
    toFix: (rows) => `${rows} to fix`,
    ready: 'ready to save',
    unchanged: 'no changes',
    diffSummary: (added, changed, removed) => `+${added} added / ~${changed} changed / -${removed} removed`,
    blockedNote: 'An incomplete row cannot be saved.',
    replaceNote: 'Saving replaces your whole saved transcript.',
    openPaste: 'Paste grades table',
    cancelChanges: 'Cancel changes',
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
    term: (year, number) => termName({ year, number }, 'en'),
    results: { graded: 'Graded', in_progress: 'In progress', exempt: 'Exempt', pass: 'Pass', fail: 'Fail' },
    pickResult: 'Pick a result',
    rowLabel: (n, code) => `row ${n}${code ? ` (${code})` : ''}`,
    fieldLabel: (field, row) => `${field}, ${row}`,
    removeRow: (row) => `Remove ${row}`,
    ok: 'Valid',
    needsFix: 'Fix:',
    needsFixShort: 'Needs fixing',
    notInCurriculum: 'Not in your curriculum',
    problems: { term: 'term', courseCode: 'code (2–20 letters or digits)', courseName: 'course name (at most 255 characters)', credits: 'credits (0–30)', result: 'result', grade: 'grade (0–10, one decimal)' },
    removed: (row) => `Removed ${row} from the table. Your saved transcript changes only when you save.`,
    noGrade: 'No grade',
    engineNote: 'The transcript only records results. Which group a course counts for, and which attempt counts, is decided by the rule engine in the degree audit.',
    leave: 'Your transcript has unsaved changes. Leave the page and discard them?',
    pasteTitle: 'Paste grades table',
    pasteLead: 'Copy grade rows from the student portal or a spreadsheet and paste them below. Parsing runs deterministically in your browser — nothing is sent to the server until you save.',
    pasteLabel: 'Grades table text',
    pastePlaceholder: '2024-1\tCSC10001\tIntroduction to Programming\t4\t8.5',
    pasteHint: 'Supports tab (TSV), pipe (|), or semicolon (;) columns: Term, Code, Course, Credits, Grade/Result.',
    pasteParsedCount: (rows) => `${rows} parsed row${rows === 1 ? '' : 's'}`,
    pasteErrorCount: (errors) => `${errors} line error${errors === 1 ? '' : 's'}`,
    pasteFixFirst: 'Fix or remove the lines with errors before loading into the review table.',
    pasteOverLimit: 'The row count exceeds the 300-row transcript limit.',
    pasteLineError: (line, reason) => `Line ${line}: ${reason}`,
    pasteReasons: {
      columns: 'wrong column count (expected 5–7 columns)',
      term: 'invalid term (for example 2024-1 or HK1 2024-2025)',
      courseCode: 'invalid course code (2–20 letters or digits)',
      courseName: 'blank or over-255-character course name',
      credits: 'invalid credits (0–30)',
      result: 'unrecognized result or grade token',
      grade: 'invalid grade (0–10, one decimal)',
    },
    pasteCancel: 'Cancel',
    pasteReplace: 'Replace draft rows',
    pasteAppend: 'Add to review table',
    pastedAdded: (rows) => `Added ${rows} row${rows === 1 ? '' : 's'} to the review table. Your saved transcript changes only when you save.`,
    pastedReplaced: (rows) => `Replaced draft rows with ${rows} row${rows === 1 ? '' : 's'}. Your saved transcript changes only when you save.`,
  },
};
