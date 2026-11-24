import type { Lang } from '../locale.js';
import type { PermissionKind } from './api.js';
import type { ConflictCode, Reference } from './errors.js';
import type { AdminSection } from './sections.js';

interface AdminMessages {
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
  save: string;
  saving: string;
  cancel: string;
  close: string;
  notRecorded: string;
  /** What a failed write means, each from the API's error code (ADR 0011). */
  problem: {
    validation: string;
    serverAnswered: string;
    cycle: (cycle: string[]) => string;
    permission: (permission: string | null) => string;
    deletionPending: string;
    notFound: string;
    conflict: Record<ConflictCode, string>;
    impact: string;
    rateLimited: string;
    refused: (status: number) => string;
    confirmed: string;
    notApplied: string;
    unknown: string;
  };
  reference: (reference: Reference) => string;
}

export const ADMIN_MESSAGES: Record<Lang, AdminMessages> = {
  vi: {
    title: 'Quản trị',
    lead: 'Nhập và sửa chương trình đào tạo theo văn bản chính thức của trường. Dữ liệu do người nhập và kiểm tra, không do AI trích xuất.',
    sections: 'Mục quản trị',
    sectionNames: { curriculum: 'Nhóm yêu cầu', catalog: 'Danh mục học phần', access: 'Phân quyền' },
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
    save: 'Lưu',
    saving: 'Đang lưu…',
    cancel: 'Hủy',
    close: 'Đóng',
    notRecorded: 'Chưa ghi nhận',
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
        referenced_item: 'Chưa gỡ được vì còn chỗ đang dùng mục này. Chưa đổi gì. Gỡ các chỗ sau trước:',
        last_access_manager: 'Đây là người quản lý phân quyền cuối cùng còn hoạt động. Cấp quyền này cho người khác trước khi thu hồi. Chưa đổi gì.',
        recipient_deletion_pending: 'Tài khoản đó đang chờ xóa nên không nhận quyền được. Chưa cấp gì.',
      },
      impact: 'Học phần này dùng chung cho nhiều chương trình đào tạo, nên cần xem lại ảnh hưởng trước khi lưu. Chưa lưu gì.',
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
        case 'other':
          return r.text;
      }
    },
  },
  en: {
    title: 'Administration',
    lead: "Enter and correct curricula from the school's official documents. People enter and check the data; no AI extracts it.",
    sections: 'Administration sections',
    sectionNames: { curriculum: 'Requirement groups', catalog: 'Course catalog', access: 'Access' },
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
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    close: 'Close',
    notRecorded: 'Not recorded',
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
        referenced_item: 'This cannot be removed while something still uses it. Nothing was changed. Clear these first:',
        last_access_manager: 'This is the last active access manager. Grant the permission to someone else before you revoke it. Nothing was changed.',
        recipient_deletion_pending: 'That account is waiting for deletion, so it cannot receive a permission. Nothing was granted.',
      },
      impact: 'Several curricula share this course, so its impact must be reviewed before saving. Nothing was saved.',
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
        case 'other':
          return r.text;
      }
    },
  },
};

export type AdminText = AdminMessages;
