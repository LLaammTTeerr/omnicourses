import { COURSE_CODE_LENGTH } from '../../course-code.js';
import { type Lang } from '../../locale.js';
import type { CourseField } from '../forms.js';

const { min: CODE_MIN, max: CODE_MAX } = COURSE_CODE_LENGTH;

export interface CatalogMessages {
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

export const CATALOG_MESSAGES: Record<Lang, CatalogMessages> = {
  vi: {
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
  en: {
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
};
