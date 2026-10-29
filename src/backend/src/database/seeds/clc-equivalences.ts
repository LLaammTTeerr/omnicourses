// Transcribed from CLC_Danh-sach-hoc-phan-tuong-duong.pdf (5 scanned pages):
// "Danh mục các học phần tương đương/thay thế - Chương trình Chất lượng cao -
// ngành Công nghệ thông tin", Khoa Công nghệ thông tin, dated 1 August 2023.
//
// The seed script does not load this file and no table exists for it. Same
// shape as apcs-equivalences.ts: per STT, the old course (HP01), a course that
// may replace it (HP02) and, for some rows, a course that may replace HP02
// (HP03). Names are as printed, except that dashes are written "-" as in the
// curriculum seeds. In the HP03 column the scan renders the digit 1 like a
// lower-case l (CSCl0009); every such code is written with 1.

import type { EquivalenceCourse, EquivalenceList, EquivalenceRow } from './seed-types.js';
import { COURSE_CODE_PATTERN, normalizeCourseCode } from './catalog.js';

const c = (code_printed: string, name: string, credits: number | null): EquivalenceCourse => {
  const code = normalizeCourseCode(code_printed);
  return { code: COURSE_CODE_PATTERN.test(code) ? code : null, code_printed, name, credits };
};

type Course = [code: string, name: string, credits: number | null];

/** One STT row. A course given as [code, credits] reuses the HP01 name (HP02 printed with the same name). */
function row(
  stt: number,
  page: number,
  hp01: Course,
  hp02: Course | [string, number],
  hp03: Course[] = [],
  extra: Pick<EquivalenceRow, 'printed_rule' | 'needs_check'> = {},
): EquivalenceRow {
  const second: Course = hp02.length === 2 ? [hp02[0], hp01[1], hp02[1]] : hp02;
  return {
    stt: [stt],
    page,
    hp01: [c(...hp01)],
    hp02: [c(...second)],
    hp03: hp03.map((x) => c(...x)),
    ...extra,
  };
}

const MARX_SET =
  'HP03 lists three courses (BAA00101, BAA00102, BAA00103) in one cell; the PDF does not say whether all three ' +
  'together replace HP02 or each one does.';
const MERGED_16_17 =
  'STT 16 and 17 share one merged HP03 cell (CSC00004, 4 credits): it is not stated whether CSC00004 replaces each ' +
  'of CSC00001 and CSC00002, or both together.';
const CREDITS_DIFFER = (code: string, credits: number) =>
  `${code} is printed with 4 credits here; the 2025 CLC curriculum prints ${credits}. The list predates the 2025 ` +
  'curriculum; check which value an equivalence uses.';

export const clcEquivalences: EquivalenceList = {
  source: { file: 'CLC_Danh-sach-hoc-phan-tuong-duong.pdf', pages: 5 },
  title: 'Danh mục các học phần tương đương/thay thế - Chương trình Chất lượng cao - Ngành Công nghệ thông tin',
  issued: '2023-08-01',
  program_code: 'CNTT-TCTA',
  cohort_scope: null,
  note: 'Nếu học phần HP02 tương đương với học phần HP01 và học phần HP03 tương đương với HP02 thì HP03 cũng tương đương với HP01.',
  rows: [
    row(1, 1, ['CTH001', 'Những nguyên lý cơ bản của chủ nghĩa Mác - Lênin', 5], ['BAA00001', 5], [
      ['BAA00101', 'Triết học Mác - Lênin', 3],
      ['BAA00102', 'Kinh tế chính trị Mác - Lênin', 2],
      ['BAA00103', 'Chủ nghĩa xã hội khoa học', 2],
    ], { needs_check: MARX_SET }),
    row(2, 1, ['CTH002', 'Đường lối cách mạng của Đảng CSVN', 3], ['BAA00002', 3], [['BAA00104', 'Lịch sử Đảng Cộng sản Việt Nam', 2]]),
    row(3, 1, ['CTH003', 'Tư tưởng Hồ Chí Minh', 2], ['BAA00003', 2]),
    row(4, 1, ['PLD001', 'Pháp luật đại cương', 3], ['BAA00004', 3]),
    row(5, 1, ['KTH001', 'Kinh tế đại cương', 2], ['BAA00005', 2]),
    row(6, 1, ['XHH001', 'Tâm lý đại cương', 2], ['BAA00006', 2]),
    row(7, 1, ['PKH101', 'Phương pháp luận sáng tạo', 2], ['BAA00007', 2]),
    row(8, 1, ['TTH026', 'Giải tích B1', 3], ['MTH00003', 'Vi tích phân 1B', 3], [['MTH00005', 'Vi tích phân 1', 4]]),
    row(9, 1, ['TTH027', 'Giải tích B2', 3], ['MTH00004', 'Vi tích phân 2B', 3], [['MTH00006', 'Vi tích phân 2', 4]]),
    row(10, 1, ['TTH043', 'Xác suất thống kê B', 3], ['MTH00040', 'Xác suất thống kê', 3], [['MTH00007', 'Xác suất thống kê', 4]]),
    row(11, 1, ['TTH003', 'Đại số B1', 3], ['MTH00030', 'Đại số tuyến tính', 3], [['MTH00008', 'Đại số tuyến tính', 4]]),
    row(12, 1, ['TTH063', 'Toán rời rạc', 4], ['MTH00009', 4]),
    row(13, 1, ['TTH046', 'Toán học tổ hợp', 4], ['MTH00058', 4]),
    row(14, 1, ['CTT005', 'Lý thuyết đồ thị', 4], ['TTH046', 'Toán học tổ hợp', 4], [['MTH00058', 'Toán học tổ hợp', 4]], {
      needs_check: 'HP02 is TTH046, an old-style code (itself HP01 of STT 13), replacing a graph-theory course with combinatorics.',
    }),
    row(15, 1, ['CTT005', 'Lý thuyết đồ thị', 4], ['CSC00008', 4]),
    row(16, 1, ['CTT009', 'Nhập môn Công nghệ Thông tin 1', 3], ['CSC00001', 'Nhập môn Công nghệ thông tin 1', 3], [
      ['CSC00004', 'Nhập môn Công nghệ thông tin', 4],
    ], { needs_check: MERGED_16_17 }),
    row(17, 1, ['CTT010', 'Nhập môn Công nghệ Thông tin 2', 3], ['CSC00002', 'Nhập môn Công nghệ thông tin 2', 3], [
      ['CSC00004', 'Nhập môn Công nghệ thông tin', 4],
    ], { needs_check: MERGED_16_17 }),
    row(18, 1, ['TTH047', 'Toán ứng dụng và thống kê', 4], ['MTH00051', 4], [
      ['MTH00057', 'Toán ứng dụng và thống kê cho Công nghệ thông tin', 4],
    ]),
    row(19, 1, ['CTT011.1', 'Nhập môn văn hoá doanh nghiệp Nhật Bản', 2], ['BAA00009', 2], [], {
      printed_rule: 'HP03: Danh sách môn thay thế thuộc công văn số 76/CNTT-ĐT ngày 8/11/2019',
      needs_check:
        'HP01 code CTT011.1 contains a dot, which the courses.code CHECK does not allow: code left null. HP03 refers ' +
        'to a separate document (công văn 76/CNTT-ĐT, 8/11/2019) that is not in this PDF.',
    }),
    row(20, 1, ['TTH048', 'Phương pháp tính', 4], ['MTH00052', 4]),
    row(21, 1, ['TTH049', 'Lý thuyết số', 4], ['MTH00053', 4]),
    row(22, 1, ['TTH050', 'Phép tính vị từ', 4], ['MTH00054', 4]),
    row(23, 1, ['VLH023', 'Điện từ + Quang - Lượng tử - Nguyên tử', 4], ['PHY00005', 'Vật lý đại cương 1', 4]),
    row(24, 1, ['PHY00085', 'Nhập môn internet vạn vật', 4], ['PHY00006', 'Vật lý đại cương 2', 4], [
      ['PHY00007', 'Vật lý cho Công nghệ thông tin', 4],
    ], { needs_check: 'Printed pairing of "Nhập môn internet vạn vật" with "Vật lý đại cương 2"; transcribed as printed, worth confirming.' }),
    row(25, 2, ['CTT003', 'Nhập môn lập trình', 4], ['CSC10001', 4]),
    row(26, 2, ['CTT006', 'Phương pháp lập trình hướng đối tượng', 4], ['CSC10003', 4]),
    row(27, 2, ['CTT008', 'Kỹ thuật lập trình', 4], ['CSC10002', 4]),
    row(28, 2, ['TCH001', 'Thể dục 1', 2], ['BAA00021', 2]),
    row(29, 2, ['TCH002', 'Thể dục 2', 2], ['BAA00022', 2]),
    row(30, 2, ['QPH010', 'Giáo dục quốc phòng', 4], ['BAA00030', 4]),
    row(31, 2, ['CTT101', 'Cấu trúc dữ liệu và giải thuật', 4], ['CSC10004', 4]),
    row(32, 2, ['CTT102', 'Cơ sở dữ liệu', 4], ['CSC10006', 4]),
    row(33, 2, ['CTT103', 'Hệ điều hành', 4], ['CSC10007', 4]),
    row(34, 2, ['CTT104', 'Kiến trúc máy tính và hợp ngữ', 4], ['CSC10005', 4], [['CSC10009', 'Hệ thống máy tính', 2]]),
    row(35, 2, ['CTT105', 'Mạng máy tính', 4], ['CSC10008', 4]),
    row(36, 2, ['CTT303', 'Cơ sở trí tuệ nhân tạo', 4], ['CSC14003', 4]),
    row(37, 2, ['CTT123', 'Kỹ năng mềm', 3], ['CSC10101', 3], [['CSC10121', 'Kỹ năng mềm', 3]]),
    row(38, 2, ['CTT124', 'Kiến tập nghề nghiệp', 2], ['CSC10102', 2]),
    row(39, 2, ['CTT125', 'Khởi nghiệp', 3], ['CSC10103', 3]),
    row(40, 2, ['CTT126', 'Quy hoạch tuyến tính', 4], ['CSC10104', 4]),
    row(41, 2, ['CTT127', 'Nhập môn tư duy thuật toán', 4], ['CSC10105', 4]),
    row(42, 2, ['CTT128', 'Thuật toán tổ hợp và ứng dụng', 4], ['CSC10106', 4]),
    row(43, 2, ['CTT129', 'Thực tập thực tế', 4], ['CSC10107', 4]),
    row(44, 2, ['CTT991', 'Khóa luận tốt nghiệp', 10], ['CSC10251', 10]),
    row(45, 2, ['CTT992', 'Thực tập tốt nghiệp', 10], ['CSC10252', 10]),
    row(46, 2, ['CTT993', 'Đồ án tốt nghiệp', 6], ['CSC10201', 6], [['CSC10204', 'Thực tập dự án tốt nghiệp', 6]]),
    row(47, 2, ['CTT601', 'Hệ điều hành nâng cao', 4], ['CSC11001', 4], [['CSC11112', 'Chuyên đề Hệ thống phân tán', 4]]),
    row(48, 2, ['CTT602', 'Hệ thống viễn thông', 4], ['CSC11002', 4]),
    row(49, 2, ['CTT603', 'Lập trình mạng', 4], ['CSC11003', 4]),
    row(50, 2, ['CTT604', 'Mạng máy tính nâng cao', 4], ['CSC11004', 4]),
    row(51, 2, ['CTT605', 'Thực tập Mạng máy tính', 4], ['CSC11005', 4]),
    row(52, 2, ['CTT621', 'An ninh mạng', 4], ['CSC11101', 4], [['CSC15001', 'An ninh máy tính', 4]]),
    row(53, 2, ['CTT622', 'An ninh mạng nâng cao', 4], ['CSC11109', 4]),
    row(54, 2, ['CTT623', 'Chuyên đề Hệ điều hành Linux', 4], ['CSC11102', 4], [['CSC11113', 'Quản trị dịch vụ mạng', 4]]),
    row(55, 2, ['CTT628', 'Thiết kế mạng', 4], ['CSC11103', 4]),
    row(56, 2, ['CTT631', 'Truyền thông không dây', 4], ['CSC11106', 4]),
    row(57, 2, ['CTT633', 'Truyền thông kỹ thuật số', 4], ['CSC11107', 4]),
    row(58, 3, ['CTT634', 'Xử lý và tính toán song song', 4], ['CSC11108', 4]),
    row(59, 3, ['CTT635', 'Chuyên đề tốt nghiệp Mạng máy tính', 4], ['CSC11111', 4]),
    row(60, 3, ['CTT201', 'An toàn và bảo mật dữ liệu trong hệ thống thông ti', 4], ['CSC12001', 4], [], {
      needs_check: 'Both names are cut off at the cell edge ("...hệ thống thông ti"); the 2025 curriculum names CSC12001 "...hệ thống thông tin".',
    }),
    row(61, 3, ['CTT202', 'Cơ sở dữ liệu nâng cao', 4], ['CSC12002', 4]),
    row(62, 3, ['CTT203', 'Hệ quản trị cơ sở dữ liệu', 4], ['CSC12003', 4]),
    row(63, 3, ['CTT204', 'Phân tích thiết kế hệ thống thông tin', 4], ['CSC12004', 4]),
    row(64, 3, ['CTT205', 'Phát triển ứng dụng hệ thống thông tin hiện đại', 4], ['CSC12005', 4]),
    row(65, 3, ['CTT221', 'Hệ thống thông tin phục vụ trí tuệ kinh doanh', 4], ['CSC12107', 4]),
    row(66, 3, ['CTT222', 'Chuyên đề chọn lọc trong Hệ thống thông tin', 4], ['CSC12102', 4]),
    row(67, 3, ['CTT224', 'Thương mại điện tử', 4], ['CSC12105', 4]),
    row(68, 3, ['CTT225', 'Tương tác người - máy', 4], ['CSC12106', 4]),
    row(69, 3, ['CTT226', 'Ứng dụng phân tán', 4], ['CSC12108', 4]),
    row(70, 3, ['CTT227', 'Biểu diễn thông tin', 4], ['CSC12101', 4], [['CSC10108', 'Trực quan hóa dữ liệu', 4]]),
    row(71, 3, ['CTT228', 'Chuyên đề Hệ quản trị cơ sở dữ liệu nâng cao', 4], ['CSC12103', 4]),
    row(72, 3, ['CTT501', 'Lập trình Windows', 4], ['CSC13001', 4]),
    row(73, 3, ['CTT502', 'Nhập môn công nghệ phần mềm', 4], ['CSC13002', 4]),
    row(74, 3, ['CTT503', 'Kiểm thử phần mềm', 4], ['CSC13003', 4]),
    row(75, 3, ['CTT504', 'Phân tích và thiết kế phần mềm', 4], ['CSC13004', 4], [['CSC13010', 'Thiết kế phần mềm', 4]]),
    row(76, 3, ['CTT505', 'Phân tích và quản lý yêu cầu phần mềm', 4], ['CSC13005', 4]),
    row(77, 3, ['CTT506', 'Quản lý dự án phần mềm', 4], ['CSC13006', 4]),
    row(78, 3, ['CTT521', 'Các chủ đề nâng cao trong Công nghệ phần mềm', 4], ['CSC13101', 4]),
    row(79, 3, ['CTT522', 'Các công nghệ mới trong phát triển phần mềm', 4], ['CSC13115', 4]),
    row(80, 3, ['CTT523', 'Lập trình ứng dụng Java', 4], ['CSC13102', 4]),
    row(81, 3, ['CTT525', 'Công nghệ Java cho hệ thống phân tán', 4], ['CSC13103', 4]),
    row(82, 3, ['CTT526', 'Kiến trúc phần mềm', 4], ['CSC13106', 4]),
    row(83, 3, ['CTT527', 'Phát triển game', 4], ['CSC13007', 4]),
    row(84, 3, ['CTT528', 'Phát triển ứng dụng web', 4], ['CSC13008', 4]),
    row(85, 3, ['CTT529', 'Mẫu thiết kế hướng đối tượng và ứng dụng', 4], ['CSC13107', 4]),
    row(86, 3, ['CTT530', 'Mô hình hóa phần mềm', 4], ['CSC13108', 4]),
    row(87, 3, ['CTT534', 'Thiết kế giao diện', 4], ['CSC13112', 4]),
    row(88, 3, ['CTT535', 'Phát triển phần mềm cho thiết bị di động', 4], ['CSC13009', 4]),
    row(89, 3, ['CTT538', 'Đồ án Công nghệ phần mềm', 4], ['CSC13116', 4]),
    row(90, 3, ['CTT539', 'Phát triển game nâng cao', 4], ['CSC13117', 4]),
    row(91, 4, ['CTT540', 'Phát triển ứng dụng cho thiết bị di động nâng cao', 4], ['CSC13118', 4]),
    row(92, 4, ['CTT541', 'Phát triển ứng dụng web nâng cao', 4], ['CSC13114', 4]),
    row(93, 4, ['CTT301', 'Automata và ngôn ngữ hình thức', 4], ['CSC14001', 4]),
    row(94, 4, ['CTT302', 'Các hệ cơ sở tri thức', 4], ['CSC14002', 4]),
    row(95, 4, ['CTT304', 'Đồ họa máy tính', 4], ['CSC16001', 4]),
    row(96, 4, ['CTT305', 'Khai thác dữ liệu và ứng dụng', 4], ['CSC14004', 4]),
    row(97, 4, ['CTT306', 'Nhập môn học máy', 4], ['CSC14005', 4]),
    row(98, 4, ['CTT307', 'Nhận dạng', 4], ['CSC14006', 4]),
    row(99, 4, ['CTT308', 'Nhập môn phân tích độ phức tạp thuật toán', 4], ['CSC14007', 4]),
    row(100, 4, ['CTT309', 'Trình biên dịch', 4], ['CSC14113', 4]),
    row(101, 4, ['CTT310', 'Xử lý ảnh số và video số', 4], ['CSC16005', 4]),
    row(102, 4, ['CTT311', 'Nhập môn thiết kế và phân tích giải thuật', 4], ['CSC14111', 4]),
    row(103, 4, ['CTT321', 'Ẩn dữ liệu và chia sẻ thông tin', 4], ['CSC14101', 4]),
    row(104, 4, ['CTT323', 'Lập trình nhúng cơ bản', 4], ['CSC14107', 4], [['CSC14117', 'Nhập môn lập trình kết nối vạn vật', 4]]),
    row(105, 4, ['CTT325', 'Lập trình song song ứng dụng', 4], ['CSC14116', 4]),
    row(106, 4, ['CTT326', 'Logic mờ và ứng dụng', 4], ['CSC14109', 4]),
    row(107, 4, ['CTT329', 'Sinh trắc học', 4], ['CSC14112', 4]),
    row(108, 4, ['CTT335', 'Khoa học về web', 4], ['CSC14105', 4]),
    row(109, 4, ['CTT336', 'Hệ thống thông minh', 4], ['CSC14103', 4]),
    row(110, 4, ['CTT337', 'Phương pháp nghiên cứu khoa học', 4], ['CSC14008', 4]),
    row(111, 4, ['CTT339', 'Ứng dụng dữ liệu lớn', 4], ['CSC14114', 4]),
    row(112, 4, ['CTT340', 'Khoa học dữ liệu ứng dụng', 4], ['CSC14115', 4]),
    row(113, 4, ['CTT331', 'Lập trình logic', 4], ['CTT421', 'Logic toán - Lập trình hàm', 4], [
      ['CSC15101', 'Logic toán - Lập trình hàm', null],
    ], { needs_check: 'HP02 is CTT421, an old-style code. The HP03 credit cell is blank.' }),
    row(114, 4, ['CTT401', 'An ninh máy tính', 4], ['CSC15001', 4]),
    row(115, 4, ['CTT402', 'Bảo mật cơ sở dữ liệu', 4], ['CSC15002', 4]),
    row(116, 4, ['CTT403', 'Mã hóa ứng dụng', 4], ['CSC15003', 4]),
    row(117, 4, ['CTT404', 'Nhập môn mã hóa - mật mã', 4], ['CSC15005', 4]),
    row(118, 4, ['CTT405', 'Nhập môn xử lý ngôn ngữ tự nhiên', 4], ['CSC15006', 4]),
    row(119, 4, ['CTT406', 'Thống kê máy tính và ứng dụng', 4], ['CSC15007', 4]),
    row(120, 4, ['CTT407', 'Xử lý ngôn ngữ tự nhiên ứng dụng', 4], ['CSC15008', 4]),
    row(121, 4, ['CTT408', 'Xử lý tín hiệu số', 4], ['CSC15009', 4]),
    row(122, 4, ['CTT409', 'Học thống kê', 4], ['CSC15004', 4]),
    row(123, 4, ['CTT410', 'An toàn và phục hồi dữ liệu', 4], ['CSC15104', 4]),
    row(124, 5, ['CTT422', 'Tính toán tài chính', 4], ['CSC15103', 4]),
    row(125, 5, ['CTT423', 'Phân tích mạng xã hội', 4], ['CSC15102', 4]),
    row(126, 5, ['CTT424', 'Khai thác dữ liệu văn bản và ứng dụng', 4], ['CSC15105', 4]),
    row(127, 5, ['CTT425', 'Đồ án Mã hóa ứng dụng và an ninh thông tin', 4], ['CSC15201', 4], [], {
      needs_check: CREDITS_DIFFER('CSC15201', 6),
    }),
    row(128, 5, ['CTT426', 'Đồ án Ngôn ngữ học tính toán', 4], ['CSC15202', 4], [], {
      needs_check: `${CREDITS_DIFFER('CSC15202', 6)} The 2025 name is also different ("Đồ án ứng dụng xử lý ngôn ngữ tự nhiên").`,
    }),
    row(129, 5, ['CTT328', 'Phân tích thống kê dữ liệu nhiều biến', 4], ['CSC16003', 4]),
    row(130, 5, ['CTT330', 'Truy vấn thông tin thị giác', 4], ['CSC16105', 4]),
    row(131, 5, ['CTT332', 'Đồ họa ứng dụng', 4], ['CSC16101', 4]),
    row(132, 5, ['CTT451', 'Thị giác máy tính', 4], ['CSC16004', 4]),
    row(133, 5, ['CTT471', 'Chuyên đề Đồ họa máy tính', 4], ['CSC16110', 4]),
    row(134, 5, ['CTT472', 'Kỹ thuật lập trình xử lý ảnh số và video số', 4], ['CSC16102', 4]),
    row(135, 5, ['CTT474', 'Phương pháp toán trong phân tích dữ liệu thị giác', 4], ['CSC16002', 4]),
    row(136, 5, ['CTT475', 'Chuyên đề Thị giác máy tính', 4], ['CSC16111', 4]),
    row(137, 5, ['CTT476', 'Thị giác robot', 4], ['CSC16104', 4]),
    row(138, 5, ['CTT478', 'Chuyên đề Xử lý ảnh số và video số', 4], ['CSC16112', 4]),
    row(139, 5, ['CTT479', 'Nhập môn lập trình điều khiển thiết bị thông minh', 4], ['CSC16106', 4]),
    row(140, 5, ['CTT480', 'Ứng dụng thị giác máy tính', 4], ['CSC16107', 4]),
    row(141, 5, ['CTT481', 'Ứng dụng xử lý ảnh số và video số', 4], ['CSC16109', 4]),
  ],
};
