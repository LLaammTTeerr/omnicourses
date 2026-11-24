import type { RequirementGroupKind } from '../curriculum/api.js';
import type { Lang } from '../locale.js';
import type { PermissionKind } from './api.js';
import type { ConflictCode, Reference } from './errors.js';
import type { CourseField } from './forms.js';
import type { AdminSection } from './sections.js';

/** The curriculum editor: requirement groups, their courses, prerequisites and offering terms (program grant). */
interface CurriculumMessages {
  heading: string;
  program: string;
  cohort: string;
  cohortOption: (year: number) => string;
  programsFailed: string;
  noPrograms: string;
  noCohorts: string;
  thisCohortOnly: string;
  loadFailed: string;
  noCurriculum: string;
  stale: string;
  groupsTitle: (count: number) => string;
  addGroup: string;
  columns: { group: string; kind: string; credits: string; notes: string; courses: string; actions: string };
  kinds: Record<RequirementGroupKind, string>;
  creditsTotal: (credits: number) => string;
  creditsMin: (credits: number) => string;
  totalsReadOnly: string;
  open: string;
  opened: string;
  openLabel: (group: string) => string;
  edit: string;
  editGroupLabel: (group: string) => string;
  delete: string;
  deleteGroupLabel: (group: string) => string;
  noGroups: string;
  groupNew: string;
  groupEdit: (group: string) => string;
  groupName: string;
  groupNameHint: string;
  groupKind: string;
  groupKindHint: string;
  groupNotes: string;
  groupNotesHint: string;
  groupCreated: (group: string) => string;
  groupSaved: (group: string) => string;
  groupDeleted: (group: string) => string;
  noChange: string;
  deleteGroupTitle: string;
  deleteGroupBody: (group: string) => string;
  coursesIn: (group: string, count: number) => string;
  linkLabel: string;
  linkSubmit: string;
  linkHint: string;
  linkNotFound: string;
  linked: (course: string, group: string) => string;
  courseColumns: { code: string; name: string; credits: string; prerequisites: string; terms: string; actions: string };
  noPrerequisite: string;
  term: (number: number) => string;
  editPrerequisites: string;
  editPrerequisitesLabel: (course: string) => string;
  editTerms: string;
  editTermsLabel: (course: string) => string;
  unlink: string;
  unlinkLabel: (course: string) => string;
  noCourses: string;
  unlinkTitle: (course: string) => string;
  unlinkBody: (course: string, group: string) => string;
  unlinked: (course: string) => string;
  prerequisitesTitle: (course: string) => string;
  prerequisitesLead: string;
  prerequisitesLegend: string;
  stateNotRecorded: string;
  stateNone: string;
  stateList: string;
  prerequisiteCodes: string;
  prerequisiteCodesHint: string;
  prerequisiteCodesNeeded: string;
  prerequisitesSaved: (course: string) => string;
  prerequisitesCleared: (course: string) => string;
  termsTitle: (course: string) => string;
  termsLead: string;
  termsLegend: string;
  termsHint: string;
  termsSaved: (course: string) => string;
  termsCleared: (course: string) => string;
}

/** The shared course catalog (catalog maintainer, UC-11 A8). */
interface CatalogMessages {
  heading: string;
  shared: string;
  find: string;
  add: string;
  lookupHint: string;
  notFound: (code: string) => string;
  notFoundAdd: string;
  lookupFailed: string;
  fields: Record<CourseField, string>;
  blank: string;
  usedIn: string;
  usedInNone: string;
  membership: (program: string, year: number, group: string) => string;
  edit: string;
  editLabel: (course: string) => string;
  delete: string;
  deleteLabel: (course: string) => string;
  dialogNew: string;
  dialogEdit: (course: string) => string;
  codeHint: string;
  codeFixed: string;
  nameEnHint: string;
  periodsHintNew: string;
  periodsHintEdit: string;
  sharedWarningTitle: string;
  sharedWarningText: (curricula: string) => string;
  created: (course: string) => string;
  saved: (course: string) => string;
  deleted: (course: string) => string;
  noChange: string;
  deleteTitle: (course: string) => string;
  deleteBody: (course: string) => string;
  reviewTitle: string;
  reviewLead: string;
  reviewChanged: string;
  reviewChanges: string;
  reviewField: string;
  reviewOld: string;
  reviewNew: string;
  reviewAffected: (count: number) => string;
  affected: (program: string, year: number, curriculum: string) => string;
  reviewBack: string;
  reviewConfirm: string;
}

/** Grants and revocations by user ID (access manager). */
interface AccessMessages {
  heading: string;
  lead: string;
  userId: string;
  find: string;
  hint: string;
  noAccount: string;
  badUserId: string;
  lookupFailed: string;
  grantsOf: string;
  ownAccount: string;
  programs: string;
  noProgramGrants: string;
  columns: { program: string; grantedAt: string; grantedBy: string; actions: string; permission: string; status: string };
  noGranter: string;
  program: string;
  pickProgram: string;
  grantProgram: string;
  programsFailed: string;
  global: string;
  describe: Record<PermissionKind, string>;
  held: (when: string) => string;
  notHeld: string;
  grant: string;
  grantLabel: (permission: string) => string;
  revoke: string;
  revokeLabel: (permission: string) => string;
  programPermission: (program: string) => string;
  granted: (permission: string) => string;
  revoked: (permission: string) => string;
  revokeTitle: string;
  revokeBody: (permission: string) => string;
  revokeOwn: string;
}

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
  curriculum: CurriculumMessages;
  catalog: CatalogMessages;
  access: AccessMessages;
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
    curriculum: {
      heading: 'Nhóm yêu cầu và học phần của một khóa',
      program: 'Chương trình',
      cohort: 'Khóa',
      cohortOption: (year) => `Khóa ${year}`,
      programsFailed: 'Chưa tải được các chương trình bạn quản trị.',
      noPrograms: 'Bạn chưa được cấp quyền quản trị chương trình nào.',
      noCohorts: 'Chương trình này chưa có khóa nào. Trang này chưa thêm khóa được.',
      thisCohortOnly: 'Sửa ở đây chỉ đổi khóa này. Các khóa khác không bị ảnh hưởng.',
      loadFailed: 'Chưa tải được chương trình đào tạo của khóa này.',
      noCurriculum: 'Khóa này chưa có chương trình đào tạo.',
      stale: 'Chưa tải lại được dữ liệu đã lưu. Những gì đang hiện có thể đã cũ.',
      groupsTitle: (count) => `${count} nhóm yêu cầu`,
      addGroup: 'Thêm nhóm',
      columns: { group: 'Nhóm', kind: 'Loại', credits: 'TC yêu cầu', notes: 'Ghi chú quy tắc', courses: 'Học phần', actions: 'Thao tác' },
      kinds: { compulsory: 'Bắt buộc', elective: 'Tự chọn' },
      creditsTotal: (credits) => `${credits} TC`,
      creditsMin: (credits) => `Tối thiểu ${credits} TC`,
      totalsReadOnly: 'Số tín chỉ yêu cầu của nhóm chỉ để xem: trang này chưa sửa được.',
      open: 'Mở',
      opened: 'Đang mở',
      openLabel: (group) => `Mở nhóm ${group}`,
      edit: 'Sửa',
      editGroupLabel: (group) => `Sửa nhóm ${group}`,
      delete: 'Xóa',
      deleteGroupLabel: (group) => `Xóa nhóm ${group}`,
      noGroups: 'Khóa này chưa có nhóm yêu cầu nào.',
      groupNew: 'Nhóm yêu cầu mới',
      groupEdit: (group) => `Sửa nhóm ${group}`,
      groupName: 'Tên nhóm',
      groupNameHint: 'Ghi đúng tiêu đề in trong văn bản chính thức. Mỗi nhóm của một khóa có tên riêng.',
      groupKind: 'Loại nhóm',
      groupKindHint: 'Bắt buộc: mọi học phần của nhóm đều phải đạt. Tự chọn: sinh viên chọn học phần trong nhóm.',
      groupNotes: 'Ghi chú quy tắc',
      groupNotesHint: 'Chép nguyên văn quy tắc in trong văn bản, nếu có. Để trống nếu không có.',
      groupCreated: (group) => `Đã thêm nhóm ${group}.`,
      groupSaved: (group) => `Đã lưu nhóm ${group}.`,
      groupDeleted: (group) => `Đã xóa nhóm ${group}.`,
      noChange: 'Không có gì thay đổi, nên chưa gửi gì.',
      deleteGroupTitle: 'Xóa nhóm này?',
      deleteGroupBody: (group) => `Nhóm “${group}” sẽ bị xóa khỏi khóa này. Máy chủ chỉ xóa nhóm không còn học phần nào.`,
      coursesIn: (group, count) => `${group} · ${count} học phần`,
      linkLabel: 'Mã học phần',
      linkSubmit: 'Thêm học phần vào nhóm',
      linkHint: 'Nhập mã của một học phần đã có trong danh mục, ví dụ CS101. Học phần mới do người quản lý danh mục tạo.',
      linkNotFound: 'Không tìm thấy: danh mục không có học phần mang mã này, hoặc nhóm này vừa bị xóa. Học phần mới do người quản lý danh mục tạo trước. Chưa lưu gì.',
      linked: (course, group) => `Đã thêm ${course} vào nhóm ${group}.`,
      courseColumns: { code: 'Mã', name: 'Tên', credits: 'TC', prerequisites: 'Tiên quyết', terms: 'Kỳ mở', actions: 'Thao tác' },
      noPrerequisite: 'Không có tiên quyết',
      term: (number) => `HK${number}`,
      editPrerequisites: 'Tiên quyết',
      editPrerequisitesLabel: (course) => `Sửa tiên quyết của ${course}`,
      editTerms: 'Kỳ mở',
      editTermsLabel: (course) => `Sửa kỳ mở của ${course}`,
      unlink: 'Bỏ khỏi nhóm',
      unlinkLabel: (course) => `Bỏ ${course} khỏi nhóm`,
      noCourses: 'Nhóm này chưa có học phần nào.',
      unlinkTitle: (course) => `Bỏ ${course} khỏi nhóm này?`,
      unlinkBody: (course, group) => `${course} sẽ rời nhóm “${group}”. Học phần vẫn còn trong danh mục và trong các nhóm khác.`,
      unlinked: (course) => `Đã bỏ ${course} khỏi nhóm. Học phần vẫn còn trong danh mục.`,
      prerequisitesTitle: (course) => `Tiên quyết của ${course}`,
      prerequisitesLead: 'Ghi đúng theo văn bản chính thức. “Chưa ghi nhận” nghĩa là chưa biết. “Không có tiên quyết” là một điều đã được ghi nhận.',
      prerequisitesLegend: 'Tiên quyết trong khóa này',
      stateNotRecorded: 'Chưa ghi nhận (chưa biết)',
      stateNone: 'Không có tiên quyết',
      stateList: 'Có tiên quyết',
      prerequisiteCodes: 'Mã các học phần tiên quyết',
      prerequisiteCodesHint: 'Cách nhau bằng dấu phẩy hoặc khoảng trắng, ví dụ CS161, MTH251. Mọi học phần trong danh sách đều phải đạt trước. Máy chủ kiểm tra từng mã thuộc khóa này và từ chối vòng tiên quyết.',
      prerequisiteCodesNeeded: 'Nhập ít nhất một mã, hoặc chọn “Không có tiên quyết”.',
      prerequisitesSaved: (course) => `Đã lưu tiên quyết của ${course}.`,
      prerequisitesCleared: (course) => `Tiên quyết của ${course} trở về “Chưa ghi nhận”.`,
      termsTitle: (course) => `Kỳ mở của ${course}`,
      termsLead: 'Đánh dấu các học kỳ mà văn bản chính thức ghi học phần này được mở trong khóa này.',
      termsLegend: 'Học kỳ mở',
      termsHint: 'Không đánh dấu học kỳ nào thì kỳ mở trở về “Chưa ghi nhận”.',
      termsSaved: (course) => `Đã lưu kỳ mở của ${course}.`,
      termsCleared: (course) => `Kỳ mở của ${course} trở về “Chưa ghi nhận”.`,
    },
    catalog: {
      heading: 'Danh mục học phần dùng chung',
      shared: 'Sửa ở đây áp dụng cho mọi chương trình đào tạo có học phần đó.',
      find: 'Tìm',
      add: 'Thêm học phần',
      lookupHint: 'Danh mục chưa có trang liệt kê hay tìm theo tên. Nhập đúng mã của học phần.',
      notFound: (code) => `Danh mục không có học phần mang mã ${code}.`,
      notFoundAdd: 'Bấm “Thêm học phần” để tạo học phần mới với mã này.',
      lookupFailed: 'Chưa tải được học phần.',
      fields: {
        code: 'Mã học phần',
        nameVi: 'Tên tiếng Việt',
        nameEn: 'Tên tiếng Anh',
        credits: 'Tín chỉ',
        theoryPeriods: 'Tiết lý thuyết (LT)',
        labPeriods: 'Tiết thực hành (TH)',
        exercisePeriods: 'Tiết bài tập (BT)',
        projectPeriods: 'Tiết đồ án (ĐT)',
      },
      blank: 'Để trống',
      usedIn: 'Dùng trong',
      usedInNone: 'Chưa có chương trình đào tạo nào dùng học phần này.',
      membership: (program, year, group) => `${program} · Khóa ${year} · ${group}`,
      edit: 'Sửa',
      editLabel: (course) => `Sửa học phần ${course}`,
      delete: 'Xóa',
      deleteLabel: (course) => `Xóa học phần ${course}`,
      dialogNew: 'Học phần mới',
      dialogEdit: (course) => `Sửa học phần ${course}`,
      codeHint: 'Chữ in hoa và số, 2 đến 20 ký tự, ví dụ CS101. Mã không đổi được sau khi tạo.',
      codeFixed: 'Mã không đổi được ở đây.',
      nameEnHint: 'Để trống nếu văn bản chính thức không có tên tiếng Anh.',
      periodsHintNew: 'Số tiết theo bảng chính thức. Ô để trống được lưu là 0.',
      periodsHintEdit: 'Số tiết theo bảng chính thức. Xóa trống một ô để ghi rằng bảng để trống ô đó.',
      sharedWarningTitle: 'Sửa ở đây đổi mọi chương trình đào tạo dùng học phần này',
      sharedWarningText: (curricula) => `Đang dùng: ${curricula}. Đối chiếu văn bản chính thức trước khi lưu.`,
      created: (course) => `Đã thêm học phần ${course} vào danh mục.`,
      saved: (course) => `Đã lưu học phần ${course}.`,
      deleted: (course) => `Đã xóa học phần ${course} khỏi danh mục.`,
      noChange: 'Không có gì thay đổi, nên chưa gửi gì.',
      deleteTitle: (course) => `Xóa học phần ${course}?`,
      deleteBody: (course) =>
        `${course} sẽ bị xóa khỏi danh mục dùng chung. Máy chủ chỉ xóa học phần không còn nơi nào dùng: chương trình đào tạo, tiên quyết, kỳ mở, bảng điểm và lộ trình đã lưu.`,
      reviewTitle: 'Xem lại ảnh hưởng trước khi lưu',
      reviewLead: 'Các chương trình đào tạo dưới đây dùng chung học phần này và sẽ đọc giá trị mới. Đối chiếu văn bản chính thức rồi xác nhận. Chưa lưu gì cho đến khi bạn xác nhận.',
      reviewChanged: 'Giá trị của học phần, hoặc danh sách chương trình đào tạo dùng nó, đã đổi từ lúc bạn xem. Chưa lưu gì. Xem lại danh sách mới rồi xác nhận lần nữa.',
      reviewChanges: 'Thay đổi',
      reviewField: 'Trường',
      reviewOld: 'Hiện tại',
      reviewNew: 'Mới',
      reviewAffected: (count) => `${count} chương trình đào tạo bị ảnh hưởng`,
      affected: (program, year, curriculum) => `${program} · Khóa ${year} (${curriculum})`,
      reviewBack: 'Quay lại sửa',
      reviewConfirm: 'Xác nhận và lưu',
    },
    access: {
      heading: 'Phân quyền quản trị',
      lead: 'Cấp và thu hồi quyền theo mã người dùng.',
      userId: 'Mã người dùng',
      find: 'Tìm',
      hint: 'Người cần quyền sao chép mã người dùng của họ ở trang Cài đặt rồi gửi cho bạn. Không tìm được theo tên hay email.',
      noAccount: 'Không có tài khoản nào mang mã này.',
      badUserId: 'Máy chủ không nhận mã này.',
      lookupFailed: 'Chưa tải được quyền của người dùng này.',
      grantsOf: 'Quyền của người dùng',
      ownAccount: 'Tài khoản của bạn',
      programs: 'Quản trị chương trình',
      noProgramGrants: 'Người dùng này chưa quản trị chương trình nào.',
      columns: { program: 'Chương trình', grantedAt: 'Cấp lúc', grantedBy: 'Người cấp', actions: 'Thao tác', permission: 'Quyền', status: 'Trạng thái' },
      noGranter: 'Không ghi (thiết lập ban đầu, hoặc tài khoản đã xóa)',
      program: 'Chương trình',
      pickProgram: 'Chọn chương trình',
      grantProgram: 'Cấp quyền quản trị chương trình',
      programsFailed: 'Chưa tải được danh sách chương trình.',
      global: 'Quyền chung',
      describe: {
        program_admin: 'Sửa nhóm yêu cầu, học phần của nhóm, tiên quyết và kỳ mở của một chương trình được cấp. Không sửa danh mục, không cấp quyền.',
        catalog_maintainer: 'Tạo học phần trong danh mục dùng chung, sửa học phần sau khi xem lại ảnh hưởng, xóa học phần không còn nơi nào dùng. Không sửa chương trình, không cấp quyền.',
        access_manager: 'Cấp và thu hồi cả ba loại quyền, kể cả quyền này. Không tự có quyền sửa chương trình hay danh mục.',
      },
      held: (when) => `Đang có · cấp lúc ${when}`,
      notHeld: 'Chưa có',
      grant: 'Cấp',
      grantLabel: (permission) => `Cấp quyền ${permission}`,
      revoke: 'Thu hồi',
      revokeLabel: (permission) => `Thu hồi quyền ${permission}`,
      programPermission: (program) => `Quản trị chương trình ${program}`,
      granted: (permission) => `Đã cấp quyền “${permission}”.`,
      revoked: (permission) => `Đã thu hồi quyền “${permission}”.`,
      revokeTitle: 'Thu hồi quyền này?',
      revokeBody: (permission) => `Người dùng này sẽ mất quyền “${permission}”. Lần ghi tiếp theo của họ cần quyền đó sẽ bị từ chối.`,
      revokeOwn: 'Đây là tài khoản của bạn: bạn sẽ mất quyền này ngay.',
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
    curriculum: {
      heading: 'Requirement groups and courses of one cohort',
      program: 'Program',
      cohort: 'Cohort',
      cohortOption: (year) => `Cohort ${year}`,
      programsFailed: 'Could not load the programs you administer.',
      noPrograms: 'You hold no program administrator grant.',
      noCohorts: 'This program has no cohort yet. This page cannot add one.',
      thisCohortOnly: 'An edit here changes this cohort only. Other cohorts are not affected.',
      loadFailed: 'Could not load the curriculum of this cohort.',
      noCurriculum: 'This cohort has no curriculum yet.',
      stale: 'Could not reload the saved data. What is shown may be out of date.',
      groupsTitle: (count) => (count === 1 ? '1 requirement group' : `${count} requirement groups`),
      addGroup: 'Add group',
      columns: { group: 'Group', kind: 'Kind', credits: 'Credits required', notes: 'Rule notes', courses: 'Courses', actions: 'Actions' },
      kinds: { compulsory: 'Compulsory', elective: 'Elective' },
      creditsTotal: (credits) => `${credits} cr`,
      creditsMin: (credits) => `At least ${credits} cr`,
      totalsReadOnly: "A group's required credits are shown only: this page cannot change them yet.",
      open: 'Open',
      opened: 'Open now',
      openLabel: (group) => `Open the group ${group}`,
      edit: 'Edit',
      editGroupLabel: (group) => `Edit the group ${group}`,
      delete: 'Delete',
      deleteGroupLabel: (group) => `Delete the group ${group}`,
      noGroups: 'This cohort has no requirement group yet.',
      groupNew: 'New requirement group',
      groupEdit: (group) => `Edit the group ${group}`,
      groupName: 'Group name',
      groupNameHint: 'Enter the heading exactly as the official document prints it. Each group of a cohort has its own name.',
      groupKind: 'Kind of group',
      groupKindHint: 'Compulsory: every course of the group must be passed. Elective: the student chooses courses in the group.',
      groupNotes: 'Rule notes',
      groupNotesHint: 'Copy the printed rule word for word, if there is one. Leave empty if there is none.',
      groupCreated: (group) => `Added the group ${group}.`,
      groupSaved: (group) => `Saved the group ${group}.`,
      groupDeleted: (group) => `Deleted the group ${group}.`,
      noChange: 'Nothing changed, so nothing was sent.',
      deleteGroupTitle: 'Delete this group?',
      deleteGroupBody: (group) => `The group “${group}” will be deleted from this cohort. The server deletes only a group that has no course left.`,
      coursesIn: (group, count) => `${group} · ${count === 1 ? '1 course' : `${count} courses`}`,
      linkLabel: 'Course code',
      linkSubmit: 'Add course to group',
      linkHint: 'Enter the code of a course the catalog already has, such as CS101. A catalog maintainer creates new courses.',
      linkNotFound: 'Not found: the catalog has no course with this code, or this group was just deleted. A catalog maintainer creates a new course first. Nothing was saved.',
      linked: (course, group) => `Added ${course} to the group ${group}.`,
      courseColumns: { code: 'Code', name: 'Name', credits: 'Cr', prerequisites: 'Prerequisites', terms: 'Offering terms', actions: 'Actions' },
      noPrerequisite: 'No prerequisite',
      term: (number) => `Term ${number}`,
      editPrerequisites: 'Prerequisites',
      editPrerequisitesLabel: (course) => `Edit the prerequisites of ${course}`,
      editTerms: 'Offering terms',
      editTermsLabel: (course) => `Edit the offering terms of ${course}`,
      unlink: 'Remove from group',
      unlinkLabel: (course) => `Remove ${course} from the group`,
      noCourses: 'This group has no course yet.',
      unlinkTitle: (course) => `Remove ${course} from this group?`,
      unlinkBody: (course, group) => `${course} will leave the group “${group}”. The course stays in the catalog and in its other groups.`,
      unlinked: (course) => `Removed ${course} from the group. The course is still in the catalog.`,
      prerequisitesTitle: (course) => `Prerequisites of ${course}`,
      prerequisitesLead: 'Record what the official document says. “Not recorded” means unknown. “No prerequisite” is a recorded fact.',
      prerequisitesLegend: 'Prerequisites in this cohort',
      stateNotRecorded: 'Not recorded (unknown)',
      stateNone: 'No prerequisite',
      stateList: 'Has prerequisites',
      prerequisiteCodes: 'Codes of the prerequisite courses',
      prerequisiteCodesHint: 'Separate them with commas or spaces, such as CS161, MTH251. Every listed course must be passed first. The server checks that each code is in this cohort and refuses a prerequisite cycle.',
      prerequisiteCodesNeeded: 'Enter at least one code, or choose “No prerequisite”.',
      prerequisitesSaved: (course) => `Saved the prerequisites of ${course}.`,
      prerequisitesCleared: (course) => `The prerequisites of ${course} are back to “Not recorded”.`,
      termsTitle: (course) => `Offering terms of ${course}`,
      termsLead: 'Tick the terms in which the official document says this course is offered, in this cohort.',
      termsLegend: 'Terms offered',
      termsHint: 'With no term ticked, the offering terms go back to “Not recorded”.',
      termsSaved: (course) => `Saved the offering terms of ${course}.`,
      termsCleared: (course) => `The offering terms of ${course} are back to “Not recorded”.`,
    },
    catalog: {
      heading: 'Shared course catalog',
      shared: 'An edit here applies to every curriculum that has the course.',
      find: 'Find',
      add: 'Add course',
      lookupHint: 'The catalog has no listing or search by name yet. Enter the exact code of the course.',
      notFound: (code) => `The catalog has no course with the code ${code}.`,
      notFoundAdd: 'Press “Add course” to create a new course with this code.',
      lookupFailed: 'Could not load the course.',
      fields: {
        code: 'Course code',
        nameVi: 'Vietnamese name',
        nameEn: 'English name',
        credits: 'Credits',
        theoryPeriods: 'Theory periods (LT)',
        labPeriods: 'Lab periods (TH)',
        exercisePeriods: 'Exercise periods (BT)',
        projectPeriods: 'Project periods (ĐT)',
      },
      blank: 'Blank',
      usedIn: 'Used in',
      usedInNone: 'No curriculum uses this course yet.',
      membership: (program, year, group) => `${program} · Cohort ${year} · ${group}`,
      edit: 'Edit',
      editLabel: (course) => `Edit the course ${course}`,
      delete: 'Delete',
      deleteLabel: (course) => `Delete the course ${course}`,
      dialogNew: 'New course',
      dialogEdit: (course) => `Edit the course ${course}`,
      codeHint: 'Capital letters and digits, 2 to 20 characters, such as CS101. The code cannot change once created.',
      codeFixed: 'The code cannot be changed here.',
      nameEnHint: 'Leave empty if the official document gives no English name.',
      periodsHintNew: 'Periods as the official table prints them. An empty box is saved as 0.',
      periodsHintEdit: 'Periods as the official table prints them. Empty a box to record that the table leaves it blank.',
      sharedWarningTitle: 'An edit here changes every curriculum that uses this course',
      sharedWarningText: (curricula) => `In use: ${curricula}. Check the official document before you save.`,
      created: (course) => `Added the course ${course} to the catalog.`,
      saved: (course) => `Saved the course ${course}.`,
      deleted: (course) => `Deleted the course ${course} from the catalog.`,
      noChange: 'Nothing changed, so nothing was sent.',
      deleteTitle: (course) => `Delete the course ${course}?`,
      deleteBody: (course) =>
        `${course} will be deleted from the shared catalog. The server deletes only a course that nothing uses any more: no curriculum, prerequisite, offering term, transcript or saved plan.`,
      reviewTitle: 'Review the impact before saving',
      reviewLead: 'The curricula below share this course and will read the new values. Check the official document, then confirm. Nothing is saved until you confirm.',
      reviewChanged: 'The values of the course, or the curricula that use it, changed since you reviewed them. Nothing was saved. Review the new list, then confirm again.',
      reviewChanges: 'Changes',
      reviewField: 'Field',
      reviewOld: 'Now',
      reviewNew: 'New',
      reviewAffected: (count) => (count === 1 ? '1 curriculum affected' : `${count} curricula affected`),
      affected: (program, year, curriculum) => `${program} · Cohort ${year} (${curriculum})`,
      reviewBack: 'Back to the form',
      reviewConfirm: 'Confirm and save',
    },
    access: {
      heading: 'Administration access',
      lead: 'Grant and revoke permissions by user ID.',
      userId: 'User ID',
      find: 'Find',
      hint: 'The person who needs a permission copies their user ID on the Settings page and sends it to you. There is no search by name or email.',
      noAccount: 'No account has this ID.',
      badUserId: 'The server does not accept this ID.',
      lookupFailed: "Could not load this user's permissions.",
      grantsOf: 'Permissions of the user',
      ownAccount: 'Your account',
      programs: 'Program administrator',
      noProgramGrants: 'This user administers no program yet.',
      columns: { program: 'Program', grantedAt: 'Granted', grantedBy: 'Granted by', actions: 'Actions', permission: 'Permission', status: 'Status' },
      noGranter: 'Not recorded (first set-up, or a deleted account)',
      program: 'Program',
      pickProgram: 'Choose a program',
      grantProgram: 'Grant program administrator',
      programsFailed: 'Could not load the programs.',
      global: 'Global permissions',
      describe: {
        program_admin: 'Edits the requirement groups, their courses, the prerequisites and the offering terms of one granted program. No catalog edits, no grants.',
        catalog_maintainer: 'Creates courses in the shared catalog, corrects a course after reviewing its impact, deletes a course nothing uses. No curriculum edits, no grants.',
        access_manager: 'Grants and revokes all three permissions, this one included. It gives no right to edit a curriculum or the catalog.',
      },
      held: (when) => `Held · granted ${when}`,
      notHeld: 'Not held',
      grant: 'Grant',
      grantLabel: (permission) => `Grant the permission ${permission}`,
      revoke: 'Revoke',
      revokeLabel: (permission) => `Revoke the permission ${permission}`,
      programPermission: (program) => `Program administrator of ${program}`,
      granted: (permission) => `Granted the permission “${permission}”.`,
      revoked: (permission) => `Revoked the permission “${permission}”.`,
      revokeTitle: 'Revoke this permission?',
      revokeBody: (permission) => `This user will lose the permission “${permission}”. Their next write that needs it will be refused.`,
      revokeOwn: 'This is your own account: you lose the permission at once.',
    },
  },
};

export type AdminText = AdminMessages;
