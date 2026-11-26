import type { RequirementGroupKind } from '../curriculum/api.js';
import { COURSE_CODE_LENGTH } from '../course-code.js';
import { LANGUAGES, type Lang } from '../locale.js';
import { BYTES_PER_MIB, IMPORT_MAX_BYTES, IMPORT_MAX_RECORDS, SIGNED_OUT_BODY_MAX_KIB, type PermissionKind } from './api.js';
import type { ConflictCode, Reference } from './errors.js';
import type { CohortField, CourseField, ProgramField } from './forms.js';
import type { ImportFileType } from './api.js';
import type { AdminSection } from './sections.js';

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
  groupsTitle: (count: number) => string;
  addGroup: string;
  columns: { group: string; kind: string; credits: string; notes: string; courses: string; actions: string };
  kinds: Record<RequirementGroupKind, string>;
  creditsTotal: (credits: number) => string;
  creditsMin: (credits: number) => string;
  totalsReadOnly: string;
  showMore: string;
  showLess: string;
  noteMoreLabel: (group: string) => string;
  noteLessLabel: (group: string) => string;
  cohortLabel: (program: string, year: number) => string;
  groupLabel: (program: string, year: number, group: string) => string;
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
  importLink: string;
  linked: (course: string, group: string) => string;
  courseColumns: { code: string; name: string; credits: string; prerequisites: string; terms: string; actions: string };
  noPrerequisite: string;
  term: (number: number) => string;
  editPrerequisitesLabel: (course: string) => string;
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

interface CatalogMessages {
  heading: string;
  shared: string;
  find: string;
  add: string;
  lookupHint: string;
  notFound: (code: string) => string;
  notFoundAdd: string;
  notACode: string;
  lookupFailed: string;
  importLink: string;
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
  rebased: string;
}

interface ProgramMessages {
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

interface ImportMessages {
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
  curriculum: CurriculumMessages;
  catalog: CatalogMessages;
  access: AccessMessages;
  programs: ProgramMessages;
  import: ImportMessages;
}

const MAX_MIB = `${IMPORT_MAX_BYTES / BYTES_PER_MIB} MiB`;
const maxRecords = (lang: Lang) => IMPORT_MAX_RECORDS.toLocaleString(LANGUAGES[lang].tag);
const { min: CODE_MIN, max: CODE_MAX } = COURSE_CODE_LENGTH;

export const ADMIN_MESSAGES: Record<Lang, AdminMessages> = {
  vi: {
    title: 'Quản trị',
    lead: 'Nhập và sửa chương trình đào tạo theo văn bản chính thức của trường. Dữ liệu do người nhập và kiểm tra, không do AI trích xuất.',
    sections: 'Mục quản trị',
    sectionNames: { curriculum: 'Nhóm yêu cầu', catalog: 'Danh mục học phần', import: 'Nhập CSV', access: 'Phân quyền' },
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
    curriculum: {
      heading: 'Nhóm yêu cầu và học phần của một khóa',
      program: 'Chương trình',
      cohort: 'Khóa',
      cohortOption: (year) => `Khóa ${year}`,
      programsFailed: 'Chưa tải được các chương trình bạn quản trị.',
      noPrograms: 'Bạn chưa được cấp quyền quản trị chương trình nào.',
      noCohorts: 'Chương trình này chưa có khóa nào. Bấm “Thêm khóa” để thêm khóa đầu tiên.',
      thisCohortOnly: 'Sửa ở đây chỉ đổi khóa này. Các khóa khác không bị ảnh hưởng.',
      loadFailed: 'Chưa tải được chương trình đào tạo của khóa này.',
      noCurriculum: 'Khóa này chưa có chương trình đào tạo.',
      groupsTitle: (count) => `${count} nhóm yêu cầu`,
      addGroup: 'Thêm nhóm',
      columns: { group: 'Nhóm', kind: 'Loại', credits: 'TC yêu cầu', notes: 'Ghi chú quy tắc', courses: 'Học phần', actions: 'Thao tác' },
      kinds: { compulsory: 'Bắt buộc', elective: 'Tự chọn' },
      creditsTotal: (credits) => `${credits} TC`,
      creditsMin: (credits) => `Tối thiểu ${credits} TC`,
      totalsReadOnly: 'Số tín chỉ yêu cầu của nhóm chỉ để xem: trang này chưa sửa được.',
      showMore: 'Xem thêm',
      showLess: 'Thu gọn',
      noteMoreLabel: (group) => `Xem thêm ghi chú quy tắc của nhóm ${group}`,
      noteLessLabel: (group) => `Thu gọn ghi chú quy tắc của nhóm ${group}`,
      cohortLabel: (program, year) => `${program} · Khóa ${year}`,
      groupLabel: (program, year, group) => `nhóm “${group}” (${program} · Khóa ${year})`,
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
      importLink: 'Nhập học phần vào nhóm từ tệp CSV',
      courseColumns: { code: 'Mã', name: 'Tên', credits: 'TC', prerequisites: 'Tiên quyết', terms: 'Kỳ mở', actions: 'Thao tác' },
      noPrerequisite: 'Không có tiên quyết',
      term: (number) => `HK${number}`,
      editPrerequisitesLabel: (course) => `Sửa tiên quyết của ${course}`,
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
      notACode: `Mã học phần gồm ${CODE_MIN} đến ${CODE_MAX} chữ cái A–Z hoặc chữ số, nên không thể tạo học phần với mã này.`,
      lookupFailed: 'Chưa tải được học phần.',
      importLink: 'Nhập học phần từ tệp CSV',
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
      codeHint: `Chữ in hoa và số, ${CODE_MIN} đến ${CODE_MAX} ký tự, ví dụ CS101. Mã không đổi được sau khi tạo.`,
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
      rebased: 'Học phần này đã được sửa ở nơi khác trong lúc bạn xem lại. Các ô bạn chưa sửa đã được cập nhật theo giá trị hiện tại.',
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
    programs: {
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
    import: {
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
  },
  en: {
    title: 'Administration',
    lead: "Enter and correct curricula from the school's official documents. People enter and check the data; no AI extracts it.",
    sections: 'Administration sections',
    sectionNames: { curriculum: 'Requirement groups', catalog: 'Course catalog', import: 'CSV import', access: 'Access' },
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
    curriculum: {
      heading: 'Requirement groups and courses of one cohort',
      program: 'Program',
      cohort: 'Cohort',
      cohortOption: (year) => `Cohort ${year}`,
      programsFailed: 'Could not load the programs you administer.',
      noPrograms: 'You hold no program administrator grant.',
      noCohorts: 'This program has no cohort yet. Choose “Add a cohort” to add the first one.',
      thisCohortOnly: 'An edit here changes this cohort only. Other cohorts are not affected.',
      loadFailed: 'Could not load the curriculum of this cohort.',
      noCurriculum: 'This cohort has no curriculum yet.',
      groupsTitle: (count) => (count === 1 ? '1 requirement group' : `${count} requirement groups`),
      addGroup: 'Add group',
      columns: { group: 'Group', kind: 'Kind', credits: 'Credits required', notes: 'Rule notes', courses: 'Courses', actions: 'Actions' },
      kinds: { compulsory: 'Compulsory', elective: 'Elective' },
      creditsTotal: (credits) => `${credits} cr`,
      creditsMin: (credits) => `At least ${credits} cr`,
      totalsReadOnly: "A group's required credits are shown only: this page cannot change them yet.",
      showMore: 'Show more',
      showLess: 'Show less',
      noteMoreLabel: (group) => `Show more of the rule notes of the group ${group}`,
      noteLessLabel: (group) => `Show less of the rule notes of the group ${group}`,
      cohortLabel: (program, year) => `${program} · Cohort ${year}`,
      groupLabel: (program, year, group) => `the group “${group}” (${program} · Cohort ${year})`,
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
      importLink: 'Import group courses from a CSV file',
      courseColumns: { code: 'Code', name: 'Name', credits: 'Cr', prerequisites: 'Prerequisites', terms: 'Offering terms', actions: 'Actions' },
      noPrerequisite: 'No prerequisite',
      term: (number) => `Term ${number}`,
      editPrerequisitesLabel: (course) => `Edit the prerequisites of ${course}`,
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
      notACode: `A course code has ${CODE_MIN} to ${CODE_MAX} letters A–Z or digits, so no course can be created with this one.`,
      lookupFailed: 'Could not load the course.',
      importLink: 'Import courses from a CSV file',
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
      codeHint: `Capital letters and digits, ${CODE_MIN} to ${CODE_MAX} characters, such as CS101. The code cannot change once created.`,
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
      rebased: 'This course was corrected elsewhere while you reviewed it. The boxes you did not change now show its current values.',
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
    programs: {
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
    import: {
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
  },
};

export type AdminText = AdminMessages;
