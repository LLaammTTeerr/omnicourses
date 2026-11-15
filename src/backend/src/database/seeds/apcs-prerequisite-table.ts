import type { PrintedPrerequisiteRow, PrintedPrerequisiteTable } from './seed-types.js';

// The course rows of CTTT-Bang-mo-ta-tom-tat-mon-hoc.pdf ("Bảng mô tả tóm tắt
// môn học Chương trình Tiên tiến", 42 pages with a text layer), the one APCS
// document found so far that prints a prerequisite column ("Điều kiện tiên
// quyết"). Data only: nothing loads it and the rule engine never reads it.
//
// The document prints no date and names no cohort. Whether it is the
// prerequisite rule of the 2024 and 2025 cohorts is the Project Lead's
// decision (AGENTS.md hard rule 1). Until then no code is mapped to a newer
// one (CS161 is not CS160, CM101 is not CM102) and no spelling is repaired
// (a cell prints "MATH251", the row is "MTH251").
//
// apcs-prerequisite-table.spec.ts checks every value below against the PDF's
// text (sources/apcs-prerequisite-table.*.pdftotext.txt), derives `resolved`
// and `unresolved` from `printed`, and pins how the table compares with the
// booklet's Prior-course lines (apcs-prerequisites.ts).

/** row(code, English name, Vietnamese name, credits, printed cell, resolved codes, page) */
const row = (
  code: string,
  name_en: string,
  name_vi: string,
  credits: number,
  printed: string | null,
  resolved: string[],
  page: number,
  credits_printed?: string,
): PrintedPrerequisiteRow => ({
  code,
  name_en,
  name_vi,
  credits,
  ...(credits_printed === undefined ? {} : { credits_printed }),
  printed,
  resolved,
  unresolved: [],
  page,
});

export const apcsPrerequisiteTable: PrintedPrerequisiteTable = {
  source: {
    id: 'apcs-prerequisite-table',
    file: 'CTTT-Bang-mo-ta-tom-tat-mon-hoc.pdf',
    pages: 42,
    sha256: 'f57e6b6349b98aa00e9bd1d26978ef5a090a447cb59ca80e781c078313606ed1',
    sourceUrl: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2015/07/CTTT-Bang-mo-ta-tom-tat-mon-hoc.pdf',
    issued: null,
  },
  field: 'Điều kiện tiên quyết',
  note:
    'The table heads its last column "Điều kiện tiên quyết" (prerequisite) and fills every cell with ' +
    '"None" or with course codes. It prints no date, no cohort and no offering terms; the PDF metadata ' +
    'says 30 July 2019 and the URL folder 2015/07. The codes are the old ones (CS161, CS162, CM101); ' +
    'the 2024/2025 curricula use CS160 and CM102. Cells name codes that are no row of the table ' +
    '(CS200, MATH251, MATH252, MATH261), and the booklet of March 2021 (apcs-prerequisites.ts) ' +
    'disagrees with several rows. A loader needs the Project Lead to decide the cohorts the table ' +
    'applies to, the code mapping and every such reference, first.',
  rows: [
    row('CS161', 'Introduction to Computer Science I', 'Nhập môn Tin học I', 4, 'None', [], 1),
    row('CS162', 'Introduction to Computer Science II', 'Nhập môn Tin học II', 4, 'CS161', ['CS161'], 1),
    row('CS163', 'Data Structures', 'Cấu trúc dữ liệu', 4, 'CS162', ['CS162'], 1),
    row('CS201', 'Computer Systems Programming', 'Lập trình hệ thống', 4, 'CS161, CS162', ['CS161', 'CS162'], 2),
    row('CS202', 'Programming Systems', 'Các hệ thống lập trình', 4, 'None', [], 3),
    row('CS250', 'Discrete Structures I', 'Cấu trúc rời rạc I', 4, 'None', [], 4),
    row('CS251', 'Logical Structures', 'Cấu trúc logic', 4, 'CS250', ['CS250'], 4),
    row('CS300', 'Elements of Software Engineering', 'Nhập môn Công nghệ phần mềm', 4, 'CS202', ['CS202'], 5),
    row('CS305', 'Social, Ethical, and Legal Issues', 'Đạo đức khoa học', 2, 'None', [], 6),
    row('CS311', 'Computational Structures', 'Cấu trúc tính toán', 4, 'CS251', ['CS251'], 7),
    row('CS320', 'Principles of Programming Languages', 'Nguyên lý các ngôn ngữ lập trình', 4, 'CS200, CS201, CS311', ['CS200', 'CS201', 'CS311'], 7),
    row('CS333', 'Introduction to Operating Systems', 'Nhập môn Hệ điều hành', 4, 'CS200, CS201, CS311', ['CS200', 'CS201', 'CS311'], 9),
    row('CS350', 'Algorithms and Complexity', 'Thuật toán và độ phức tạp', 4, 'CS311', ['CS311'], 10),
    row('CS486', 'Introduction to Database Systems', 'Nhập môn các hệ cơ sở dữ liệu', 4, 'CS163, CS250, CS251', ['CS163', 'CS250', 'CS251'], 11),
    row('CS487-CS488', 'Capstone Project', 'Đồ án tốt nghiệp', 6, 'CS163, CS250, CS251', ['CS163', 'CS250', 'CS251'], 12),
    row('CM101', 'Communication Management', 'Kỹ năng giao tiếp', 4, 'None', [], 13),
    row('ECE341', 'Computer Hardware', 'Phần cứng máy tính', 4, 'None', [], 14),
    row('SC203', 'Scientific Method', 'Phương pháp khoa học', 4, 'None', [], 15),
    row('WR227', 'Technical Writing', 'Kỹ năng viết tài liệu khoa học', 4, 'SC203', ['SC203'], 16),
    row('MTH251', 'Calculus I', 'Vi tích phân I', 4, 'None', [], 17),
    row('MTH252', 'Calculus II', 'Vi tích phân II', 4, 'MATH2 51', ['MATH251'], 17),
    row('MTH253', 'Calculus III', 'Vi tích phân III', 4, 'MATH2 52', ['MATH252'], 17),
    row('STAT451', 'Applied Statistics for Engineers and Scientists', 'Xác suất thống kê', 4, 'CS250, CS251', ['CS250', 'CS251'], 18),
    row('PH214', 'Physics Laboratory I', 'Thực hành Vật lý I', 1, 'None', [], 19),
    row('PH215', 'Physics Laboratory II', 'Thực hành Vật lý II', 1, 'None', [], 19, '01'),
    row('PH216', 'Physics Laboratory III', 'Thực hành Vật lý III', 1, 'None', [], 20, '01'),
    row('PH221', 'General Physics I', 'Vật lý Đại cương I', 3, 'None', [], 21),
    row('PH222', 'General Physics II', 'Vật lý Đại cương II', 3, 'None', [], 22),
    row('PH223', 'General Physics III', 'Vật lý Đại cương III', 3, 'None', [], 22),
    row('CS411', 'Computer Graphics', 'Đồ họa máy tính', 4, 'CS202, MTH261', ['CS202', 'MTH261'], 23),
    row('CS412', 'Computer Vision', 'Thị giác máy tính', 4, 'None', [], 23),
    row('CS417', 'Game Theory, Multi-Agents and Social Algorithms', 'Lý thuyết game - Hệ thống đa tác nhân và thuật toán xã hội', 4, 'None', [], 24),
    row('CS418', 'Introduction to Natural Language Processing', 'Nhập môn xử lý ngôn ngữ tự nhiên', 4, 'CS162', ['CS162'], 25),
    row('CS419', 'Introduction to Information Retrieval', 'Nhập môn tìm kiếm thông tin', 4, 'CS163, STAT45 1, MATH2 61', ['CS163', 'STAT451', 'MATH261'], 26),
    row('CS420', 'Artificial Intelligence', 'Trí tuệ nhân tạo', 4, 'CS202, CS311', ['CS202', 'CS311'], 27),
    row('CS421', 'Software Requirement', 'Quản lý yêu cầu phần mềm', 4, 'None', [], 27),
    row('CS422', 'Software Analysis and Design', 'Phân tích và thiết kế phần mềm', 4, 'None', [], 28),
    row('CS423', 'Software Testing', 'Kiểm chứng phần mềm', 4, 'None', [], 28),
    row('CS424', 'Web Application Development', 'Phát triển ứng dụng Web', 4, 'None', [], 29),
    row('CS426', 'Mobile Device Application Development', 'Phát triển ứng dụng trên thiết bị di động', 4, 'None', [], 29),
    row('CS427', '3D Visualization and Game Development', 'Trực quan hóa 3D và phát triển Game', 4, 'None', [], 31),
    row('CS428', 'Electronic Commerce', 'Thương mại điện tử', 4, 'None', [], 31),
    row('CS429', 'Mining on Big Data', 'Khai thác trên dữ liệu lớn', 4, 'None', [], 32),
    row('CS430', 'Human-Computer Interaction', 'Tương tác người - máy', 4, 'CS202', ['CS202'], 32),
    row('CS431', 'Wireless Network', 'Mạng không dây', 4, 'None', [], 33),
    row('CS494', 'Internetworking Protocols', 'Các giao thức liên mạng', 4, 'None', [], 34),
    row('MTH261', 'Introduction to Linear Algebra', 'Đại số tuyến tính', 4, 'None', [], 35),
    row('MTH344', 'Group Theory', 'Lý thuyết nhóm', 4, 'CS251', ['CS251'], 36),
    row('MTH346', 'Number Theory', 'Lý thuyết số', 4, 'MATH2 51, CS161, CS162, CS163, CS350', ['MATH251', 'CS161', 'CS162', 'CS163', 'CS350'], 36),
    row('STAT452', 'Applied Statistics for Engineers and Scientists 2', 'Thống kê máy tính và ứng dụng', 4, 'STAT45 1', ['STAT451'], 37),
    row('CS404', 'Internship', 'Thực tập thực tế', 4, 'None', [], 38),
    row('CS405', 'Open Economy, Entrepreneurship & Education', 'Kinh tế mở, doanh nhân và giáo dục', 4, 'None', [], 39),
    row('CS407', 'Technology-based Innovation and Leadership', 'Đổi mới công nghệ và khả năng lãnh đạo', 4, 'None', [], 41),
    row('CS408', 'Computational Finance', 'Tính toán tài chính', 4, 'None', [], 41),
    row('CS409', 'Enterpreneurship', 'Sáng nghiệp Công nghệ thông tin', 4, 'None', [], 41),
    row('KT006', 'Macro economics', 'Kinh tế vĩ mô', 4, 'None', [], 42),
  ],
  offering_terms: [],
};
