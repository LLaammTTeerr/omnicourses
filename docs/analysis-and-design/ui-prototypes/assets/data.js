// Illustrative data and a toy rule engine shared by every page of the prototype.
// Synthetic persona only (AGENTS.md hard rule 3). The student ID 24125369 is made up for the demo.
// Rules cite the HCMUS training regulation QĐ 1175/QĐ-KHTN (2021) as "Điều n".
// The real rule engine lives in the backend; this file only mimics its answers.
window.OC = (function () {
  const REG = 'Quy chế đào tạo 2021 · QĐ 1175/QĐ-KHTN';
  const REG_URL = 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf';

  const student = {
    name: 'Minh Phương', full: 'Nguyễn Minh Phương', initials: 'MP', id: '24125369', className: 'APCS 24A01', email: 'phuong.demo@example.com',
    faculty: 'Khoa Công nghệ Thông tin', program: 'APCS', programName: 'Chương trình Tiên tiến Khoa học Máy tính',
    cohort: 'K24', curriculum: 'CTĐT APCS K24 · phiên bản 3',
  };
  const today = { label: 'Chủ nhật, 01/11/2026', short: 'CN 01/11', week: 9 };

  // Requirement groups. Each has its own colour token and a glyph, so the colour is never the only cue.
  const groups = [
    { id: 'core', name: 'Tin học cốt lõi', short: 'Cốt lõi', glyph: '&lt;/&gt;', required: 60, rule: 'Học đủ các học phần bắt buộc của nhóm' },
    { id: 'math', name: 'Toán', short: 'Toán', glyph: '∑', required: 16, rule: 'Học đủ các học phần bắt buộc của nhóm' },
    { id: 'phys', name: 'Vật lý', short: 'Vật lý', glyph: 'ℏ', required: 12, rule: 'Học đủ các học phần bắt buộc của nhóm' },
    { id: 'eng', name: 'Tiếng Anh', short: 'Anh văn', glyph: 'Aa', required: 8, rule: 'Hai học phần tiếng Anh học thuật. Chuẩn ngoại ngữ đầu ra xét riêng (Điều 17.3d)' },
    { id: 'pol', name: 'Lý luận chính trị và pháp luật', short: 'Chính trị', glyph: '§', required: 14, rule: 'Học đủ các học phần bắt buộc của nhóm' },
    { id: 'gen', name: 'Đại cương và kỹ năng', short: 'Kỹ năng', glyph: '&', required: 4, rule: 'Học đủ các học phần bắt buộc của nhóm' },
    { id: 'elec', name: 'Tự chọn chuyên ngành', short: 'Tự chọn', glyph: '★', required: 43, rule: 'Chọn đủ 43 TC trong danh sách tự chọn của chương trình' },
    { id: 'thesis', name: 'Khóa luận tốt nghiệp', short: 'Khóa luận', glyph: '∎', required: 10, rule: 'Khóa luận 10 TC. Khoa xét danh sách sinh viên đủ điều kiện (Điều 10.1)' },
  ];

  // Terms. APCS runs 3 main terms a year (Điều 6.4b).
  const T = (year, n, when) => ({ id: year + '-' + n, year, n, label: 'HK' + n + ' ' + year + '–' + (year + 1), short: 'HK' + n + ' · ' + String(year).slice(2) + '–' + String(year + 1).slice(2), when });
  const terms = [
    T(2024, 1), T(2024, 2), T(2024, 3), T(2025, 1), T(2025, 2), T(2025, 3),
    T(2026, 1, '05/09 – 19/12/2026'),
    T(2026, 2, '04/01 – 15/05/2027'), T(2026, 3, '07/06 – 22/08/2027'),
    T(2027, 1, '06/09 – 18/12/2027'), T(2027, 2, '03/01 – 14/05/2028'), T(2027, 3, '05/06 – 19/08/2028'),
    T(2028, 1, '04/09 – 16/12/2028'),
  ];
  const NOW = '2026-1';
  const nowIdx = terms.findIndex((t) => t.id === NOW);
  const past = terms.slice(0, nowIdx);
  const future = terms.slice(nowIdx + 1);
  const term = (id) => terms.find((t) => t.id === id);
  const tIdx = (id) => terms.findIndex((t) => t.id === id);

  // term: where the course sits today (past, NOW, a future term from the saved plan, or null = not placed).
  // offered: term numbers the course is taught in, when restricted. Illustrative data.
  const C = (group, code, name, en, credits, term, extra) => Object.assign({ group, code, name, en, credits, term, prereq: [] }, extra || {});
  const courses = [
    C('core', 'CS161', 'Nhập môn lập trình', 'Introduction to Programming', 4, '2024-1', { grade: 8.5 }),
    C('core', 'CS162', 'Kỹ thuật lập trình', 'Programming Techniques', 4, '2024-2', { grade: 8.0, prereq: ['CS161'] }),
    C('core', 'CS163', 'Cấu trúc dữ liệu', 'Data Structures', 4, '2024-3', { grade: 7.5, prereq: ['CS162'] }),
    C('core', 'CS201', 'Kiến trúc máy tính', 'Computer Architecture', 4, '2025-1', { grade: 7.8, prereq: ['CS161'] }),
    C('core', 'CS202', 'Hệ thống lập trình', 'Programming Systems', 4, '2025-2', { grade: 8.2, prereq: ['CS162'] }),
    C('core', 'CS211', 'Lập trình hướng đối tượng', 'Object-Oriented Programming', 4, '2025-2', { grade: 8.8, prereq: ['CS162'] }),
    C('core', 'CS221', 'Phân tích và thiết kế thuật toán', 'Algorithms', 4, '2025-2', { grade: 7.2, prereq: ['CS163', 'MTH207'] }),
    C('core', 'CS231', 'Cơ sở dữ liệu', 'Databases', 4, '2025-3', { grade: 8.4, prereq: ['CS163'] }),
    C('core', 'CS261', 'Phát triển ứng dụng web', 'Web Development', 4, '2025-3', { grade: 9.0, prereq: ['CS211'] }),
    C('core', 'CS300', 'Nhập môn Công nghệ phần mềm', 'Elements of Software Engineering', 4, NOW, { prereq: ['CS211'] }),
    C('core', 'CS333', 'Hệ điều hành', 'Operating Systems', 4, NOW, { prereq: ['CS202'] }),
    C('core', 'CS420', 'Trí tuệ nhân tạo', 'Artificial Intelligence', 4, NOW, { prereq: ['CS221'] }),
    C('core', 'CS340', 'Mạng máy tính', 'Computer Networks', 4, '2026-2', { prereq: ['CS333'] }),
    C('core', 'CS360', 'Chương trình dịch', 'Compilers', 4, '2026-3', { prereq: ['CS221'] }),
    C('core', 'CS370', 'An toàn thông tin', 'Information Security', 4, '2026-3', { prereq: ['CS340'], offered: [3] }),

    C('math', 'MTH251', 'Giải tích 1', 'Calculus I', 4, '2024-1', { grade: 8.0 }),
    C('math', 'MTH252', 'Giải tích 2', 'Calculus II', 4, '2024-2', { grade: 7.0, prereq: ['MTH251'] }),
    C('math', 'MTH207', 'Toán rời rạc', 'Discrete Mathematics', 4, '2024-3', { grade: 8.5 }),
    C('math', 'MTH261', 'Đại số tuyến tính', 'Linear Algebra', 4, '2025-1', { grade: 7.5 }),

    C('phys', 'PHY101', 'Vật lý đại cương 1', 'General Physics 1', 4, '2024-1', { grade: 7.0 }),
    C('phys', 'PHY102', 'Vật lý đại cương 2', 'General Physics 2', 4, '2024-2', { grade: 6.5, prereq: ['PHY101'] }),
    C('phys', 'PHY103', 'Vật lý hiện đại', 'Modern Physics', 4, '2025-1', { grade: 7.5, prereq: ['PHY102'] }),

    C('eng', 'ENG201', 'Tiếng Anh học thuật 1', 'Academic English 1', 4, '2024-2', { grade: 8.5 }),
    C('eng', 'ENG202', 'Tiếng Anh học thuật 2', 'Academic English 2', 4, '2024-3', { grade: 8.0, prereq: ['ENG201'] }),

    C('pol', 'BAA00101', 'Triết học Mác – Lênin', 'Marxist-Leninist Philosophy', 3, '2024-1', { grade: 7.0 }),
    C('pol', 'BAA00103', 'Chủ nghĩa xã hội khoa học', 'Scientific Socialism', 2, '2024-3', { grade: 7.5 }),
    C('pol', 'BAA00004', 'Pháp luật đại cương', 'Introduction to Law', 3, '2025-1', { grade: 8.0 }),
    C('pol', 'BAACM02', 'Kinh tế chính trị Mác – Lênin', 'Political Economics', 2, NOW),
    C('pol', 'BAA00105', 'Tư tưởng Hồ Chí Minh', 'Ho Chi Minh Ideology', 2, '2026-2'),
    C('pol', 'BAA00106', 'Lịch sử Đảng Cộng sản Việt Nam', 'History of the CPV', 2, '2026-3'),

    C('gen', 'BAA00007', 'Kỹ năng mềm', 'Soft Skills', 2, '2025-2', { grade: 9.0 }),
    C('gen', 'ECO101', 'Kinh tế học đại cương', 'Principles of Economics', 2, '2025-2', { grade: 7.5 }),

    C('elec', 'CS311', 'Đồ họa máy tính', 'Computer Graphics', 4, '2025-3', { grade: 8.6, prereq: ['MTH261'] }),
    C('elec', 'CS312', 'Phát triển ứng dụng di động', 'Mobile Development', 4, '2025-3', { grade: 8.9, prereq: ['CS211'] }),
    C('elec', 'MTH346', 'Lý thuyết số', 'Number Theory', 4, NOW, { prereq: ['MTH207'] }),
    C('elec', 'CS419', 'Truy xuất thông tin', 'Information Retrieval', 4, '2026-2', { prereq: ['CS231'] }),
    C('elec', 'CS494', 'Các giao thức liên mạng', 'Internetworking Protocols', 4, '2026-2', { prereq: ['CS202'], offered: [1] }),
    C('elec', 'CS414', 'Học máy', 'Machine Learning', 4, '2026-3', { prereq: ['MTH261', 'CS221'] }),
    C('elec', 'CS416', 'Học sâu', 'Deep Learning', 4, '2026-3', { prereq: ['CS414'] }),
    C('elec', 'CS423', 'Kiểm thử phần mềm', 'Software Testing', 4, '2027-1', { prereq: ['CS300'] }),
    C('elec', 'CS487', 'Kỹ năng sáng tạo và lãnh đạo', 'Creativity and Leadership', 4, '2027-1'),
    C('elec', 'CS428', 'Thương mại điện tử', 'E-commerce', 4, '2027-1', { prereq: ['CS261'] }),
    C('elec', 'FREE3', 'Tự chọn chưa chọn môn', 'Elective slot', 3, '2027-1', { slot: true }),
    // Not placed yet: the pool the student drags from.
    C('elec', 'CS410', 'Thị giác máy tính', 'Computer Vision', 4, null, { prereq: ['CS414'] }),
    C('elec', 'CS431', 'Xử lý ngôn ngữ tự nhiên', 'Natural Language Processing', 4, null, { prereq: ['CS414'], offered: [2, 3] }),
    C('elec', 'CS422', 'Quản lý dự án phần mềm', 'Software Project Management', 4, null, { prereq: ['CS300'] }),
    C('elec', 'CS408', 'Phát triển game', 'Game Development', 4, null, { prereq: ['CS211'] }),
    C('elec', 'CS481', 'Điện toán đám mây', 'Cloud Computing', 4, null, { prereq: ['CS340'], offered: [1] }),
    C('elec', 'CS450', 'Tương tác người – máy', 'Human–Computer Interaction', 3, null),

    C('thesis', 'CS468', 'Khóa luận tốt nghiệp', 'Graduation Thesis', 10, '2027-2', { note: 'Khoa xét danh sách (Điều 10.1)' }),
  ];
  const course = (code) => courses.find((x) => x.code === code);
  const group = (id) => groups.find((g) => g.id === id);
  const isPast = (id) => id && tIdx(id) < nowIdx;
  courses.forEach((x) => {
    x.status = isPast(x.term) ? (x.grade >= 5 ? 'done' : 'failed') : x.term === NOW ? 'current' : x.term ? 'planned' : 'pool';
    if (x.slot) x.status = x.term ? 'planned' : 'pool';
  });
  const unlocks = (code) => courses.filter((x) => x.prereq.includes(code)).map((x) => x.code);

  // Grades: the 10-point scale is official; letter and 4-point grades are reference only (Điều 11.1–11.2).
  const SCALE = [[9, 4.0, 'A+'], [8, 3.5, 'A'], [7, 3.0, 'B+'], [6, 2.5, 'B'], [5, 2.0, 'C'], [4, 1.5, 'D+'], [3, 1.0, 'D'], [0, 0, 'F']];
  const step = (g) => SCALE.find(([lo]) => g >= lo);
  const letter = (g) => step(g)[2];
  const four = (g) => step(g)[1];
  const RANKS = [[9, 'Xuất sắc'], [8, 'Giỏi'], [7, 'Khá'], [5, 'Trung bình'], [4, 'Yếu'], [0, 'Kém']]; // Điều 15.2b
  const rank = (a) => RANKS.find(([lo]) => a >= lo)[1];
  const nextRank = (a) => RANKS.slice().reverse().find(([lo]) => lo > a);
  const drlRank = (d) => d >= 90 ? 'Xuất sắc' : d >= 80 ? 'Tốt' : d >= 65 ? 'Khá' : d >= 50 ? 'Trung bình' : d >= 35 ? 'Yếu' : 'Kém'; // TT 16/2015 Điều 9
  const yearLevel = (n) => n < 38 ? 1 : n < 76 ? 2 : n < 114 ? 3 : 4; // Điều 15.3
  const sum = (list) => list.reduce((s, x) => s + x.credits, 0);
  const avg = (list, f) => { const n = sum(list); return n ? list.reduce((s, x) => s + (f ? f(x.grade) : x.grade) * x.credits, 0) / n : 0; };

  const DRL = [82, 85, 85, 87, 90, 88];
  const history = past.map((t, i) => {
    const inTerm = courses.filter((x) => x.term === t.id && x.grade != null);
    const upTo = courses.filter((x) => isPast(x.term) && tIdx(x.term) <= i && x.grade >= 5);
    return { term: t, credits: sum(inTerm), avg: avg(inTerm), cum: avg(upTo), cum4: avg(upTo, four), passed: sum(upTo), drl: DRL[i] };
  });
  const last = history[history.length - 1];
  const doneList = courses.filter((x) => x.status === 'done');
  const totalRequired = groups.reduce((s, g) => s + g.required, 0);
  const done = sum(doneList);
  const gpa = last.cum;
  // Average needed over the remaining credits to reach the next rank at graduation (arithmetic only).
  const need = (target) => (target * totalRequired - gpa * done) / (totalRequired - done);

  // ---------- Toy rule engine (mirrors what the backend engine returns) ----------
  const CAP = { min: 10, max: 22, ref: 'Điều 7.2' }; // Tiên tiến main term (Điều 7.2)
  const initialPlan = () => {
    const p = {};
    courses.forEach((x) => { if (x.status === 'planned' || x.status === 'pool') p[x.code] = x.term; });
    return p;
  };
  const termOf = (plan, code) => {
    // A what-if may move a course in progress (failed and retaken), so the plan wins when it names the course.
    if (Object.prototype.hasOwnProperty.call(plan, code)) return plan[code] || null;
    const x = course(code);
    return x.status === 'done' || x.status === 'current' || x.status === 'failed' ? x.term : null;
  };
  const load = (plan, id) => courses.filter((x) => termOf(plan, x.code) === id).reduce((s, x) => s + x.credits, 0);
  const prereqProblem = (plan, code, at) => {
    const ai = tIdx(at);
    for (const p of course(code).prereq) {
      const pt = termOf(plan, p);
      if (course(p).status === 'done') continue;
      if (!pt) return { p, why: 'chưa xếp vào lộ trình' };
      if (tIdx(pt) >= ai) return { p, why: tIdx(pt) === ai ? 'xếp cùng học kỳ' : 'xếp sau' };
    }
    return null;
  };
  const offeredOk = (code, at) => { const o = course(code).offered; return !o || o.includes(term(at).n); };

  function fits(plan, code, at, max) {
    const x = course(code);
    if (!offeredOk(code, at)) return false;
    if (prereqProblem(plan, code, at)) return false;
    const cur = plan[code] === at ? 0 : x.credits;
    return load(plan, at) + cur <= (max || CAP.max);
  }
  function firstFit(plan, code, after, max) {
    const p = Object.assign({}, plan); delete p[code];
    return future.find((t) => tIdx(t.id) > tIdx(after || NOW) && fits(p, code, t.id, max));
  }

  function check(plan) {
    const v = [];
    future.forEach((t) => {
      const l = load(plan, t.id);
      if (l > CAP.max) v.push({ kind: 'cap', over: true, term: t.id, title: t.label + ' vượt ' + CAP.max + ' TC', text: 'Đang xếp ' + l + ' TC. Học kỳ chính của chương trình Tiên tiến tối đa ' + CAP.max + ' TC.', ref: CAP.ref });
      else if (l > 0 && l < CAP.min) v.push({ kind: 'cap', term: t.id, title: t.label + ' dưới ' + CAP.min + ' TC', text: 'Đang xếp ' + l + ' TC. Học kỳ chính tối thiểu ' + CAP.min + ' TC.', ref: CAP.ref });
    });
    Object.keys(plan).forEach((code) => {
      const at = plan[code];
      if (!at) return;
      const x = course(code);
      if (!offeredOk(code, at)) {
        const fix = firstFit(plan, code, NOW);
        v.push({ kind: 'offer', code, term: at, title: code + ' không mở trong HK' + term(at).n, text: x.name + ' chỉ mở ' + x.offered.map((n) => 'HK' + n).join(', ') + '.', ref: 'Dữ liệu CTĐT', fix: fix && { code, to: fix.id } });
      }
      const pr = prereqProblem(plan, code, at);
      if (pr) {
        const pt = termOf(plan, pr.p);
        const fix = pt && firstFit(plan, code, pt);
        v.push({ kind: 'prereq', code, term: at, title: code + ' cần học xong ' + pr.p + ' trước', text: pr.p + ' (' + course(pr.p).name + ') là tiên quyết của ' + code + ', hiện đang ' + pr.why + '.', ref: 'Dữ liệu CTĐT', fix: fix && { code, to: fix.id } });
      }
    });
    const cov = {};
    groups.forEach((g) => {
      const list = courses.filter((x) => x.group === g.id);
      const c = { required: g.required, done: 0, current: 0, planned: 0 };
      list.forEach((x) => {
        if (x.status === 'done') c.done += x.credits;
        else if (x.status === 'current') c.current += x.credits;
        else if (plan[x.code]) c.planned += x.credits;
      });
      c.total = c.done + c.current + c.planned;
      cov[g.id] = c;
      if (c.total < g.required) v.push({ kind: 'cover', group: g.id, title: g.name + ' còn thiếu ' + (g.required - c.total) + ' TC', text: 'Lộ trình chưa phủ đủ nhóm này. Kéo thêm học phần từ kho môn.', ref: 'Điều 17.3' });
    });
    const used = future.filter((t) => load(plan, t.id) > 0);
    const lastUsed = used.length ? used[used.length - 1] : term(NOW);
    const slots = Object.keys(plan).filter((c) => plan[c] && course(c).slot);
    return { violations: v, coverage: cov, est: v.length ? null : lastUsed, lastUsed, slots };
  }

  // Deterministic packer used by the goal box and the what-if simulator.
  function pack(plan, opt) {
    opt = opt || {};
    const max = opt.max || CAP.max;
    const blocked = opt.block || [];
    const codes = Object.keys(plan).filter((c) => plan[c] && !(opt.avoid || []).includes(c));
    const depth = (c) => course(c).prereq.length ? 1 + Math.max(...course(c).prereq.map(depth)) : 0;
    const order = codes.filter((c) => c !== 'CS468').sort((a, b) => depth(a) - depth(b) || tIdx(plan[a]) - tIdx(plan[b]) || a.localeCompare(b));
    const out = {};
    (opt.avoid || []).forEach((c) => { if (plan[c] !== undefined) out[c] = null; });
    Object.keys(plan).forEach((c) => { if (!plan[c]) out[c] = null; });
    const startAfter = opt.from || NOW;
    order.forEach((c) => {
      const t = future.find((t) => tIdx(t.id) > tIdx(startAfter) && !blocked.includes(t.id) && fits(out, c, t.id, max));
      out[c] = t ? t.id : future[future.length - 1].id;
    });
    if (codes.includes('CS468')) {
      const lastT = future.filter((t) => load(out, t.id) > 0).pop() || future[0];
      const t = future.find((t) => tIdx(t.id) >= tIdx(lastT.id) && !blocked.includes(t.id) && load(out, t.id) + 10 <= max);
      out.CS468 = t ? t.id : lastT.id;
    }
    return out;
  }

  // What-if: a course in progress is failed and retaken in the earliest term that fits, then the rest is repaired.
  function simulateFail(plan, code) {
    const p = Object.assign({}, plan);
    const retake = firstFit(p, code, NOW);
    p[code] = retake ? retake.id : future[0].id;
    const fixed = Object.assign({}, p);
    for (let round = 0; round < 12; round++) {
      // Repair only what moving later can fix; a term under the minimum stays reported.
      const bad = check(fixed).violations.find((v) => v.kind === 'prereq' || v.kind === 'offer' || v.over);
      if (!bad) break;
      let mv = bad.code;
      if (bad.kind === 'cap') mv = Object.keys(fixed).filter((c) => fixed[c] === bad.term && c !== code).sort((a, b) => course(b).credits - course(a).credits)[0];
      const i = tIdx(fixed[mv]);
      const next = future.find((t) => tIdx(t.id) > i && fits(fixed, mv, t.id));
      fixed[mv] = next ? next.id : future[future.length - 1].id;
    }
    return fixed;
  }

  // ---------- Notifications (F10) ----------
  const notes = [
    { id: 'n1', kind: 'plan', unread: true, act: true, when: '2 giờ trước', title: 'Lộ trình có 2 vi phạm', text: 'CS494 không mở trong HK2, CS416 đang xếp cùng kỳ với tiên quyết CS414. Rule engine đã gợi ý cách sửa.', href: 'planner.html', cta: 'Mở lộ trình' },
    { id: 'n2', kind: 'term', unread: true, act: true, when: 'Hôm qua', title: 'Đăng ký học phần HK2 2026–2027 sắp mở', text: 'Lịch cụ thể theo thông báo của Phòng Đào tạo. Lộ trình đang xếp 14 TC cho kỳ này.', href: 'guides.html#register-courses', cta: 'Xem hướng dẫn đăng ký' },
    { id: 'n3', kind: 'record', unread: true, act: true, when: '28/10', title: 'Bảng điểm vừa thay đổi', text: 'Bạn nhập lại bảng điểm ngày 28/10. 1 môn đổi kết quả (MTH252: 6.5 → 7.0). ĐTB tích lũy đã tính lại.', href: 'import.html#review', cta: 'Xem bảng điểm' },
    { id: 'n4', kind: 'audit', unread: false, act: true, when: '20/10', title: 'Chưa có chứng chỉ ngoại ngữ đầu ra', text: 'Chuẩn ngoại ngữ là điều kiện xét tốt nghiệp (Điều 17.3d), không phải điều kiện đăng ký khóa luận.', href: 'audit.html#eng', cta: 'Xem nhóm Tiếng Anh' },
    { id: 'n5', kind: 'plan', unread: false, act: false, when: '12/10', title: '3 TC tự chọn chưa chọn môn', text: 'HK1 2027–2028 đang giữ chỗ 3 TC. Có 6 học phần tự chọn trong kho môn.', href: 'planner.html', cta: 'Chọn môn' },
    { id: 'n6', kind: 'term', unread: false, act: false, when: '05/09', title: 'Check-in đầu HK1 2026–2027', text: 'Bạn đã xác nhận 5 học phần đang học, tổng 18 TC.', href: 'dashboard.html', cta: 'Xem tổng quan' },
    { id: 'n7', kind: 'system', unread: false, act: false, when: '01/09', title: 'CTĐT K24 có phiên bản 3', text: 'Ban chương trình cập nhật danh sách tự chọn. Lộ trình của bạn được kiểm tra lại với phiên bản mới.', href: 'explorer.html', cta: 'Xem chương trình' },
  ];

  // ---------- Guides (F11), illustrative content not yet checked against the portals ----------
  const guideGroups = ['Tài khoản và cổng thông tin', 'Đăng ký học phần', 'Thời khóa biểu và thi', 'Học phí', 'Hồ sơ và giấy tờ', 'Học bổng', 'Thực tập và khóa luận', 'Tốt nghiệp'];
  const guides = [
    { id: 'accounts', no: 'G01', group: 0, title: 'Tài khoản và cổng thông tin', en: 'School accounts and portals', ready: true, kw: 'tai khoan portal email moodle', portal: 'Nhiều cổng', account: 'Tài khoản sinh viên do trường cấp', ver: 2, checked: '12/10/2026', checker: 'Dũng' },
    { id: 'register-courses', no: 'G02', group: 1, title: 'Đăng ký học phần', en: 'Register for courses', ready: true, kw: 'dang ky hoc phan dkhp register', portal: 'Cổng đăng ký học phần', account: 'Tài khoản sinh viên', ver: 3, checked: '20/10/2026', checker: 'Dũng' },
    { id: 'change-registration', no: 'G03', group: 1, title: 'Điều chỉnh, hủy đăng ký học phần', en: 'Change a registration', ready: false, kw: 'huy rut dieu chinh' },
    { id: 'retake', no: 'G04', group: 1, title: 'Học lại, học cải thiện', en: 'Retake or improve', ready: false, kw: 'hoc lai cai thien' },
    { id: 'timetable', no: 'G05', group: 2, title: 'Thời khóa biểu, lịch thi', en: 'Timetable and exams', ready: false, kw: 'tkb lich thi' },
    { id: 'pay-tuition', no: 'G06', group: 3, title: 'Đóng học phí', en: 'Pay tuition', ready: true, kw: 'hoc phi dong tien tuition', portal: 'Cổng học phí', account: 'Tài khoản sinh viên', ver: 1, checked: '02/04/2026', checker: 'Lâm' },
    { id: 'grades', no: 'G07', group: 4, title: 'Xem điểm, tải bảng điểm PDF', en: 'Grades and transcript PDF', ready: true, kw: 'xem diem bang diem transcript pdf', portal: 'Cổng thông tin sinh viên', account: 'Tài khoản sinh viên', ver: 2, checked: '28/10/2026', checker: 'Lâm' },
    { id: 'official-transcript', no: 'G08', group: 4, title: 'Xin bảng điểm có xác nhận', en: 'Official transcript', ready: false, kw: 'bang diem xac nhan' },
    { id: 'certificate', no: 'G09', group: 4, title: 'Xin giấy xác nhận sinh viên', en: 'Student certificate', ready: false, kw: 'giay xac nhan' },
    { id: 'scholarship', no: 'G10', group: 5, title: 'Đăng ký học bổng', en: 'Apply for a scholarship', ready: false, kw: 'hoc bong scholarship' },
    { id: 'internship', no: 'G11', group: 6, title: 'Đăng ký thực tập', en: 'Register an internship', ready: false, kw: 'thuc tap internship' },
    { id: 'thesis', no: 'G12', group: 6, title: 'Đăng ký khóa luận tốt nghiệp', en: 'Register your thesis', ready: false, kw: 'khoa luan thesis' },
  ];

  // Regulation clauses the pages cite. Summaries, not quotations: the PDF is the authority.
  const clauses = {
    'Điều 6.4b': 'Chương trình Tiên tiến tổ chức 3 học kỳ chính trong một năm học.',
    'Điều 7.2': 'Khối lượng đăng ký mỗi học kỳ chính: chương trình Tiên tiến từ 10 đến 22 TC, chương trình Đại trà từ 14 đến 25 TC. Học kỳ hè tối đa 12 TC.',
    'Điều 10.1': 'Khoa xét và công bố danh sách sinh viên đủ điều kiện làm khóa luận tốt nghiệp.',
    'Điều 11.2': 'Điểm học phần chính thức theo thang 10. Điểm chữ và thang 4 chỉ để tham khảo.',
    'Điều 15.1': 'ĐTB học kỳ và ĐTB tích lũy tính theo thang 10, trọng số là số tín chỉ của từng học phần.',
    'Điều 15.2b': 'Xếp loại học lực theo ĐTB thang 10: từ 9 Xuất sắc, từ 8 Giỏi, từ 7 Khá, từ 5 Trung bình, từ 4 Yếu, dưới 4 Kém.',
    'Điều 15.3': 'Trình độ năm học theo số tín chỉ tích lũy: dưới 38 TC năm thứ nhất, dưới 76 năm thứ hai, dưới 114 năm thứ ba, từ 114 năm thứ tư.',
    'Điều 16.1': 'Cảnh báo học vụ xét theo số tín chỉ không đạt và ĐTB học kỳ của sinh viên.',
    'Điều 17.3': 'Điều kiện xét tốt nghiệp: tích lũy đủ học phần và tín chỉ của CTĐT, ĐTB tích lũy toàn khóa từ trung bình trở lên, đạt chuẩn ngoại ngữ (17.3d), nộp hồ sơ trong học kỳ xét (17.3f).',
    'Điều 14.2c': 'Điểm học cải thiện không dùng để xét học bổng của học kỳ.',
  };

  const STATUS = {
    done: 'Đạt', current: 'Đang học', planned: 'Trong lộ trình', pool: 'Chưa xếp', failed: 'Chưa đạt',
  };

  return {
    REG, REG_URL, student, today, groups, group, terms, term, tIdx, NOW, past, future, courses, course, unlocks,
    letter, four, rank, nextRank, drlRank, yearLevel, avg, sum, history, last, done, gpa, totalRequired, need,
    CAP, initialPlan, termOf, load, check, fits, firstFit, pack, simulateFail, prereqProblem, offeredOk,
    notes, guides, guideGroups, clauses, STATUS,
  };
})();
