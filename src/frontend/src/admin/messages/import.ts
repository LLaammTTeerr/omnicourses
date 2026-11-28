import type { Lang } from '../../locale.js';
import type { ImportFileType } from '../api.js';
import { MAX_MIB, maxRecords } from './shared.js';

export interface ImportMessages {
  heading: string;
  lead: string;
  typeLegend: string;
  types: Record<ImportFileType, string>;
  typeHints: Record<ImportFileType, string>;
  target: string;
  programsFailed: string;
  noPrograms: string;
  noCohort: string;
  template: string;
  templateHint: string;
  copyHeader: string;
  headerCopied: string;
  headerNotCopied: string;
  downloadTemplate: string;
  file: string;
  fileHint: string;
  fileChosen: (name: string, size: string) => string;
  notUtf8: string;
  unreadable: string;
  tooBig: (size: string) => string;
  tooMany: (count: number) => string;
  preview: string;
  previewing: string;
  previewFailed: string;
  previewTitle: string;
  summary: (inserts: number, updates: number, noOps: number) => string;
  errorsTitle: (count: number) => string;
  errorsNote: string;
  errorColumns: { record: string; field: string; message: string };
  wholeRecord: string;
  rowsTitle: (count: number) => string;
  columns: { record: string; action: string; code: string; name: string; credits: string; changes: string; group: string; course: string };
  actions: { insert: string; update: string; no_op: string };
  change: (field: string, from: string, to: string) => string;
  affectedTitle: (count: number) => string;
  affectedLead: string;
  nothingToSave: string;
  confirmLead: string;
  confirm: string;
  cancel: string;
  cancelled: string;
  saved: (inserts: number, updates: number) => string;
  reviewChanged: string;
}

export const IMPORT_MESSAGES: Record<Lang, ImportMessages> = {
  vi: {
    heading: 'Nhập từ tệp CSV',
    lead: 'Tệp được đọc trong trình duyệt rồi gửi lên để xem trước. Chưa lưu gì cho đến khi bạn xác nhận. Máy chủ không giữ tệp.',
    typeLegend: 'Loại tệp',
    types: { catalog_courses: 'Học phần của danh mục dùng chung', group_links: 'Học phần của các nhóm yêu cầu trong một khóa' },
    typeHints: {
      catalog_courses: 'Thêm học phần mới, hoặc sửa học phần đã có theo mã. Sửa một học phần dùng chung sẽ đổi mọi chương trình đào tạo dùng nó.',
      group_links: 'Thêm học phần đã có trong danh mục vào nhóm, theo đúng tên nhóm của khóa đã chọn. Tệp không tạo nhóm, không tạo học phần và không gỡ gì.',
    },
    target: 'Nhập vào',
    programsFailed: 'Chưa tải được các chương trình bạn quản trị.',
    noPrograms: 'Bạn chưa quản trị chương trình nào.',
    noCohort: 'Chương trình này chưa có khóa nào để nhập vào.',
    template: 'Tiêu đề của tệp',
    templateHint: 'Dòng đầu của tệp phải đúng như sau. Mỗi dòng tiếp theo là một bản ghi.',
    copyHeader: 'Chép tiêu đề',
    headerCopied: 'Đã chép tiêu đề.',
    headerNotCopied: 'Chưa chép được. Tiêu đề đã được chọn: bấm Ctrl+C để chép.',
    downloadTemplate: 'Tải tệp mẫu',
    file: 'Tệp CSV',
    fileHint: `Văn bản UTF-8, phân cách bằng dấu phẩy. Tối đa ${MAX_MIB} và ${maxRecords('vi')} bản ghi.`,
    fileChosen: (name, size) => `Đã đọc ${name} (${size}).`,
    notUtf8: 'Tệp này không phải văn bản UTF-8. Lưu lại tệp dưới dạng “CSV UTF-8” rồi chọn lại. Chưa gửi gì.',
    unreadable: 'Chưa đọc được tệp này. Chọn lại tệp. Chưa gửi gì.',
    tooBig: (size) => `Tệp nặng ${size}, quá ${MAX_MIB}. Chia thành nhiều tệp nhỏ hơn. Chưa gửi gì.`,
    tooMany: (count) => `Tệp có ${count} bản ghi, quá ${maxRecords('vi')}. Chia thành nhiều tệp nhỏ hơn. Chưa gửi gì.`,
    preview: 'Xem trước',
    previewing: 'Đang xem trước…',
    previewFailed: 'Chưa xem trước được: máy chủ không trả lời. Thử lại.',
    previewTitle: 'Xem trước',
    summary: (inserts, updates, noOps) => `${inserts} thêm mới · ${updates} cập nhật · ${noOps} không đổi`,
    errorsTitle: (count) => `Tệp có ${count} lỗi. Chưa lưu gì: sửa tệp rồi chọn lại.`,
    errorsNote: 'Dòng tiêu đề là bản ghi 1, như số hàng trong bảng tính. Lời báo lỗi do máy chủ viết bằng tiếng Anh.',
    errorColumns: { record: 'Bản ghi', field: 'Cột', message: 'Lỗi' },
    wholeRecord: 'Cả bản ghi',
    rowsTitle: (count) => `${count} bản ghi hợp lệ`,
    columns: { record: 'Bản ghi', action: 'Sẽ làm', code: 'Mã', name: 'Tên', credits: 'TC', changes: 'Thay đổi', group: 'Nhóm', course: 'Học phần' },
    actions: { insert: 'Thêm mới', update: 'Cập nhật', no_op: 'Không đổi' },
    change: (field, from, to) => `${field}: ${from} → ${to}`,
    affectedTitle: (count) => `${count} chương trình đào tạo sẽ đọc giá trị mới`,
    affectedLead: 'Các học phần được cập nhật dùng chung cho những chương trình đào tạo sau. Đối chiếu văn bản chính thức trước khi xác nhận.',
    nothingToSave: 'Mọi bản ghi đều giống dữ liệu đã lưu. Không có gì để lưu.',
    confirmLead: 'Xác nhận lưu cả tệp trong một lần. Nếu dữ liệu đã đổi từ lúc xem trước, máy chủ không lưu gì và OmniCourse xem trước lại.',
    confirm: 'Xác nhận và lưu',
    cancel: 'Hủy',
    cancelled: 'Đã bỏ tệp. Chưa lưu gì.',
    saved: (inserts, updates) => `Đã lưu tệp: ${inserts} thêm mới, ${updates} cập nhật.`,
    reviewChanged: 'Từ lúc xem trước, tệp hoặc dữ liệu đã lưu đã đổi. Chưa lưu gì. Kết quả dưới đây là bản xem trước mới: xem lại rồi xác nhận lần nữa.',
  },
  en: {
    heading: 'Import from a CSV file',
    lead: 'The file is read in your browser and sent for a preview. Nothing is saved until you confirm. The server does not keep the file.',
    typeLegend: 'File type',
    types: { catalog_courses: 'Courses of the shared catalog', group_links: 'Courses of the requirement groups of one cohort' },
    typeHints: {
      catalog_courses: 'Adds new courses, or corrects existing ones by code. Correcting a shared course changes every curriculum that uses it.',
      group_links: 'Adds courses already in the catalog to groups, by the exact group names of the chosen cohort. The file creates no group and no course, and removes nothing.',
    },
    target: 'Import into',
    programsFailed: 'Could not load the programs you administer.',
    noPrograms: 'You administer no program yet.',
    noCohort: 'This program has no cohort to import into yet.',
    template: 'Header of the file',
    templateHint: 'The first line of the file must be exactly this. Each line after it is one record.',
    copyHeader: 'Copy the header',
    headerCopied: 'Copied the header.',
    headerNotCopied: 'Could not copy it. The header is selected: press Ctrl+C to copy it.',
    downloadTemplate: 'Download a template',
    file: 'CSV file',
    fileHint: `UTF-8 text, separated by commas. At most ${MAX_MIB} and ${maxRecords('en')} records.`,
    fileChosen: (name, size) => `Read ${name} (${size}).`,
    notUtf8: 'This file is not UTF-8 text. Save it again as “CSV UTF-8”, then choose it again. Nothing was sent.',
    unreadable: 'Could not read this file. Choose it again. Nothing was sent.',
    tooBig: (size) => `The file is ${size}, over ${MAX_MIB}. Split it into smaller files. Nothing was sent.`,
    tooMany: (count) => `The file has ${count} records, over ${maxRecords('en')}. Split it into smaller files. Nothing was sent.`,
    preview: 'Preview',
    previewing: 'Previewing…',
    previewFailed: 'Could not preview: the server did not answer. Try again.',
    previewTitle: 'Preview',
    summary: (inserts, updates, noOps) => `${inserts} new · ${updates} changed · ${noOps} unchanged`,
    errorsTitle: (count) => (count === 1 ? 'The file has 1 error. Nothing was saved: correct the file, then choose it again.' : `The file has ${count} errors. Nothing was saved: correct the file, then choose it again.`),
    errorsNote: 'The header is record 1, like the row numbers of a spreadsheet. The server writes the error messages.',
    errorColumns: { record: 'Record', field: 'Column', message: 'Error' },
    wholeRecord: 'Whole record',
    rowsTitle: (count) => (count === 1 ? '1 valid record' : `${count} valid records`),
    columns: { record: 'Record', action: 'Will', code: 'Code', name: 'Name', credits: 'Credits', changes: 'Changes', group: 'Group', course: 'Course' },
    actions: { insert: 'Add', update: 'Change', no_op: 'Unchanged' },
    change: (field, from, to) => `${field}: ${from} → ${to}`,
    affectedTitle: (count) => (count === 1 ? '1 curriculum will read new values' : `${count} curricula will read new values`),
    affectedLead: 'The changed courses are shared by the curricula below. Check the official documents before you confirm.',
    nothingToSave: 'Every record is the same as the saved data. There is nothing to save.',
    confirmLead: 'Confirming saves the whole file at once. If the data changed since the preview, the server saves nothing and OmniCourse previews it again.',
    confirm: 'Confirm and save',
    cancel: 'Cancel',
    cancelled: 'Dropped the file. Nothing was saved.',
    saved: (inserts, updates) => `Saved the file: ${inserts} new, ${updates} changed.`,
    reviewChanged: 'The file or the saved data changed since the preview. Nothing was saved. Below is a new preview: review it, then confirm again.',
  },
};
