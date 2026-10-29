import { bb, tc } from './rows.js';
import type { ClcRows } from './clc-2025-shared.js';

// Rows of TCTA_CTDT_2025_KHDL.pdf (8 pages), the course table of the
// "Khoa học dữ liệu" specialisation, Tăng cường tiếng Anh (CLC) program, cohort 2025.
// The PDF prints no page numbers: pages are physical pages of that file.
// STT is the printed row number. The group of each row follows the
// "Nhóm kiến thức" column, cross-checked against booklet sections 7.1-7.2.3.

export const clc2025KhdlRows: ClcRows = {
  llct: [
    bb('BAA00101', 'Triết học Mác - Lênin', 3, 45, 0, 0, 0, 1), // STT 1
    bb('BAA00102', 'Kinh tế chính trị Mác - Lênin', 2, 30, 0, 0, 0, 1), // STT 2
    bb('BAA00103', 'Chủ nghĩa xã hội khoa học', 2, 30, 0, 0, 0, 1), // STT 3
    bb('BAA00104', 'Lịch sử Đảng Cộng sản Việt Nam', 2, 30, 0, 0, 0, 1), // STT 4
    bb('BAA00003', 'Tư tưởng Hồ Chí Minh', 2, 30, 0, 0, 0, 1), // STT 5
    bb('BAA00004', 'Pháp luật đại cương', 3, 45, 0, 0, 0, 1), // STT 6
  ],
  khxh: [
    tc('BAA00005', 'Kinh tế đại cương', 2, 30, 0, 0, 0, 1), // STT 7
    tc('BAA00006', 'Tâm lý đại cương', 2, 30, 0, 0, 0, 1), // STT 8
    tc('BAA00007', 'Phương pháp luận sáng tạo', 2, 30, 0, 0, 0, 1), // STT 9
  ],
  toan_bb: [
    bb('MTH00005', 'Vi tích phân 1', 4, 45, 0, 30, 0, 1), // STT 10
    bb('MTH00006', 'Vi tích phân 2', 4, 45, 0, 30, 0, 1), // STT 11
    bb('MTH00007', 'Xác suất thống kê', 4, 45, 0, 30, 0, 1), // STT 12
    bb('MTH00008', 'Đại số tuyến tính', 4, 45, 0, 30, 0, 1), // STT 13
    bb('MTH00009', 'Toán rời rạc', 4, 45, 0, 30, 0, 1), // STT 14
    bb('MTH00058', 'Toán học tổ hợp', 4, 45, 0, 30, 0, 1), // STT 15
  ],
  toan_math: [
    tc('MTH00057', 'Toán ứng dụng và thống kê cho Công nghệ thông tin', 4, 45, 30, 0, 0, 1), // STT 16
    tc('MTH00059', 'Phương pháp tính', 4, 45, 0, 30, 0, 1), // STT 17
    tc('MTH00060', 'Lý thuyết số', 4, 45, 0, 30, 0, 1), // STT 18
  ],
  toan_science: [
    tc('CHE00001', 'Hóa đại cương 1', 3, 30, 0, 30, 0, 1), // STT 19
    tc('CHE00002', 'Hóa đại cương 2', 3, 30, 0, 30, 0, 1), // STT 20
    tc('CHE00081', 'Thực hành Hóa đại cương 1', 2, 0, 60, 0, 0, 1), // STT 21
    tc('CHE00082', 'Thực hành Hóa đại cương 2', 2, 0, 60, 0, 0, 1), // STT 22
    tc('BIO00001', 'Sinh đại cương 1', 3, 45, 0, 0, 0, 1), // STT 23
    tc('BIO00002', 'Sinh đại cương 2', 3, 45, 0, 0, 0, 1), // STT 24
    tc('BIO00081', 'Thực tập Sinh đại cương 1', 1, 0, 30, 0, 0, 1), // STT 25
    tc('BIO00082', 'Thực tập Sinh đại cương 2', 1, 0, 30, 0, 0, 2), // STT 26
    tc('PHY00005', 'Vật lý đại cương 1', 4, 45, 0, 30, 0, 2), // STT 27
    tc('PHY00007', 'Vật lý cho Công nghệ thông tin', 4, 45, 30, 0, 0, 2), // STT 28
    tc('GEO00002', 'Khoa học Trái đất', 2, 30, 0, 0, 0, 2), // STT 29
    tc('ENV00001', 'Môi trường đại cương', 2, 30, 0, 0, 0, 2), // STT 30
    tc('ENV00003', 'Con người và môi trường', 2, 30, 0, 0, 0, 2), // STT 31
  ],
  tin: [
    bb('CSC00004', 'Nhập môn Công nghệ thông tin', 4, 45, 30, 0, 0, 2), // STT 32
  ],
  gdtc: [
    bb('BAA00021', 'Thể dục 1', 2, 15, 30, 0, 0, 2), // STT 33
    bb('BAA00022', 'Thể dục 2', 2, 15, 30, 0, 0, 2), // STT 34
  ],
  gdqp: [
    bb('BAA00030', 'Giáo dục quốc phòng - An ninh', 4, null, null, null, null, 2), // STT 35
  ],
  csn: [
    bb('CSC10012', 'Cơ sở lập trình', 4, 45, 30, 0, 0, 2), // STT 36
    bb('CSC10003', 'Phương pháp lập trình hướng đối tượng', 4, 45, 30, 0, 0, 2), // STT 37
    bb('CSC10004', 'Cấu trúc dữ liệu và giải thuật', 4, 45, 30, 0, 0, 2), // STT 38
    bb('CSC10014', 'Tư duy tính toán', 4, 45, 30, 0, 0, 2), // STT 39
    bb('CSC10006', 'Cơ sở dữ liệu', 4, 45, 30, 0, 0, 2), // STT 40
    bb('CSC10007', 'Hệ điều hành', 4, 45, 30, 0, 0, 2), // STT 41
    bb('CSC10008', 'Mạng máy tính', 4, 45, 30, 0, 0, 2), // STT 42
    bb('CSC10009', 'Hệ thống máy tính', 2, 30, 0, 0, 0, 2), // STT 43
    bb('CSC13002', 'Nhập môn công nghệ phần mềm', 4, 45, 30, 0, 0, 2), // STT 44
    bb('CSC14003', 'Cơ sở trí tuệ nhân tạo', 4, 45, 30, 0, 0, 2), // STT 45
  ],
  bbcn: [
    tc('CSC10108', 'Trực quan hóa dữ liệu', 4, 45, 30, 0, 0, 2), // STT 46
    tc('CSC14004', 'Khai thác dữ liệu và ứng dụng', 4, 45, 30, 0, 0, 2), // STT 47
    tc('CSC14005', 'Nhập môn học máy', 4, 45, 30, 0, 0, 2), // STT 48
    tc('CSC14119', 'Nhập môn khoa học dữ liệu', 4, 45, 30, 0, 0, 2), // STT 49
    tc('CSC17001', 'Phân tích dữ liệu thông minh', 4, 45, 30, 0, 0, 2), // STT 50
    tc('CSC17104', 'Lập trình cho khoa học dữ liệu', 4, 45, 30, 0, 0, 3), // STT 51
  ],
  tccn: [
    tc('CSC14117', 'Nhập môn lập trình kết nối vạn vật', 4, 45, 30, 0, 0, 3), // STT 52
    tc('CSC14118', 'Nhập môn dữ liệu lớn', 4, 45, 30, 0, 0, 3), // STT 53
    tc('CSC14120', 'Lập trình song song', 4, 45, 30, 0, 0, 3), // STT 54
    tc('CSC15004', 'Học thống kê', 4, 45, 30, 0, 0, 3), // STT 55
    tc('CSC15007', 'Thống kê máy tính và ứng dụng', 4, 45, 30, 0, 0, 3), // STT 56
    tc('CSC15102', 'Phân tích mạng xã hội', 4, 45, 30, 0, 0, 3), // STT 57
    tc('CSC17103', 'Khai thác dữ liệu đồ thị', 4, 45, 30, 0, 0, 3), // STT 58
    tc('CSC17106', 'Xử lý phân tích dữ liệu trực tuyến', 4, 45, 30, 0, 0, 3), // STT 59
    tc('CSC18001', 'Nhập môn học sâu', 4, 45, 30, 0, 0, 3), // STT 60
    tc('CSC18002', 'Nhập môn Trí tuệ nhân tạo tạo sinh', 4, 45, 30, 0, 0, 3), // STT 61
    tc('CSC18106', 'Mô hình ngôn ngữ lớn', 4, 45, 30, 0, 0, 3), // STT 62
    tc('CSC18107', 'Các chủ đề chọn lọc trong Trí tuệ nhân tạo', 4, 45, 30, 0, 0, 3), // STT 63
  ],
  tn: [
    tc('CSC10251', 'Khóa luận tốt nghiệp', 10, 0, 0, 0, 300, 3), // STT 64
    tc('CSC10252', 'Thực tập tốt nghiệp', 10, 0, 0, 0, 300, 3), // STT 65
    tc('CSC10204', 'Thực tập dự án tốt nghiệp', 6, 0, 0, 0, 180, 3), // STT 66
    tc('CSC14115', 'Khoa học dữ liệu ứng dụng', 4, 45, 30, 0, 0, 3), // STT 67
    tc('CSC14116', 'Lập trình song song ứng dụng', 4, 45, 30, 0, 0, 3), // STT 68
    tc('CSC17107', 'Ứng dụng phân tích dữ liệu thông minh', 4, 45, 30, 0, 0, 3), // STT 69
  ],
  free: [
    tc('CSC11002', 'Hệ thống viễn thông', 4, 45, 30, 0, 0, 3), // STT 70
    tc('CSC11003', 'Lập trình mạng', 4, 45, 30, 0, 0, 3), // STT 71
    tc('CSC11004', 'Mạng máy tính nâng cao', 4, 45, 30, 0, 0, 3), // STT 72
    tc('CSC11006', 'Nhập môn điện toán đám mây', 4, 45, 30, 0, 0, 3), // STT 73
    tc('CSC11007', 'Nhập môn DevOps', 4, 45, 30, 0, 0, 3), // STT 74
    tc('CSC11115', 'An ninh mạng', 4, 45, 30, 0, 0, 3), // STT 75
    tc('CSC15001', 'An ninh máy tính', 4, 45, 30, 0, 0, 4), // STT 76
    tc('CSC15005', 'Nhập môn mã hóa - mật mã', 4, 45, 30, 0, 0, 4), // STT 77
    tc('CSC10107', 'Thực tập thực tế', 4, 30, 60, 0, 0, 4), // STT 78
    tc('CSC11106', 'Truyền thông không dây', 4, 45, 30, 0, 0, 4), // STT 79
    tc('CSC11116', 'DevOps nâng cao', 4, 45, 30, 0, 0, 4), // STT 80
    tc('CSC11117', 'Hệ điều hành Linux và ứng dụng', 4, 45, 30, 0, 0, 4), // STT 81
    tc('CSC11118', 'Triển khai và vận hành điện toán đám mây', 4, 45, 30, 0, 0, 4), // STT 82
    tc('CSC11120', 'Bảo mật web và thiết bị di động', 4, 45, 30, 0, 0, 4), // STT 83
    tc('CSC15002', 'Bảo mật cơ sở dữ liệu', 4, 45, 30, 0, 0, 4), // STT 84
    tc('CSC15003', 'Mã hóa ứng dụng', 4, 45, 30, 0, 0, 4), // STT 85
    tc('CSC12001', 'An toàn và bảo mật dữ liệu trong hệ thống thông tin', 4, 45, 30, 0, 0, 4), // STT 86
    tc('CSC12002', 'Cơ sở dữ liệu nâng cao', 4, 45, 30, 0, 0, 4), // STT 87
    tc('CSC12003', 'Hệ quản trị cơ sở dữ liệu', 4, 45, 30, 0, 0, 4), // STT 88
    tc('CSC12004', 'Phân tích thiết kế hệ thống thông tin', 4, 45, 30, 0, 0, 4), // STT 89
    tc('CSC12005', 'Phát triển ứng dụng hệ thống thông tin hiện đại', 4, 45, 30, 0, 0, 4), // STT 90
    tc('CSC10102', 'Kiến tập nghề nghiệp', 2, 15, 30, 0, 0, 4), // STT 91
    tc('CSC10103', 'Khởi nghiệp', 3, 30, 30, 0, 0, 4), // STT 92
    tc('CSC10104', 'Quy hoạch tuyến tính', 4, 45, 30, 0, 0, 4), // STT 93
    tc('CSC10105', 'Nhập môn tư duy thuật toán', 4, 45, 30, 0, 0, 4), // STT 94
    tc('CSC10106', 'Thuật toán tổ hợp và ứng dụng', 4, 45, 30, 0, 0, 4), // STT 95
    tc('CSC10121', 'Kỹ năng mềm', 3, 30, 30, 0, 0, 4), // STT 96
    tc('CSC12102', 'Chuyên đề chọn lọc trong Hệ thống thông tin', 4, 45, 30, 0, 0, 4), // STT 97
    tc('CSC12103', 'Chuyên đề Hệ quản trị cơ sở dữ liệu nâng cao', 4, 45, 30, 0, 0, 4), // STT 98
    tc('CSC12105', 'Thương mại điện tử', 4, 45, 30, 0, 0, 4), // STT 99
    tc('CSC12106', 'Tương tác người - máy', 4, 45, 30, 0, 0, 4), // STT 100
    tc('CSC12109', 'Hệ thống thông tin doanh nghiệp', 4, 45, 30, 0, 0, 5), // STT 101
    tc('CSC12110', 'Phân tích dữ liệu ứng dụng', 4, 45, 30, 0, 0, 5), // STT 102
    tc('CSC17101', 'Hệ thống tư vấn', 4, 45, 30, 0, 0, 5), // STT 103
    tc('CSC13003', 'Kiểm thử phần mềm', 4, 45, 30, 0, 0, 5), // STT 104
    tc('CSC13005', 'Phân tích và quản lý yêu cầu phần mềm', 4, 45, 30, 0, 0, 5), // STT 105
    tc('CSC13006', 'Quản lý dự án phần mềm', 4, 45, 30, 0, 0, 5), // STT 106
    tc('CSC13007', 'Phát triển game', 4, 45, 30, 0, 0, 5), // STT 107
    tc('CSC13008', 'Phát triển ứng dụng web', 4, 45, 30, 0, 0, 5), // STT 108
    tc('CSC13009', 'Phát triển phần mềm cho thiết bị di động', 4, 45, 30, 0, 0, 5), // STT 109
    tc('CSC13010', 'Thiết kế phần mềm', 4, 45, 30, 0, 0, 5), // STT 110
    tc('CSC13106', 'Kiến trúc phần mềm', 4, 45, 30, 0, 0, 5), // STT 111
    tc('CSC13112', 'Thiết kế giao diện', 4, 45, 30, 0, 0, 5), // STT 112
    tc('CSC13001', 'Lập trình Windows', 4, 45, 30, 0, 0, 5), // STT 113
    tc('CSC13101', 'Các chủ đề nâng cao trong Công nghệ phần mềm', 4, 45, 30, 0, 0, 5), // STT 114
    tc('CSC13102', 'Lập trình ứng dụng Java', 4, 45, 30, 0, 0, 5), // STT 115
    tc('CSC13103', 'Nhập môn hệ thống phân tán', 4, 45, 30, 0, 0, 5), // STT 116
    tc('CSC13107', 'Mẫu thiết kế hướng đối tượng và ứng dụng', 4, 45, 30, 0, 0, 5), // STT 117
    tc('CSC13117', 'Phát triển game nâng cao', 4, 45, 30, 0, 0, 5), // STT 118
    tc('CSC16106', 'Nhập môn lập trình điều khiển thiết bị thông minh', 4, 45, 30, 0, 0, 5), // STT 119
    tc('CSC16115', 'Triển khai và vận hành hệ thống học máy', 4, 45, 30, 0, 0, 5), // STT 120
    tc('CSC14001', 'Automata và ngôn ngữ hình thức', 4, 45, 30, 0, 0, 5), // STT 121
    tc('CSC14002', 'Các hệ cơ sở tri thức', 4, 45, 30, 0, 0, 5), // STT 122
    tc('CSC14006', 'Nhận dạng', 4, 45, 30, 0, 0, 5), // STT 123
    tc('CSC14101', 'Ẩn dữ liệu và chia sẻ thông tin', 4, 45, 30, 0, 0, 5), // STT 124
    tc('CSC14111', 'Nhập môn thiết kế và phân tích giải thuật', 4, 45, 30, 0, 0, 5), // STT 125
    tc('CSC15006', 'Nhập môn xử lý ngôn ngữ tự nhiên', 4, 45, 30, 0, 0, 6), // STT 126
    tc('CSC16004', 'Thị giác máy tính', 4, 45, 30, 0, 0, 6), // STT 127
    tc('CSC18101', 'Trí tuệ nhân tạo cho an ninh thông tin', 4, 45, 30, 0, 0, 6), // STT 128
    tc('CSC18102', 'Phương pháp toán cho tối ưu', 4, 45, 30, 0, 0, 6), // STT 129
    tc('CSC18103', 'Trí tuệ bầy đàn', 4, 45, 30, 0, 0, 6), // STT 130
    tc('CSC18104', 'Nhập môn hệ thống đa tác nhân', 4, 45, 30, 0, 0, 6), // STT 131
    tc('CSC14008', 'Phương pháp nghiên cứu khoa học', 4, 45, 30, 0, 0, 6), // STT 132
    tc('CSC14105', 'Khoa học về web', 4, 45, 30, 0, 0, 6), // STT 133
    tc('CSC14112', 'Sinh trắc học', 4, 45, 30, 0, 0, 6), // STT 134
    tc('CSC14113', 'Trình biên dịch', 4, 45, 30, 0, 0, 6), // STT 135
    tc('CSC16005', 'Xử lý ảnh số và video số', 4, 45, 30, 0, 0, 6), // STT 136
    tc('CSC14007', 'Nhập môn phân tích độ phức tạp thuật toán', 4, 45, 30, 0, 0, 6), // STT 137
    tc('CSC15009', 'Xử lý tín hiệu số', 4, 45, 30, 0, 0, 6), // STT 138
    tc('CSC15011', 'Nhập môn ngôn ngữ học thống kê và ứng dụng', 4, 45, 30, 0, 0, 6), // STT 139
    tc('CSC15012', 'Ứng dụng xử lý ngôn ngữ tự nhiên trong doanh nghiệp', 4, 45, 30, 0, 0, 6), // STT 140
    tc('CSC15109', 'Nhập môn tính toán lượng tử', 4, 45, 30, 0, 0, 6), // STT 141
    tc('CSC15010', 'Blockchain và ứng dụng', 4, 45, 30, 0, 0, 6), // STT 142
    tc('CSC15107', 'Phân tích dữ liệu bảo toàn tính riêng tư', 4, 45, 30, 0, 0, 6), // STT 143
    tc('CSC15108', 'Pháp chứng cho dữ liệu số', 4, 45, 30, 0, 0, 6), // STT 144
    tc('CSC15110', 'Các công nghệ tiên tiến trong xử lý ngôn ngữ tự nhiên', 4, 45, 30, 0, 0, 6), // STT 145
    tc('CSC16001', 'Đồ họa máy tính', 4, 45, 30, 0, 0, 6), // STT 146
    tc('CSC16002', 'Phương pháp toán trong phân tích dữ liệu thị giác', 4, 45, 30, 0, 0, 6), // STT 147
    tc('CSC16003', 'Phân tích thống kê dữ liệu nhiều biến', 4, 45, 30, 0, 0, 6), // STT 148
    tc('CSC16101', 'Đồ họa ứng dụng', 4, 45, 30, 0, 0, 6), // STT 149
    tc('CSC16102', 'Kỹ thuật lập trình xử lý ảnh số và video số', 4, 45, 30, 0, 0, 6), // STT 150
    tc('CSC16105', 'Truy vấn thông tin thị giác', 4, 45, 30, 0, 0, 7), // STT 151
    tc('CSC16107', 'Ứng dụng thị giác máy tính', 4, 45, 30, 0, 0, 7), // STT 152
    tc('CSC16109', 'Ứng dụng xử lý ảnh số và video số', 4, 45, 30, 0, 0, 7), // STT 153
    tc('CSC16113', 'Thị giác máy tính ba chiều', 4, 45, 30, 0, 0, 7), // STT 154
    tc('CSC16114', 'Học sâu trong thị giác máy tính', 4, 45, 30, 0, 0, 7), // STT 155
    tc('CSC11111', 'Chuyên đề tốt nghiệp Mạng máy tính', 4, 45, 30, 0, 0, 7), // STT 156
    tc('CSC11112', 'Chuyên đề Hệ thống phân tán', 4, 45, 30, 0, 0, 7), // STT 157
    tc('CSC11119', 'Chuyên đề phân tích mạng', 4, 45, 30, 0, 0, 7), // STT 158
    tc('CSC12107', 'Hệ thống thông tin phục vụ trí tuệ kinh doanh', 4, 45, 30, 0, 0, 7), // STT 159
    tc('CSC12108', 'Ứng dụng phân tán', 4, 45, 30, 0, 0, 7), // STT 160
    tc('CSC12111', 'Quản trị cơ sở dữ liệu hiện đại', 4, 45, 30, 0, 0, 7), // STT 161
    tc('CSC13114', 'Phát triển ứng dụng web nâng cao', 4, 45, 30, 0, 0, 7), // STT 162
    tc('CSC13115', 'Các công nghệ mới trong phát triển phần mềm', 4, 45, 30, 0, 0, 7), // STT 163
    tc('CSC13116', 'Đồ án Công nghệ phần mềm', 4, 45, 30, 0, 0, 7), // STT 164
    tc('CSC13118', 'Phát triển ứng dụng cho thiết bị di động nâng cao', 4, 45, 30, 0, 0, 7), // STT 165
    tc('CSC14114', 'Ứng dụng dữ liệu lớn', 4, 45, 30, 0, 0, 7), // STT 166
    tc('CSC18105', 'Trí tuệ nhân tạo ứng dụng', 4, 45, 30, 0, 0, 7), // STT 167
    tc('CSC15201', 'Đồ án Mã hóa ứng dụng và an ninh thông tin', 6, 30, 0, 0, 120, 7), // STT 168
    tc('CSC15202', 'Đồ án ứng dụng xử lý ngôn ngữ tự nhiên', 6, 30, 0, 0, 120, 7), // STT 169
    tc('CSC15104', 'An toàn và phục hồi dữ liệu', 4, 45, 30, 0, 0, 7), // STT 170
    tc('CSC15105', 'Khai thác dữ liệu văn bản và ứng dụng', 4, 45, 30, 0, 0, 7), // STT 171
    tc('CSC15106', 'Seminar Công nghệ tri thức', 4, 45, 30, 0, 0, 7), // STT 172
    tc('CSC16110', 'Chuyên đề Đồ họa máy tính', 4, 45, 30, 0, 0, 7), // STT 173
    tc('CSC16111', 'Chuyên đề Thị giác máy tính', 4, 45, 30, 0, 0, 7), // STT 174
    tc('CSC16112', 'Chuyên đề Xử lý ảnh số và video số', 4, 45, 30, 0, 0, 7), // STT 175
    tc('CSC10202', 'Chuyên đề Tổ chức dữ liệu', 6, 60, 60, 0, 0, 8), // STT 176
    tc('CSC10203', 'Chuyên đề Thiết kế phần mềm nâng cao', 6, 60, 60, 0, 0, 8), // STT 177
    tc('CSC13123', 'Đồ án Phần mềm', 6, 60, 60, 0, 0, 8), // STT 178
    tc('CSC00008', 'Lý thuyết đồ thị', 4, 45, 30, 0, 0, 8), // STT 179
    tc('CSC11114', 'Ứng dụng dịch vụ điện toán đám mây cho doanh nghiệp', 4, 45, 30, 0, 0, 8), // STT 180
    tc('CSC12112', 'Môi trường và công cụ cho tiếp thị số', 4, 45, 30, 0, 0, 8), // STT 181
    tc('CSC12113', 'Nhập môn quản trị mối quan hê khách hàng - sản phẩm', 4, 45, 30, 0, 0, 8, { needs_check: 'Printed "quan hê" here and in the booklet (p.25); likely "quan hệ". Kept as printed.' }), // STT 182
    tc('CSC13119', 'Lập trình Web 1', 4, 45, 30, 0, 0, 8), // STT 183
    tc('CSC13120', 'Lập trình Web 2', 4, 45, 30, 0, 0, 8), // STT 184
    tc('CSC13121', 'Lập trình ứng dụng quản lý 1', 4, 45, 30, 0, 0, 8), // STT 185
    tc('CSC13122', 'Lập trình ứng dụng quản lý 2', 4, 45, 30, 0, 0, 8), // STT 186
    tc('CSC17102', 'Học sâu cho khoa học dữ liệu', 4, 45, 30, 0, 0, 8), // STT 187
  ],
};
