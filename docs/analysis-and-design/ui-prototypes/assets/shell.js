// Shared shell: icon sprite, sidebar or public header, mobile tab bar, the god button and panel,
// theme, toasts, drawers and regulation citations. Loaded after data.js on every page.
(function () {
  const D = window.OC;
  const body = document.body;
  const page = body.dataset.page;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('oc2-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('oc2-' + k, JSON.stringify(v)); } catch (e) { /* private mode: keep going */ } },
    del(k) { try { localStorage.removeItem('oc2-' + k); } catch (e) { /* ignore */ } },
  };

  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    audit: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.5 8 11 15.8M16.5 8 13 15.8"/>',
    columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 16v4M17 18h4"/>',
    book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2Z"/><path d="M4 19.5A2 2 0 0 0 6 21h14"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 3.5 2.5 20h19Z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3.2"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7Z"/><path d="m11 13 3-3"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5Z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    fork: '<circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="5" r="2.5"/><circle cx="12" cy="19" r="2.5"/><path d="M6 7.5v1A3.5 3.5 0 0 0 9.5 12h5A3.5 3.5 0 0 0 18 8.5v-1M12 12v4.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13 7 4 4"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5"/><path d="M20 3v5.5h-5.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r=".6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.5 4v16"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  };
  window.icon = (n, cls) => '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>';
  // Static markup writes <i data-icon="name" class="sm"></i>; swap each for the SVG.
  const swapIcons = (root) => (root || document).querySelectorAll('i[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon, el.className || 'sm'); });
  swapIcons();

  const LOGO = '<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><g>' +
    '<rect x="2" y="2" width="17" height="17" rx="5" fill="var(--core)"/><rect x="21" y="2" width="17" height="17" rx="8.5" fill="var(--phys)"/>' +
    '<rect x="2" y="21" width="17" height="17" rx="8.5" fill="var(--pol)"/><rect x="21" y="21" width="17" height="17" rx="5" fill="var(--elec)"/></g></svg>';
  const brand = (href) => '<a class="brand" href="' + (href || 'index.html') + '">' + LOGO + '<b>OmniCourse</b></a>';
  document.querySelectorAll('[data-brand]').forEach((el) => { el.outerHTML = brand(el.dataset.brand).replace('class="brand"', 'class="brand" style="padding:0"'); });

  // ---------- Pages ----------
  const readSet = new Set(store.get('read', []));
  const unread = D.notes.filter((n) => n.unread && !readSet.has(n.id)).length;
  const NAV = [
    ['dashboard', 'dashboard.html', 'home', 'Dashboard', 'g-core'],
    ['inbox', 'inbox.html', 'bell', 'Thông báo', 'g-pol', unread],
    ['audit', 'audit.html', 'audit', 'Xét tốt nghiệp', 'g-gen'],
    ['explorer', 'explorer.html', 'graph', 'Chương trình', 'g-phys'],
    ['planner', 'planner.html', 'columns', 'Lộ trình', 'g-elec'],
    ['advisor', 'advisor.html', 'sparkle', 'Trợ lý AI', 'g-eng'],
    ['guides', 'guides.html', 'book', 'Hướng dẫn', 'g-math'],
  ];
  const NAV2 = [
    ['settings', 'settings.html', 'sliders', 'Cài đặt', 'g-thesis'],
    ['admin', 'admin.html', 'db', 'Quản trị CTĐT', 'g-thesis'],
  ];
  const TABS = ['dashboard', 'planner', 'advisor', 'inbox', 'guides'];

  const GOD = [
    ['Công khai', [
      ['index.html', 'Trang giới thiệu', 'Landing page cho người chưa có tài khoản', '', 'g-eng'],
      ['sign-in.html', 'Đăng nhập', 'Email, Google, email sinh viên', 'F1', 'g-eng'],
      ['sign-up.html', 'Đăng ký', 'Tạo tài khoản, đồng ý xử lý dữ liệu', 'F1', 'g-eng'],
      ['guides.html?guest', 'Hướng dẫn (chưa đăng nhập)', 'Đọc hướng dẫn không cần tài khoản', 'F11', 'g-eng'],
      ['shared.html', 'Lộ trình được chia sẻ', 'Giảng viên xem, chỉ đọc', 'F9', 'g-eng'],
      ['shared.html#dead', 'Link chia sẻ đã tắt', 'Trang "không được chia sẻ"', 'F9', 'g-eng'],
    ]],
    ['Bắt đầu', [
      ['onboarding.html', 'Vài câu hỏi đầu tiên', 'Chương trình, khóa, mục tiêu tốt nghiệp', 'F1', 'g-math'],
      ['import.html', 'Nhập bảng điểm', 'Tải PDF từ cổng sinh viên', 'F2', 'g-math'],
      ['import.html#review', 'Duyệt bảng điểm', 'Xem lại từng dòng trước khi lưu', 'F2', 'g-math'],
    ]],
    ['Học vụ', [
      ['dashboard.html', 'Dashboard', 'Tiến độ, GPA, học kỳ này, việc cần chú ý', 'F3', 'g-core'],
      ['inbox.html', 'Thông báo', 'Việc cần xử lý, nhắc đăng ký, bảng điểm đổi', 'F10', 'g-core'],
      ['audit.html', 'Xét tốt nghiệp theo nhóm', 'Từng nhóm tín chỉ, từng học phần', 'F3', 'g-core'],
      ['explorer.html', 'Chương trình đào tạo', 'Mọi học phần, tiên quyết, mở khóa', 'F4', 'g-core'],
      ['explorer.html#graph', 'Sơ đồ tiên quyết', 'Đồ thị tiên quyết, bấm để làm nổi', 'F4', 'g-core'],
    ]],
    ['Lộ trình', [
      ['planner.html', 'Lộ trình kéo thả', 'Kéo môn vào học kỳ, kiểm tra trực tiếp', 'F5', 'g-elec'],
      ['planner.html#goal', 'Hộp mục tiêu AI', 'Viết mục tiêu, AI điền form, engine xếp', 'F6', 'g-elec'],
      ['planner.html#whatif', 'What-if', 'Nếu rớt một môn thì sao?', 'F7', 'g-elec'],
      ['planner.html#share', 'Chia sẻ và xuất PDF', 'Tạo link chỉ đọc cho giảng viên', 'F9', 'g-elec'],
    ]],
    ['Trợ lý AI', [
      ['advisor.html', 'Hỏi trợ lý', 'Trả lời có trích điều khoản', 'F8', 'g-pol'],
      ['advisor.html#consent', 'Lần đầu: đồng ý chia sẻ', 'Hộp thoại đồng ý gửi hồ sơ ẩn danh', 'F8', 'g-pol'],
      ['advisor.html#general', 'Chế độ chung', 'Chưa đồng ý, chỉ hỏi về quy chế', 'F8', 'g-pol'],
      ['advisor.html#unavailable', 'AI không khả dụng', 'Lỗi 503 ai_unavailable, có đường thủ công', 'F8', 'g-pol'],
      ['advisor.html#limit', 'Hết lượt trong ngày', 'Đã dùng 20/20 lượt AI', 'F8', 'g-pol'],
    ]],
    ['Tài khoản và quản trị', [
      ['settings.html', 'Cài đặt', 'Hồ sơ, mục tiêu, bảo mật, giao diện', '', 'g-thesis'],
      ['settings.html#data', 'Xuất và xóa dữ liệu', 'Tải toàn bộ dữ liệu, xóa tài khoản', '', 'g-thesis'],
      ['admin.html', 'Quản trị chương trình', 'Nhóm, học phần, tiên quyết, phiên bản', 'F12', 'g-thesis'],
    ]],
  ];

  // ---------- Layout ----------
  const guest = body.dataset.guest === 'ok' && /[?&]guest/.test(location.search);
  if (guest) { body.dataset.layout = 'public'; body.classList.add('guest'); }
  const layout = body.dataset.layout;

  const navLink = ([id, href, ic, label, g, badge]) =>
    '<a class="' + g + '" href="' + href + '" data-tip="' + label + '"' + (id === page ? ' aria-current="page"' : '') + '>' +
    '<span class="ico">' + icon(ic) + '</span><span class="tx">' + label + '</span>' + (badge ? '<span class="badge" aria-label="' + badge + ' chưa đọc">' + badge + '</span>' : '') + '</a>';

  // Language: the button names the other language; switching reloads the page in it.
  const lang = (window.I18N && I18N.lang) || 'vi';
  const other = lang === 'en' ? 'vi' : 'en';
  const otherName = other === 'en' ? 'English' : 'Tiếng Việt';
  const langBtn = '<button class="btn sm ghost lang-btn" type="button" data-lang-set="' + other + '" lang="' + other + '" title="' + otherName + '">' + icon('globe', 'sm') + other.toUpperCase() + '</button>';

  if (layout === 'app') {
    const side = document.getElementById('side');
    side.innerHTML = brand('dashboard.html') +
      '<nav class="nav" aria-label="Chính">' + NAV.map(navLink).join('') +
      '<span class="nav-label"><span class="tx">Tài khoản</span></span>' + NAV2.map(navLink).join('') + '</nav>' +
      '<div class="side-foot"><button class="side-toggle" type="button" data-lang-set="' + other + '" data-tip="' + otherName + '" lang="' + other + '">' +
      '<span class="ico">' + icon('globe') + '</span><span class="tx">' + otherName + '</span></button>' +
      '<button class="side-toggle" type="button" id="side-toggle" aria-pressed="false" data-tip="Mở rộng">' +
      '<span class="ico">' + icon('panel') + '</span><span class="tx">Thu gọn</span><kbd class="tx">[</kbd></button>' +
      '<a class="me" href="settings.html" data-tip="' + D.student.name + '"><span class="avatar">' + D.student.initials + '</span>' +
      '<span class="tx"><b>' + D.student.name + '</b><small>' + D.student.program + ' · ' + D.student.cohort + '</small></span></a></div>';
    // Collapsed rail: icons only. Remembered per browser; "[" toggles it.
    const root = document.documentElement;
    const setMini = (on) => {
      root.classList.toggle('side-mini', on);
      document.getElementById('side-toggle').setAttribute('aria-pressed', on);
      store.set('side', on ? 'mini' : 'full');
    };
    root.classList.add('no-anim');
    setMini(store.get('side', 'full') === 'mini');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim')));
    document.getElementById('side-toggle').addEventListener('click', () => setMini(!root.classList.contains('side-mini')));
    // Labels are hidden in the rail, so name each icon on hover and focus.
    const sideTip = document.createElement('div');
    sideTip.className = 'side-tip'; sideTip.setAttribute('aria-hidden', 'true');
    body.appendChild(sideTip);
    const showTip = (e) => {
      const a = e.target.closest && e.target.closest('[data-tip]');
      if (!a || !side.contains(a) || !root.classList.contains('side-mini')) { sideTip.classList.remove('show'); return; }
      const r = a.getBoundingClientRect();
      sideTip.textContent = a.dataset.tip;
      sideTip.style.left = (r.right + 10) + 'px'; sideTip.style.top = (r.top + r.height / 2) + 'px';
      sideTip.classList.add('show');
    };
    side.addEventListener('mouseover', showTip);
    side.addEventListener('focusin', showTip);
    side.addEventListener('mouseleave', () => sideTip.classList.remove('show'));
    side.addEventListener('click', () => sideTip.classList.remove('show'));
    side.addEventListener('focusout', () => sideTip.classList.remove('show'));
    document.addEventListener('keydown', (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (e.key === '[' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) setMini(!root.classList.contains('side-mini'));
    });
    const main = document.getElementById('main');
    main.insertAdjacentHTML('beforebegin', '<header class="mobile-top">' + brand('dashboard.html') + '<span class="end">' + langBtn +
      '<a class="avatar" href="settings.html" aria-label="Tài khoản">' + D.student.initials + '</a></span></header>');
    const all = NAV.concat(NAV2);
    body.insertAdjacentHTML('beforeend', '<nav class="tabbar" aria-label="Điều hướng nhanh">' + TABS.map((id) => {
      const n = all.find((x) => x[0] === id);
      return '<a class="' + n[4] + '" href="' + n[1] + '"' + (id === page ? ' aria-current="page"' : '') + '>' + icon(n[2]) +
        '<span>' + n[3].replace('Trợ lý AI', 'Trợ lý') + '</span>' + (n[5] ? '<span class="badge">' + n[5] + '</span>' : '') + '</a>';
    }).join('') + '</nav>');
  }
  if (layout === 'public') {
    body.insertAdjacentHTML('afterbegin', '<header class="pub-head">' + brand('index.html') +
      '<nav class="pub-nav" aria-label="Chính"><a href="index.html#features"' + '>Tính năng</a>' +
      '<a href="guides.html?guest"' + (page === 'guides' ? ' aria-current="page"' : '') + '>Hướng dẫn thủ tục</a>' +
      '<a href="index.html#promise">Cam kết</a></nav>' +
      '<div class="end">' + langBtn + '<a class="btn sm ghost" href="sign-in.html">Đăng nhập</a><a class="btn sm primary" href="sign-up.html">Tạo tài khoản</a></div></header>');
    body.insertAdjacentHTML('beforeend', '<footer class="pub-foot"><span>OmniCourse · dự án môn Nhập môn Công nghệ phần mềm, APCS. Bản mẫu giao diện, dữ liệu minh họa.</span>' +
      '<span><a href="guides.html?guest">Hướng dẫn</a> · <a href="' + D.REG_URL + '" target="_blank" rel="noopener">Quy chế đào tạo 2021</a></span></footer>');
  }

  // ---------- God button ----------
  const here = location.pathname.split('/').pop() + location.search + location.hash;
  body.insertAdjacentHTML('beforeend',
    '<button class="god" id="god" type="button" aria-expanded="false" aria-controls="god-panel" title="Mở mọi trang (phím G)">' + icon('apps') + '<kbd>G</kbd><span class="sr">Mở bảng chuyển trang</span></button>' +
    '<section class="god-panel" id="god-panel" role="dialog" aria-label="Chuyển trang">' +
    '<div class="god-top"><div class="row"><b>Đi đâu cũng được</b><span class="xs b">' + GOD.reduce((s, g) => s + g[1].length, 0) + ' màn hình</span></div>' +
    '<input class="input" id="god-q" type="search" placeholder="Tìm trang: lộ trình, AI, đăng ký…" autocomplete="off" aria-label="Tìm trang"></div>' +
    '<div class="god-list" id="god-list"></div>' +
    '<div class="god-foot"><div class="seg" role="group" aria-label="Ngôn ngữ"><button type="button" data-lang-set="vi" aria-pressed="' + (lang === 'vi') + '">VI</button><button type="button" data-lang-set="en" aria-pressed="' + (lang === 'en') + '">EN</button></div>' +
    '<div class="seg" role="group" aria-label="Giao diện"><button type="button" data-theme-set="light">' + icon('sun', 'sm') + '</button><button type="button" data-theme-set="dark">' + icon('moon', 'sm') + '</button></div>' +
    '<button class="btn sm ghost" type="button" id="god-reset">' + icon('refresh', 'sm') + 'Đặt lại dữ liệu demo</button></div></section>' +
    '<div class="toast" id="toast" role="status" aria-live="polite"></div>' +
    '<div class="scrim" id="scrim"></div>' +
    '<aside class="drawer" id="clause" aria-label="Điều khoản"><div class="drawer-head"><div><p class="eyebrow">' + icon('book', 'sm') + D.REG + '</p><h2 id="clause-title"></h2></div>' +
    '<button class="btn sm icon-only" type="button" data-close aria-label="Đóng">' + icon('x') + '</button></div>' +
    '<div class="drawer-body"><div class="callout yellow"><span>' + icon('info') + '</span><div><b>Tóm tắt</b><p id="clause-text"></p></div></div>' +
    '<p class="small t2">Đây là phần tóm tắt để đọc nhanh. Văn bản chính thức là căn cứ duy nhất, mở PDF để đọc đầy đủ.</p>' +
    '<a class="btn" href="' + D.REG_URL + '" target="_blank" rel="noopener">' + icon('external', 'sm') + 'Mở văn bản gốc (PDF)</a></div></aside>');

  const god = document.getElementById('god');
  const panel = document.getElementById('god-panel');
  const q = document.getElementById('god-q');
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  window.fold = fold;
  function renderGod() {
    const term = fold(q.value.trim());
    let n = 0;
    document.getElementById('god-list').innerHTML = GOD.map(([title, items]) => {
      const hits = items.filter((it) => !term || fold(it.join(' ') + ' ' + title).includes(term));
      if (!hits.length) return '';
      return '<h4>' + title + '</h4>' + hits.map(([href, name, desc, f, g]) => {
        n++;
        return '<a class="' + g + '" href="' + href + '"' + (href === here || (href === here.replace(/#$/, '')) ? ' aria-current="page"' : '') + '>' +
          '<span class="n">' + String(n).padStart(2, '0') + '</span><span class="txt"><b>' + name + '</b><small>' + desc + '</small></span>' +
          (f ? '<span class="f">' + f + '</span>' : '') + '</a>';
      }).join('');
    }).join('') || '<p class="empty small">Không có trang nào khớp.</p>';
  }
  function setGod(open) {
    panel.classList.toggle('open', open);
    god.setAttribute('aria-expanded', open);
    if (open) { renderGod(); setTimeout(() => q.focus(), 30); }
  }
  god.addEventListener('click', () => setGod(!panel.classList.contains('open')));
  q.addEventListener('input', renderGod);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const a = panel.querySelector('.god-list a'); if (a) location.href = a.getAttribute('href'); }
  });
  document.getElementById('god-list').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    // Same page, different hash: let the page react instead of reloading.
    if (a && a.getAttribute('href').split('#')[0] === location.pathname.split('/').pop() + location.search) setTimeout(() => setGod(false), 0);
  });
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('open') && !panel.contains(e.target) && !god.contains(e.target)) setGod(false);
  });
  document.getElementById('god-reset').addEventListener('click', () => {
    ['plans', 'read', 'consent', 'onboard', 'shared', 'theme', 'goal'].forEach(store.del);
    location.reload();
  });

  // ---------- Theme ----------
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.themeSet === t));
    store.set('theme', t);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-set]');
    if (b) applyTheme(b.dataset.themeSet);
  });
  applyTheme(document.documentElement.dataset.theme || 'light');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang-set]');
    if (!b || b.dataset.langSet === lang) return;
    store.set('lang', b.dataset.langSet);
    location.reload();
  });

  // ---------- Overlays ----------
  const scrim = document.getElementById('scrim');
  let lastFocus = null;
  const UI = {
    store,
    open(id) {
      lastFocus = document.activeElement;
      document.querySelectorAll('.drawer.open, .modal.open').forEach((x) => x.classList.remove('open'));
      const el = document.getElementById(id);
      el.classList.add('open'); scrim.classList.add('open');
      const f = el.querySelector('[autofocus], input, button, a');
      if (f) setTimeout(() => f.focus(), 30);
    },
    close() {
      document.querySelectorAll('.drawer.open, .modal.open').forEach((x) => x.classList.remove('open'));
      scrim.classList.remove('open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    },
    toast(msg, ic) {
      const t = document.getElementById('toast');
      t.innerHTML = icon(ic || 'check') + '<span>' + msg + '</span>';
      t.classList.add('show');
      clearTimeout(UI._t); UI._t = setTimeout(() => t.classList.remove('show'), 2600);
    },
    ref(clause, label) {
      return '<button type="button" class="ref" data-clause="' + clause + '">' + icon('book', 'sm') + (label || clause) + '</button>';
    },
    g: (id) => 'g-' + id,
    google: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
    // The plan the student is working on, saved by the planner; the illustrative plan otherwise.
    plan() { const s = store.get('plans', null); return s && s.list && s.list[s.active] ? s.list[s.active].plan : D.initialPlan(); },
    glyph(gid, cls) { const g = D.group(gid); return '<span class="glyph ' + (cls || '') + ' g-' + gid + '" aria-hidden="true">' + g.glyph + '</span>'; },
    // A course tile. opts: status (done|current|planned|slot|pool), flag, attrs, sub
    tile(x, o) {
      o = o || {};
      const st = o.status || x.status;
      const cls = 'tile g-' + x.group + ' ' + (x.slot ? 'slot' : st === 'pool' ? 'planned' : st) + (o.cls ? ' ' + o.cls : '');
      return '<div class="' + cls + '" ' + (o.attrs || '') + ' data-code="' + x.code + '">' +
        (o.flag ? '<span class="flag" aria-label="Có vi phạm">!</span>' : '') +
        '<span class="top"><span class="k">' + (x.slot ? 'CHƯA CHỌN' : x.code) + '</span><span class="cr">' + x.credits + ' TC</span></span>' +
        '<span class="nm">' + x.name + '</span>' + (o.sub ? '<span class="sub">' + o.sub + '</span>' : '') + '</div>';
    },
  };
  window.UI = UI;
  scrim.addEventListener('click', UI.close);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) UI.close();
    const r = e.target.closest('[data-clause]');
    if (r) {
      const k = r.dataset.clause;
      document.getElementById('clause-title').textContent = k;
      document.getElementById('clause-text').textContent = D.clauses[k] || 'Chưa có tóm tắt cho điều khoản này.';
      UI.open('clause');
    }
  });
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (e.key === 'Escape') {
      if (panel.classList.contains('open')) { setGod(false); god.focus(); } else UI.close();
    }
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); setGod(!panel.classList.contains('open')); }
  });
})();
