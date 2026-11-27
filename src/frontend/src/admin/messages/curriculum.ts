import type { RequirementGroupKind } from '../../curriculum/api.js';
import type { Lang } from '../../locale.js';

export interface CurriculumMessages {
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

export const CURRICULUM_MESSAGES: Record<Lang, CurriculumMessages> = {
  vi: {
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
  en: {
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
};
