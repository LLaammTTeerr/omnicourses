import { LANGUAGES, type Lang } from '../../locale.js';
import { BYTES_PER_MIB, IMPORT_MAX_BYTES, IMPORT_MAX_RECORDS, SIGNED_OUT_BODY_MAX_KIB } from '../api.js';
import type { ConflictCode, Reference } from '../errors.js';
import type { PermissionKind } from '../grants.js';
import type { AdminSection } from '../sections.js';

export const MAX_MIB = `${IMPORT_MAX_BYTES / BYTES_PER_MIB} MiB`;
export const maxRecords = (lang: Lang) => IMPORT_MAX_RECORDS.toLocaleString(LANGUAGES[lang].tag);

export interface SharedMessages {
  title: string;
  lead: string;
  sections: string;
  sectionNames: Record<AdminSection['id'], string>;
  permissions: Record<PermissionKind, string>;
  yourPermissions: string;
  programGrant: (program: string) => string;
  loading: string;
  grantsFailed: string;
  retry: string;
  reload: string;
  noPermissionTitle: string;
  noPermissionText: string;
  noPermissionHow: string;
  openSettings: string;
  sectionDenied: (permission: string) => string;
  refused: (permission: string | null) => string;
  refusedKept: string;
  refusedReload: string;
  stale: string;
  earlier: (where: string, outcome: string) => string;
  save: string;
  saving: string;
  cancel: string;
  close: string;
  notRecorded: string;
  anyOf: (names: string[]) => string;
  importRowError: (record: number, field: string | null, message: string) => string;
  problem: {
    validation: string;
    serverAnswered: string;
    cycle: (cycle: string[]) => string;
    permission: (permission: string | null) => string;
    deletionPending: string;
    notFound: string;
    conflict: Record<ConflictCode, string>;
    impact: string;
    file: string;
    reviewChanged: string;
    tooLarge: string;
    compressed: string;
    rateLimited: string;
    refused: (status: number) => string;
    confirmed: string;
    notApplied: string;
    unknown: string;
  };
  reference: (reference: Reference) => string;
}

export const SHARED_MESSAGES: Record<Lang, SharedMessages> = {
  vi: {
  title: 'Quản trị',
  lead: 'Nhập và sửa chương trình đào tạo theo văn bản chính thức của trường. Dữ liệu do người nhập và kiểm tra, không do AI trích xuất.',
  sections: 'Mục quản trị',
  sectionNames: { curriculum: 'Nhóm yêu cầu', calendar: 'Lịch năm học', catalog: 'Danh mục học phần', import: 'Nhập CSV', access: 'Phân quyền' },
  permissions: { program_admin: 'Quản trị chương trình', catalog_maintainer: 'Quản lý danh mục học phần', access_manager: 'Quản lý phân quyền' },
  yourPermissions: 'Quyền của bạn',
  programGrant: (program) => `Quản trị chương trình · ${program}`,
  loading: 'Đang tải…',
  grantsFailed: 'Chưa kiểm tra được quyền quản trị của bạn.',
  retry: 'Thử lại',
  reload: 'Tải lại dữ liệu',
  noPermissionTitle: 'Bạn không có quyền quản trị',
  noPermissionText: 'Trang này dành cho người quản trị chương trình, người quản lý danh mục học phần và người quản lý phân quyền. Tài khoản của bạn chưa được cấp quyền nào trong số đó.',
  noPermissionHow: 'Nếu bạn cần quyền, hãy gửi mã người dùng của bạn (ở trang Cài đặt) cho người quản lý phân quyền.',
  openSettings: 'Mở Cài đặt',
  sectionDenied: (permission) => `Mục này cần quyền “${permission}”. Tài khoản của bạn không có quyền đó.`,
  refused: (permission) =>
    permission ? `Lần lưu vừa rồi bị từ chối: thao tác đó cần quyền “${permission}”, mà tài khoản của bạn không có. Chưa lưu gì.` : 'Lần lưu vừa rồi bị từ chối vì tài khoản của bạn không có quyền làm thao tác đó. Chưa lưu gì.',
  refusedKept: 'Trang này được giữ nguyên để bạn chép lại những gì đã nhập.',
  refusedReload: 'Tải lại theo quyền hiện tại',
  stale: 'Chưa tải lại được dữ liệu đã lưu. Những gì đang hiện có thể đã cũ. Tải lại trước khi sửa tiếp.',
  earlier: (where, outcome) => `Về thao tác vừa gửi cho ${where}: ${outcome}`,
  save: 'Lưu',
  saving: 'Đang lưu…',
  cancel: 'Hủy',
  close: 'Đóng',
  notRecorded: 'Chưa ghi nhận',
  anyOf: (names) => names.join('” hoặc “'),
  importRowError: (record, field, message) => `Bản ghi ${record}${field ? `, cột ${field}` : ''}: ${message}`,
  problem: {
    validation: 'Máy chủ từ chối giá trị đã nhập. Chưa lưu gì.',
    serverAnswered: 'Máy chủ trả lời:',
    cycle: (cycle) => `Vòng tiên quyết: ${cycle.join(' → ')}. Mỗi học phần trong vòng cần học phần đứng sau nó, nên không học phần nào học được. Chưa lưu gì.`,
    permission: (permission) => (permission ? `Thao tác này cần quyền “${permission}”. Tài khoản của bạn không có quyền đó. Chưa lưu gì.` : 'Tài khoản của bạn không có quyền làm thao tác này. Chưa lưu gì.'),
    deletionPending: 'Tài khoản của bạn đang chờ xóa nên không quản trị được. Chưa lưu gì.',
    notFound: 'Không tìm thấy mục này. Có thể nó đã bị xóa, hoặc không thuộc chương trình này. Chưa lưu gì.',
    conflict: {
      duplicate_name: 'Khóa này đã có một nhóm yêu cầu cùng tên. Chưa lưu gì.',
      duplicate_code: 'Danh mục đã có học phần mang mã này. Chưa lưu gì.',
      duplicate_cohort: 'Chương trình này đã có khóa của năm này. Chưa lưu gì.',
      referenced_item: 'Chưa gỡ được vì còn chỗ đang dùng mục này. Chưa đổi gì. Gỡ các chỗ sau trước:',
      last_access_manager: 'Đây là người quản lý phân quyền cuối cùng còn hoạt động. Cấp quyền này cho người khác trước khi thu hồi. Chưa đổi gì.',
      recipient_deletion_pending: 'Tài khoản đó đang chờ xóa nên không nhận quyền được. Chưa cấp gì.',
    },
    impact: 'Học phần này dùng chung cho nhiều chương trình đào tạo, nên cần xem lại ảnh hưởng trước khi lưu. Chưa lưu gì.',
    file: 'Máy chủ không đọc được tệp này. Chưa lưu gì. Sửa tệp theo các lỗi sau:',
    reviewChanged: 'Tệp, hoặc dữ liệu đã lưu, đã đổi từ lúc xem trước. Chưa lưu gì. Xem trước lại rồi xác nhận lần nữa.',
    tooLarge: `Yêu cầu vượt giới hạn kích thước của máy chủ. Một tệp CSV được tối đa ${MAX_MIB} và ${maxRecords('vi')} bản ghi khi tài khoản có quyền nhập loại tệp đó; nếu không, một yêu cầu chỉ được tối đa ${SIGNED_OUT_BODY_MAX_KIB} KiB. Chia tệp thành nhiều tệp nhỏ hơn. Chưa lưu gì.`,
    compressed: 'Máy chủ không nhận yêu cầu đã nén. Chưa lưu gì.',
    rateLimited: 'Quá nhiều yêu cầu. Đợi một phút rồi thử lại. Chưa lưu gì.',
    refused: (status) => `Máy chủ từ chối yêu cầu (mã ${status}). Chưa lưu gì.`,
    confirmed: 'Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu có thay đổi này.',
    notApplied: 'Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu chưa có thay đổi này. Kiểm tra lại, rồi lưu lần nữa nếu cần.',
    unknown: 'Máy chủ không trả lời, và OmniCourse cũng chưa tải lại được dữ liệu đã lưu. Chưa rõ thay đổi đã được lưu hay chưa. Hãy tải lại dữ liệu trước khi thử lại.',
  },
  reference: (r) => {
    switch (r.kind) {
      case 'requires':
        return `${r.course} cần ${r.needs} làm tiên quyết`;
      case 'own_prerequisites':
        return `tiên quyết của ${r.course} đã được ghi nhận`;
      case 'own_terms':
        return `kỳ mở của ${r.course} đã được ghi nhận`;
      case 'links':
        return `nhóm còn học phần ${r.course}`;
      case 'linked_in':
        return `chương trình đào tạo ${r.curriculum} còn dùng học phần này`;
      case 'count':
        return {
          prerequisite_lists: `${r.count} chương trình đào tạo đã ghi nhận tiên quyết của học phần này`,
          required_by: `${r.count} học phần cần học phần này làm tiên quyết`,
          offering_terms: `${r.count} dòng kỳ mở ghi học phần này`,
          transcript_rows: `${r.count} dòng bảng điểm ghi học phần này`,
          plans: `${r.count} vị trí trong lộ trình đã lưu đặt học phần này`,
        }[r.what];
      case 'group_plans':
        return r.count === null ? 'có lộ trình đã lưu đang dùng nhóm này' : `${r.count} lộ trình đã lưu đang dùng nhóm này`;
      case 'other':
        return r.text;
    }
  },
  },
  en: {
  title: 'Administration',
  lead: "Enter and correct curricula from the school's official documents. People enter and check the data; no AI extracts it.",
  sections: 'Administration sections',
  sectionNames: { curriculum: 'Requirement groups', calendar: 'School calendar', catalog: 'Course catalog', import: 'CSV import', access: 'Access' },
  permissions: { program_admin: 'Program administrator', catalog_maintainer: 'Catalog maintainer', access_manager: 'Access manager' },
  yourPermissions: 'Your permissions',
  programGrant: (program) => `Program administrator · ${program}`,
  loading: 'Loading…',
  grantsFailed: 'Could not check your administration permissions.',
  retry: 'Try again',
  reload: 'Reload the data',
  noPermissionTitle: 'You have no administration permission',
  noPermissionText: 'This page is for program administrators, catalog maintainers and access managers. Your account holds none of those permissions.',
  noPermissionHow: 'If you need one, give your user ID (on the Settings page) to an access manager.',
  openSettings: 'Open Settings',
  sectionDenied: (permission) => `This section needs the “${permission}” permission. Your account does not hold it.`,
  refused: (permission) =>
    permission ? `The last save was refused: it needs the “${permission}” permission, which your account does not hold. Nothing was saved.` : 'The last save was refused, because your account may not do that. Nothing was saved.',
  refusedKept: 'This page is kept as it was, so that you can copy what you entered.',
  refusedReload: 'Reload with my current permissions',
  stale: 'Could not reload the saved data. What is shown may be out of date. Reload before you edit again.',
  earlier: (where, outcome) => `About the change just sent for ${where}: ${outcome}`,
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  notRecorded: 'Not recorded',
  anyOf: (names) => names.join('” or “'),
  importRowError: (record, field, message) => `Record ${record}${field ? `, column ${field}` : ''}: ${message}`,
  problem: {
    validation: 'The server refused the values entered. Nothing was saved.',
    serverAnswered: 'The server answered:',
    cycle: (cycle) => `Prerequisite cycle: ${cycle.join(' → ')}. Each course in the cycle requires the next one, so none of them could be taken. Nothing was saved.`,
    permission: (permission) => (permission ? `This needs the “${permission}” permission. Your account does not hold it. Nothing was saved.` : 'Your account may not do this. Nothing was saved.'),
    deletionPending: 'Your account is waiting for deletion, so it cannot administer. Nothing was saved.',
    notFound: 'This item was not found. It may have been deleted, or it is not part of this program. Nothing was saved.',
    conflict: {
      duplicate_name: 'This cohort already has a requirement group with this name. Nothing was saved.',
      duplicate_code: 'The catalog already has a course with this code. Nothing was saved.',
      duplicate_cohort: 'This program has a cohort of this year already. Nothing was saved.',
      referenced_item: 'This cannot be removed while something still uses it. Nothing was changed. Clear these first:',
      last_access_manager: 'This is the last active access manager. Grant the permission to someone else before you revoke it. Nothing was changed.',
      recipient_deletion_pending: 'That account is waiting for deletion, so it cannot receive a permission. Nothing was granted.',
    },
    impact: 'Several curricula share this course, so its impact must be reviewed before saving. Nothing was saved.',
    file: 'The server could not read this file. Nothing was saved. Correct the file at these places:',
    reviewChanged: 'The file or the saved data changed since the preview. Nothing was saved. Preview it again, then confirm again.',
    tooLarge: `The request is over a size limit of the server. A CSV file may have up to ${MAX_MIB} and ${maxRecords('en')} records when your account may import that type of file; otherwise a request may have only up to ${SIGNED_OUT_BODY_MAX_KIB} KiB. Split the file into smaller files. Nothing was saved.`,
    compressed: 'The server does not accept a compressed request. Nothing was saved.',
    rateLimited: 'Too many requests. Wait a minute, then try again. Nothing was saved.',
    refused: (status) => `The server refused the request (status ${status}). Nothing was saved.`,
    confirmed: 'The server did not answer the save, so OmniCourse reloaded the saved data. The saved data has this change.',
    notApplied: 'The server did not answer the save, so OmniCourse reloaded the saved data. The saved data does not have this change. Check it, then save again if needed.',
    unknown: 'The server did not answer, and OmniCourse could not reload the saved data either. It is not known whether the change was saved. Reload the data before you try again.',
  },
  reference: (r) => {
    switch (r.kind) {
      case 'requires':
        return `${r.course} requires ${r.needs}`;
      case 'own_prerequisites':
        return `the prerequisites of ${r.course} are recorded`;
      case 'own_terms':
        return `the offering terms of ${r.course} are recorded`;
      case 'links':
        return `the group still has the course ${r.course}`;
      case 'linked_in':
        return `the curriculum ${r.curriculum} still uses this course`;
      case 'count':
        return {
          prerequisite_lists: `${r.count} ${r.count === 1 ? 'curriculum records' : 'curricula record'} the prerequisites of this course`,
          required_by: `${r.count} ${r.count === 1 ? 'course requires' : 'courses require'} this course`,
          offering_terms: `${r.count} offering-term ${r.count === 1 ? 'row names' : 'rows name'} this course`,
          transcript_rows: `${r.count} transcript ${r.count === 1 ? 'row names' : 'rows name'} this course`,
          plans: `${r.count} ${r.count === 1 ? 'place in a saved plan holds' : 'places in saved plans hold'} this course`,
        }[r.what];
      case 'group_plans':
        return r.count === null ? 'saved plans use this group' : `${r.count} ${r.count === 1 ? 'saved plan uses' : 'saved plans use'} this group`;
      case 'other':
        return r.text;
    }
  },
  },
};
