import type { Lang } from '../locale.js';
import type { PlanIssue, PlanIssueCode, PlanIssueKind } from './api.js';

// The planner's words. Each issue code of the rule engine is worded here from its parameters (ADR 0006: issues are
// codes with parameters); the API's `message` is English only. Wording an issue never judges the plan: the engine
// already has.

/** What an issue's wording may need besides the issue itself. */
export interface IssueContext {
  /** The name of a requirement group or a combined minimum, by id. */
  requirementName: (issue: PlanIssue) => string | null;
}

type Worder = (issue: PlanIssue, ctx: IssueContext) => string;

interface PlannerMessages {
  title: string;
  listLead: string;
  newPlan: string;
  loading: string;
  loadFailed: string;
  retry: string;
  empty: string;
  emptyHint: string;
  noProgram: string;
  openSettings: string;
  curriculum: (code: string) => string;
  updated: (when: string) => string;
  open: string;
  rename: string;
  copy: string;
  delete: string;
  actionsFor: (name: string) => string;
  copyName: (name: string) => string;
  copied: (name: string) => string;
  renamed: (name: string) => string;
  deleted: (name: string) => string;
  created: (name: string) => string;
  actionFailed: string;
  nameLabel: string;
  namePlaceholder: string;
  nameRequired: string;
  createTitle: string;
  createBody: (curriculum: string) => string;
  create: string;
  renameTitle: string;
  save: string;
  cancel: string;
  deleteTitle: (name: string) => string;
  deleteBody: string;
  keep: string;
  deleting: string;
  // Editor
  allPlans: string;
  editorLead: string;
  keyboardHint: string;
  notFound: string;
  saved: string;
  saving: string;
  saveFailed: string;
  saveRefused: (details: string) => string;
  checking: string;
  checkFailed: string;
  courses: string;
  coursesCount: (n: number) => string;
  search: string;
  searchPlaceholder: string;
  addTo: string;
  add: (code: string, term: string) => string;
  curriculumFailed: string;
  noCurriculum: string;
  allPlaced: string;
  noMatch: string;
  inTranscript: string;
  dropToRemove: string;
  dropHere: string;
  addTerm: (term: string) => string;
  termsLabel: string;
  credits: (n: number) => string;
  load: (credits: number) => string;
  caps: (min: number | null, max: number) => string;
  capsUnknown: string;
  summer: string;
  slot: (group: string) => string;
  slotGroupUnknown: string;
  moveEarlier: (code: string) => string;
  moveLater: (code: string) => string;
  remove: (code: string) => string;
  tileLabel: (code: string, term: string) => string;
  lifted: (code: string, term: string) => string;
  liftTarget: (code: string, term: string) => string;
  moved: (code: string, term: string) => string;
  added: (code: string, term: string) => string;
  removed: (code: string) => string;
  liftCancelled: (code: string) => string;
  // Issues
  issuesTitle: string;
  issuesLead: string;
  noIssues: string;
  kinds: Record<PlanIssueKind, string>;
  kindHeadings: Record<PlanIssueKind, string>;
  kindsPlural: Record<PlanIssueKind, (n: number) => string>;
  notRecordedYet: string;
  /** What is not recorded, for the one line a tile gives its unknowns. */
  unknownWhat: (codes: PlanIssueCode[]) => string;
  source: string;
  wholePlan: string;
  coverage: string;
  totalCredits: (credits: number, required: number | null) => string;
  graduation: Record<'done' | 'not_yet', string>;
  groupCredits: (credits: number, required: number | null) => string;
  met: string;
  short: (n: number) => string;
  issue: Record<PlanIssueCode, Worder>;
}

const list = (codes: readonly (string | number)[]) => codes.join(', ');
const code = (issue: PlanIssue) => issue.courseCode ?? '?';
const UNKNOWN_WHAT: Record<Lang, Partial<Record<PlanIssueCode, string>>> = {
  vi: { prerequisites_not_recorded: 'môn tiên quyết', offering_terms_not_recorded: 'học kỳ mở môn', credits_not_recorded: 'số tín chỉ', caps_not_checked: 'giới hạn tín chỉ' },
  en: { prerequisites_not_recorded: 'prerequisites', offering_terms_not_recorded: 'offering terms', credits_not_recorded: 'credits', caps_not_checked: 'credit caps' },
};

export const PLANNER_MESSAGES: Record<Lang, PlannerMessages> = {
  vi: {
    title: 'Lộ trình học tập',
    listLead: 'Xếp các học phần trong chương trình của bạn vào từng học kỳ cho đến khi tốt nghiệp. Bạn có thể giữ nhiều kế hoạch để so sánh.',
    newPlan: 'Kế hoạch mới',
    loading: 'Đang tải…',
    loadFailed: 'Chưa tải được kế hoạch.',
    retry: 'Thử lại',
    empty: 'Bạn chưa có kế hoạch nào.',
    emptyHint: 'Tạo một kế hoạch trống rồi xếp môn vào từng học kỳ.',
    noProgram: 'Hãy chọn chương trình và khóa trong Cài đặt trước khi tạo kế hoạch.',
    openSettings: 'Mở Cài đặt',
    curriculum: (c) => `CTĐT ${c}`,
    updated: (when) => `Sửa lần cuối ${when}`,
    open: 'Mở',
    rename: 'Đổi tên',
    copy: 'Tạo bản sao',
    delete: 'Xóa',
    actionsFor: (name) => `Thao tác với ${name}`,
    copyName: (name) => `Bản sao của ${name}`,
    copied: (name) => `Đã tạo ${name}.`,
    renamed: (name) => `Đã đổi tên thành ${name}.`,
    deleted: (name) => `Đã xóa ${name}.`,
    created: (name) => `Đã tạo ${name}.`,
    actionFailed: 'Chưa thực hiện được. Hãy thử lại.',
    nameLabel: 'Tên kế hoạch',
    namePlaceholder: 'Ví dụ: Tốt nghiệp đúng hạn',
    nameRequired: 'Hãy nhập tên, tối đa 100 ký tự.',
    createTitle: 'Tạo kế hoạch',
    createBody: (c) => `Kế hoạch dùng CTĐT ${c} và giữ nguyên CTĐT này kể cả khi bạn đổi chương trình sau này.`,
    create: 'Tạo',
    renameTitle: 'Đổi tên kế hoạch',
    save: 'Lưu',
    cancel: 'Hủy',
    deleteTitle: (name) => `Xóa ${name}?`,
    deleteBody: 'Kế hoạch và mọi môn đã xếp trong đó sẽ bị xóa. Không thể hoàn tác.',
    keep: 'Giữ lại',
    deleting: 'Đang xóa…',
    allPlans: 'Mọi kế hoạch',
    editorLead: 'Thêm môn từ chương trình, chuyển môn giữa các học kỳ. Mỗi thay đổi được lưu ngay và rule engine kiểm tra lại kế hoạch.',
    keyboardHint: 'Bàn phím: chọn một môn, Space để nhấc, mũi tên lên xuống để chọn học kỳ, Enter để thả, Esc để hủy, Delete để bỏ.',
    notFound: 'Không có kế hoạch này trong các kế hoạch của bạn.',
    saved: 'Đã lưu',
    saving: 'Đang lưu…',
    saveFailed: 'Chưa lưu được thay đổi. Kế hoạch đã trở về lần lưu gần nhất.',
    saveRefused: (details) => `Máy chủ không nhận thay đổi này (${details}). Kế hoạch đã trở về lần lưu gần nhất.`,
    checking: 'Đang kiểm tra…',
    checkFailed: 'Chưa kiểm tra được kế hoạch.',
    courses: 'Học phần trong chương trình',
    coursesCount: (n) => `${n} môn chưa xếp`,
    search: 'Tìm học phần',
    searchPlaceholder: 'Mã hoặc tên môn',
    addTo: 'Thêm vào',
    add: (c, term) => `Thêm ${c} vào ${term}`,
    curriculumFailed: 'Chưa tải được chương trình đào tạo, nên chưa thêm được môn. Bạn vẫn chuyển được các môn đã xếp.',
    noCurriculum: 'Chưa có chương trình đào tạo cho kế hoạch này.',
    allPlaced: 'Mọi môn của chương trình đã được xếp.',
    noMatch: 'Không có môn nào khớp.',
    inTranscript: 'Trong bảng điểm',
    dropToRemove: 'Thả một môn vào đây để bỏ khỏi kế hoạch.',
    dropHere: 'Thả môn vào đây',
    addTerm: (term) => `Thêm ${term}`,
    termsLabel: 'Các học kỳ',
    credits: (n) => `${n} TC`,
    load: (credits) => `${credits} TC`,
    caps: (min, max) => (min === null ? `tối đa ${max} TC` : `${min}–${max} TC`),
    capsUnknown: 'chưa ghi nhận giới hạn TC',
    summer: 'Học kỳ hè',
    slot: (group) => `Chỗ cho ${group}`,
    slotGroupUnknown: 'một nhóm tự chọn',
    moveEarlier: (c) => `Chuyển ${c} lên học kỳ trước`,
    moveLater: (c) => `Chuyển ${c} xuống học kỳ sau`,
    remove: (c) => `Bỏ ${c} khỏi kế hoạch`,
    tileLabel: (c, term) => `${c}, ${term}`,
    lifted: (c, term) => `Đã nhấc ${c} ở ${term}. Dùng mũi tên để chọn học kỳ, Enter để thả, Esc để hủy.`,
    liftTarget: (c, term) => `${c} sẽ chuyển tới ${term}.`,
    moved: (c, term) => `Đã chuyển ${c} tới ${term}.`,
    added: (c, term) => `Đã thêm ${c} vào ${term}.`,
    removed: (c) => `Đã bỏ ${c} khỏi kế hoạch.`,
    liftCancelled: (c) => `Đã hủy chuyển ${c}.`,
    issuesTitle: 'Kiểm tra kế hoạch',
    issuesLead: 'Do rule engine tính theo quy chế đào tạo, không do AI.',
    noIssues: 'Rule engine không thấy vấn đề nào.',
    kinds: { violation: 'Vi phạm', flag: 'Cần xem lại', unknown: 'Chưa ghi nhận' },
    kindHeadings: { violation: 'Vi phạm', flag: 'Cần xem lại', unknown: 'Chưa ghi nhận' },
    kindsPlural: {
      violation: (n) => `${n} vi phạm`,
      flag: (n) => `${n} cần xem lại`,
      unknown: (n) => `${n} chưa ghi nhận`,
    },
    notRecordedYet: 'Chưa ghi nhận dữ liệu, nên chưa kiểm tra: không phải đạt, cũng không phải trượt.',
    unknownWhat: (codes) => `Chưa ghi nhận ${codes.map((c) => UNKNOWN_WHAT.vi[c] ?? c).join(', ')}`,
    source: 'Nguồn',
    wholePlan: 'Cả kế hoạch',
    coverage: 'Khi hoàn thành kế hoạch',
    totalCredits: (credits, required) => (required === null ? `${credits} TC` : `${credits}/${required} TC`),
    graduation: { done: 'Đủ các yêu cầu kiểm tra được', not_yet: 'Chưa đủ để tốt nghiệp' },
    groupCredits: (credits, required) => (required === null ? `${credits} TC` : `${credits}/${required} TC`),
    met: 'Đủ',
    short: (n) => `Thiếu ${n} TC`,
    issue: {
      prerequisite_not_met: (i) => `${code(i)} cần học xong ${list(i.missingCourseCodes)} ở một học kỳ trước.`,
      prerequisites_not_recorded: (i) => `${code(i)}: chưa ghi nhận môn tiên quyết.`,
      not_offered: (i) => `${code(i)} không mở ở HK${i.term?.number ?? '?'}; chỉ mở HK${list(i.offeredTermNumbers)}.`,
      offering_terms_not_recorded: (i) => `${code(i)}: chưa ghi nhận học kỳ mở môn.`,
      load_below_minimum: (i) => `${i.credits} TC, dưới mức tối thiểu ${i.limit} TC. Được phép nếu có đơn được duyệt.`,
      load_above_maximum: (i) => `${i.credits} TC, vượt mức tối đa ${i.limit} TC. Được phép nếu có đơn được duyệt.`,
      caps_not_checked: () => 'Chưa ghi nhận loại hình đào tạo của chương trình, nên chưa kiểm tra giới hạn tín chỉ.',
      placed_twice: (i) => `${code(i)} được xếp ở nhiều học kỳ.`,
      already_passed: (i) => `${code(i)} đã đạt trước học kỳ này: học lại để cải thiện điểm.`,
      not_in_curriculum: (i) => `${code(i)} không thuộc chương trình đào tạo này, nên không tính cho yêu cầu nào.`,
      credits_not_recorded: (i) => `${code(i)} không còn trong danh mục học phần; số tín chỉ không được tính.`,
      requirement_not_covered: (i, ctx) =>
        `${ctx.requirementName(i) ?? 'Tổng số tín chỉ'} còn thiếu` +
        (i.limit === null ? '' : `: ${i.credits ?? 0}/${i.limit} TC`) +
        (i.missingCourseCodes.length ? `; chưa xếp ${list(i.missingCourseCodes)}.` : '.'),
    },
  },
  en: {
    title: 'Plans',
    listLead: 'Place the courses of your curriculum into terms until graduation. Keep several plans to compare them.',
    newPlan: 'New plan',
    loading: 'Loading…',
    loadFailed: 'The plans could not be loaded.',
    retry: 'Try again',
    empty: 'You have no plan yet.',
    emptyHint: 'Create an empty plan, then place courses into its terms.',
    noProgram: 'Choose your program and cohort in Settings before creating a plan.',
    openSettings: 'Open Settings',
    curriculum: (c) => `Curriculum ${c}`,
    updated: (when) => `Last changed ${when}`,
    open: 'Open',
    rename: 'Rename',
    copy: 'Copy',
    delete: 'Delete',
    actionsFor: (name) => `Actions for ${name}`,
    copyName: (name) => `Copy of ${name}`,
    copied: (name) => `Created ${name}.`,
    renamed: (name) => `Renamed to ${name}.`,
    deleted: (name) => `Deleted ${name}.`,
    created: (name) => `Created ${name}.`,
    actionFailed: 'That did not work. Please try again.',
    nameLabel: 'Plan name',
    namePlaceholder: 'For example: Graduate on time',
    nameRequired: 'Enter a name of at most 100 characters.',
    createTitle: 'Create a plan',
    createBody: (c) => `The plan uses curriculum ${c} and keeps it even if you change program later.`,
    create: 'Create',
    renameTitle: 'Rename the plan',
    save: 'Save',
    cancel: 'Cancel',
    deleteTitle: (name) => `Delete ${name}?`,
    deleteBody: 'The plan and every course placed in it are deleted. This cannot be undone.',
    keep: 'Keep it',
    deleting: 'Deleting…',
    allPlans: 'All plans',
    editorLead: 'Add courses from your curriculum and move them between terms. Each change is saved at once and the rule engine checks the plan again.',
    keyboardHint: 'Keyboard: focus a course, Space to lift it, Up and Down arrows to pick a term, Enter to drop, Escape to cancel, Delete to remove.',
    notFound: 'This plan is not among your plans.',
    saved: 'Saved',
    saving: 'Saving…',
    saveFailed: 'The change could not be saved. The plan is back to its last saved state.',
    saveRefused: (details) => `The server refused this change (${details}). The plan is back to its last saved state.`,
    checking: 'Checking…',
    checkFailed: 'The plan could not be checked.',
    courses: 'Courses of the curriculum',
    coursesCount: (n) => `${n} not placed`,
    search: 'Search courses',
    searchPlaceholder: 'A code or a name',
    addTo: 'Add to',
    add: (c, term) => `Add ${c} to ${term}`,
    curriculumFailed: 'The curriculum could not be loaded, so no course can be added. You can still move the placed ones.',
    noCurriculum: 'There is no curriculum for this plan.',
    allPlaced: 'Every course of the curriculum is placed.',
    noMatch: 'No course matches.',
    inTranscript: 'In your transcript',
    dropToRemove: 'Drop a course here to remove it from the plan.',
    dropHere: 'Drop a course here',
    addTerm: (term) => `Add ${term}`,
    termsLabel: 'Terms',
    credits: (n) => `${n} cr`,
    load: (credits) => `${credits} credits`,
    caps: (min, max) => (min === null ? `at most ${max}` : `${min}–${max}`),
    capsUnknown: 'credit caps not recorded',
    summer: 'Summer term',
    slot: (group) => `Slot for ${group}`,
    slotGroupUnknown: 'an elective group',
    moveEarlier: (c) => `Move ${c} to the term before`,
    moveLater: (c) => `Move ${c} to the term after`,
    remove: (c) => `Remove ${c} from the plan`,
    tileLabel: (c, term) => `${c}, ${term}`,
    lifted: (c, term) => `Lifted ${c} in ${term}. Use the arrow keys to pick a term, Enter to drop, Escape to cancel.`,
    liftTarget: (c, term) => `${c} would move to ${term}.`,
    moved: (c, term) => `Moved ${c} to ${term}.`,
    added: (c, term) => `Added ${c} to ${term}.`,
    removed: (c) => `Removed ${c} from the plan.`,
    liftCancelled: (c) => `Cancelled moving ${c}.`,
    issuesTitle: 'Plan check',
    issuesLead: 'Computed by the rule engine from the training regulation, not by AI.',
    noIssues: 'The rule engine found nothing.',
    kinds: { violation: 'Violation', flag: 'Worth a look', unknown: 'Not recorded yet' },
    kindHeadings: { violation: 'Violations', flag: 'Worth a look', unknown: 'Not recorded yet' },
    kindsPlural: {
      violation: (n) => `${n} ${n === 1 ? 'violation' : 'violations'}`,
      flag: (n) => `${n} worth a look`,
      unknown: (n) => `${n} not recorded yet`,
    },
    notRecordedYet: 'The data is not recorded yet, so this is not checked: neither a pass nor a fail.',
    unknownWhat: (codes) => `Not recorded yet: ${codes.map((c) => UNKNOWN_WHAT.en[c] ?? c).join(', ')}`,
    source: 'Source',
    wholePlan: 'Whole plan',
    coverage: 'With the plan completed',
    totalCredits: (credits, required) => (required === null ? `${credits} credits` : `${credits}/${required} credits`),
    graduation: { done: 'Every requirement that can be checked is met', not_yet: 'Not enough to graduate yet' },
    groupCredits: (credits, required) => (required === null ? `${credits} cr` : `${credits}/${required} cr`),
    met: 'Met',
    short: (n) => `${n} cr short`,
    issue: {
      prerequisite_not_met: (i) => `${code(i)} needs ${list(i.missingCourseCodes)} passed or placed in an earlier term.`,
      prerequisites_not_recorded: (i) => `${code(i)}: prerequisites not recorded yet.`,
      not_offered: (i) => `${code(i)} is not taught in term ${i.term?.number ?? '?'}; it is taught in term ${list(i.offeredTermNumbers)}.`,
      offering_terms_not_recorded: (i) => `${code(i)}: offering terms not recorded yet.`,
      load_below_minimum: (i) => `${i.credits} credits, below the minimum of ${i.limit}. A petition can allow it.`,
      load_above_maximum: (i) => `${i.credits} credits, above the maximum of ${i.limit}. A petition can allow it.`,
      caps_not_checked: () => 'The program’s training type is not recorded yet, so the credit caps are not checked.',
      placed_twice: (i) => `${code(i)} is placed in more than one term.`,
      already_passed: (i) => `${code(i)} is already passed before this term: taking it again improves the grade.`,
      not_in_curriculum: (i) => `${code(i)} is not in this curriculum, so it counts toward no requirement.`,
      credits_not_recorded: (i) => `${code(i)} is no longer in the course catalog; its credits are not counted.`,
      requirement_not_covered: (i, ctx) =>
        `${ctx.requirementName(i) ?? 'Total credits'} still short` +
        (i.limit === null ? '' : `: ${i.credits ?? 0}/${i.limit} credits`) +
        (i.missingCourseCodes.length ? `; not placed: ${list(i.missingCourseCodes)}.` : '.'),
    },
  },
};
