import { type Token, tokens } from './text.js';

// A small curated map from how students ask (English, Vietnamese slang, abbreviations) to the words
// the regulation uses (ADR 0015). Each entry: the phrases, folded, and the regulation's wording.
// Matched on the folded question, longest phrase first; the phrase is replaced by the wording.
// Add an entry with a labelled question in retrieval.spec.ts that needs it.
const ENTRIES: [phrases: string[], regulation: string][] = [
  // Credits and load
  [['credit', 'credits', 'credit hours', 'tc', 'tchi'], 'tín chỉ'],
  [['course load', 'study load', 'workload', 'load'], 'khối lượng tín chỉ'],
  [['maximum', 'max', 'at most', 'upper limit', 'cap', 'limit', 'how many'], 'tối đa'],
  [['minimum', 'min', 'at least', 'lower limit', 'fewest'], 'tối thiểu'],
  [['register', 'registration', 'enrol', 'enroll', 'enrollment', 'enrolment', 'sign up', 'dkhp', 'take'], 'đăng ký học phần'],
  [['term', 'terms', 'semester', 'semesters', 'hk'], 'học kỳ'],
  [['summer', 'summer term', 'ky he', 'hoc ky he'], 'học kỳ hè'],
  [['main term', 'regular term', 'regular semester'], 'học kỳ chính'],
  [['double major', 'two programs', 'two programmes', 'second degree', 'second major', 'song nganh', 'hai nganh', 'bang kep'], 'học cùng lúc hai chương trình ngành thứ hai'],
  [['advanced program', 'apcs', 'tien tien'], 'chương trình tiên tiến'],
  [['high quality', 'clc'], 'chất lượng cao'],
  // Courses
  [['course', 'courses', 'subject', 'subjects', 'mon', 'mon hoc', 'class', 'module'], 'học phần'],
  [['elective', 'electives', 'optional course'], 'học phần tự chọn'],
  [['compulsory', 'mandatory', 'required course', 'core course'], 'học phần bắt buộc'],
  [['prerequisite', 'prerequisites', 'prereq', 'prereqs', 'mon tien quyet'], 'học phần tiên quyết'],
  [['syllabus', 'course outline'], 'đề cương chi tiết học phần'],
  [['period', 'class period', 'lesson'], 'tiết học'],
  [['timetable', 'schedule', 'class times', 'lich hoc'], 'thời khoá biểu phân bố giờ học'],
  [['online', 'online class', 'online classes', 'hoc online'], 'trực tuyến'],
  // Grades
  [['grade', 'grades', 'score', 'scores', 'mark', 'marks'], 'điểm học phần'],
  [['gpa', 'grade point average', 'cumulative gpa', 'cgpa', 'average grade', 'average', 'dtb', 'diem tb'], 'điểm trung bình tích lũy'],
  [['pass', 'passed', 'passing', 'qua mon'], 'đạt'],
  [['fail', 'failed', 'failing', 'rot', 'rot mon', 'truot', 'truot mon', 'tach mon'], 'không đạt học lại'],
  [['retake', 'retaking', 'repeat a course', 'repeat', 'take again', 'hoc lai'], 'học lại'],
  [['improve', 'improve my grade', 'grade improvement', 'raise my grade', 'hoc cai thien'], 'học cải thiện điểm'],
  [['exam', 'exams', 'final exam', 'final', 'test'], 'thi kết thúc học phần'],
  [['postpone', 'defer', 'missed exam', 'miss the exam', 'miss an exam', 'miss the final exam', 'miss'], 'hoãn thi điểm I'],
  [['sick', 'ill', 'illness', 'injured', 'accident', 'bi om', 'om'], 'ốm đau tai nạn'],
  [['absent', 'absence', 'skip the exam'], 'vắng mặt'],
  [['weight', 'weighting', 'coursework', 'midterm', 'diem qua trinh'], 'điểm quá trình tỉ trọng'],
  [['ranking', 'rank', 'classification', 'honors', 'honours', 'distinction', 'xep loai', 'loai gioi', 'loai kha'], 'xếp loại hạng tốt nghiệp'],
  [['year level', 'year standing', 'class standing', 'sophomore', 'junior', 'senior', 'freshman', 'nam may'], 'trình độ năm học'],
  // Progress and status
  [['graduate', 'graduation', 'graduating', 'ra truong', 'xet tot nghiep'], 'tốt nghiệp xét tốt nghiệp'],
  [['requirements', 'requirement', 'conditions', 'condition', 'eligible', 'eligibility', 'qualify'], 'điều kiện'],
  [['degree', 'diploma', 'certificate'], 'bằng tốt nghiệp'],
  [['thesis', 'capstone', 'final project', 'graduation project', 'kltn'], 'khóa luận tốt nghiệp đồ án tốt nghiệp'],
  [['internship', 'thuc tap'], 'thực tập tốt nghiệp'],
  [['warning', 'academic warning', 'probation', 'academic probation'], 'cảnh báo học tập'],
  [['expelled', 'expulsion', 'dismissed', 'dismissal', 'kicked out', 'duoi hoc', 'bi duoi'], 'buộc thôi học'],
  [['drop out', 'dropout', 'quit', 'withdraw from school', 'leave school'], 'thôi học'],
  [['leave of absence', 'take a break', 'gap', 'gap year', 'pause my studies', 'defer my studies', 'nghi hoc', 'nghi tam thoi'], 'nghỉ học tạm thời bảo lưu'],
  [['how long', 'time limit', 'maximum time', 'deadline to finish', 'years to finish', 'finish early', 'extend', 'extension', 'study duration'], 'thời gian tối đa hoàn thành khoá học'],
  [['transfer', 'switch program', 'change program', 'change major', 'chuyen nganh'], 'chuyển chương trình chuyển trường'],
  [['exchange', 'exchange student'], 'trao đổi sinh viên'],
  [['credit transfer', 'recognition', 'recognised', 'recognized', 'exemption', 'exempt', 'waive', 'mien mon'], 'công nhận chuyển đổi tín chỉ miễn học'],
  [['cheating', 'cheat', 'plagiarism', 'misconduct', 'discipline', 'thi ho'], 'gian lận kỷ luật vi phạm'],
  [['tuition', 'fee', 'fees'], 'học phí'],
  [['foreign language', 'english requirement', 'language requirement', 'ielts', 'toeic'], 'chuẩn trình độ ngoại ngữ'],
  [['physical education', 'military education', 'gdqp', 'gdtc'], 'giáo dục quốc phòng giáo dục thể chất'],
  [['regulation', 'regulations', 'rules', 'policy', 'quy che'], 'quy chế'],
];

const TABLE: { phrase: string[]; replacement: Token[] }[] = ENTRIES.flatMap(([phrases, regulation]) =>
  phrases.map((p) => ({ phrase: p.split(' '), replacement: tokens(regulation) })),
).sort((a, b) => b.phrase.length - a.phrase.length);

/**
 * The words of a question with each known phrase (matched folded) replaced by the regulation's
 * wording. A replaced phrase no longer counts as an unknown word, so an English question can match.
 */
export function expandSynonyms(sequence: Token[]): Token[] {
  const out: Token[] = [];
  let group = 0;
  for (let i = 0; i < sequence.length; ) {
    const hit = TABLE.find(({ phrase }) => phrase.every((w, k) => sequence[i + k]?.folded === w));
    if (hit) {
      group++;
      out.push(...hit.replacement.map((t) => ({ ...t, group })));
      i += hit.phrase.length;
    } else {
      out.push(sequence[i]);
      i++;
    }
  }
  return out;
}
