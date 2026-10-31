# Verify

No screenshots were produced in this pass, as requested. The checks below are runtime
measurements from headless Edge (Chromium) at 1440x900, 901x900, 899x900, 768x900 and
390x844, plus overflow checks at 375 and 1024 px. They are not a claim about how the pages
look; that still needs a human visual pass.

## Checked

- **Pages opened:** `index.html`, `dashboard.html`, `planner.html`, `links.html`, `design-audit.html` loaded with no
  console errors, no runtime exceptions and no failed stylesheet. The local WOFF2 fonts report
  loaded through `document.fonts.check`, and the focal-card photo URL resolves to the local
  file `assets/img/library.jpg`.
- **UX & Barem Evaluation Pass (100% Pass):** `dashboard.html` was rigorously audited and refined
  against `docs/barem_danh_gia_ux_layout.md` and Vietnamese student mental models:
  - Fixed squished CSS styling on KPI Box 1 (`.stat:first-child` padding normalized with border separator).
  - Eliminated quadruple credit redundancy (`125/167 TC` was previously repeated 4 times).
  - Added **Daily Academic Pulse**: class schedule today (Lecture room C.32, Lab room I.44) and 48-hour Moodle deadlines.
  - Added **Official Portals Bridge**: 1-click external navigation to HCMUS Portal (ĐKHP), Tuition Payment, B2 Certificate portal.
  - Added **Tuition Status Card**: VND 28,500,000 paid via VNPAY with receipt reference.
  - Added **Non-Course Exit Criteria**: English B2, National Defense (GDQP), Physical Ed (GDTC), Social Work Days (CTXH).
  - Added **Scholarship & Conduct Score (DRL)**: DRL 88 + GPA 3.42 tied to scholarship eligibility.
  - Integrated SVG vector donut chart neatly into the 6-requirement curriculum panel.
- **Executive Academic Bento Hub:** on `dashboard.html`, the header is unified into an executive
  bento card featuring the student persona badge (`Minh Anh · APCS K23`, `GPA 3.42 / 4.00 · Hạng Giỏi`,
  `Đúng tiến độ 08/2027`), primary credit progression (`Còn 26 / 167 TC`) and a rule-engine urgency
  action card with a 1-click action button (`[Áp dụng phương án sửa: Đổi sang CS433]`). The fix comes from the deterministic rule engine, not a language model.
- **Synchronized Vector Charts:** the Donut and Pie charts have synchronized 2-way hover interactions
  between SVG slices and the legend list, with animated stroke-width expansion, drop-shadow elevation,
  and instant center metric readout.
- **High-Affordance Course Cards:** on `planner.html`, course cards have classification chips
  (`Cốt lõi`, `Tự chọn C`, etc.), semantic status banners with warning icons, and 1-click course
  replacement action buttons (`[Đổi sang CS433]`, `[Đổi sang CS428]`) that update card state live.
- **Service Desk Cards:** on `links.html`, services feature location badges (`📍 VP Đào tạo P.A01`),
  turnaround times, and quick filter chips under the search bar.
- **Floating Tooltips & Rail Micro-Polish:** in collapsed navigation mode, pure CSS zero-latency
  floating tooltips appear with spring easing and keyboard shortcuts (`⌘1`, `⌘2`, `⌘3`, `⌘4`),
  accompanied by an active left-edge indicator bar.
- **Subtle 2-Layer Depth:** `.panel`, `.stat`, `.course-card` use subtle 2-layer shadows
  (`0 1px 3px rgba(27, 38, 59, 0.04), 0 4px 12px -2px rgba(27, 38, 59, 0.04)`) with smooth hover lift.
- **Theme:** warm-paper content with an attached liquid-glass navigation rail. Background
  `#F4F1EB`, surfaces `#FFFEFB`, ink `#22252B`, slate `#55627F`, rose `#8E5049`, sage
  `#536650`, sand `#C9B49A`, dark rail `#364154`. The navigation rail is attached flush to the
  left edge on desktop with right-side rounded corners (`0 24px 24px 0`, `0 0 20px 20px` on
  mobile), using a deep 94% translucent dark gradient matching the focal action card,
  `blur(28px) saturate(180%) brightness(1.04)`, specular inner highlight border and a
  caustic radial gleam. Content panels stay clean and opaque. Card radii are 4–12 px; the
  progress meters are 999 px pills.
- **Type:** multi-font hierarchy across the page. Be Vietnam Pro 400/500/600 for body copy and
  UI text; Lora 600 for editorial display headings; JetBrains Mono 500/600 for CS course codes
  (`CS333`, `CS486`), credit counts (`4 TC`, `125 / 167`), deadlines, tabular statistics and
  chips. All three families are self-hosted with Vietnamese and Latin subsets and report
  loaded via `document.fonts.check`.
- **Layout:** no horizontal overflow, clipped text or interactive element under 30 px at any
  tested size, including with the rail collapsed. On desktop, the navigation rail is attached
  flush to the top, bottom and left (`top: 0; left: 0; bottom: 0; height: 100vh; height: 100dvh`),
  with right-side rounding (`0 24px 24px 0`) and zero top gap. Its width is fixed and strictly
  identical across all pages (`236px` expanded, `76px` collapsed), with body `padding-left: 264px`
  (`104px` collapsed). The collapse control inside the rail is an arrow pointing in (`←`);
  when collapsed, it becomes an arrow pointing out (`→`) and the settings button is centered
  to subpixel precision (`37.5px` on `76px`). The collapse is CSS-only (hidden checkbox plus
  `:has()`), with no JavaScript. At 900 px and below it sits flush at the top as a sticky bar
  with rounded bottom corners (`0 0 20px 20px`). `scrollbar-gutter: stable` prevents any 15px
  layout shift between pages. The planner board remains the only intentional horizontal scroller.
- **Charts:** the Donut and Pie charts are pure vector SVG with subpixel hardware antialiasing,
  eliminating all jagged pixel artifacts (răng cưa). They are styled with a brilliant, luminous
  modern academic palette: brilliant indigo (`#4368E0`), fresh emerald (`#289E68`), warm honey amber
  (`#DE9726`), coral rose (`#E05450`), cerulean slate (`#5285B8`), and twilight navy (`#414C6B`).
  Both charts render cleanly at 132 px with calm typography, JetBrains Mono figures and SVG
  `<title>` tooltips.
- **Requirement states:** four distinct semantic badge states in `.req-list`: "Đã đạt" (emerald
  `#2D5E36`, 7.53:1), "8 TC đang học" (blue `#295585`, 7.62:1), "Còn 16 sau HK1" (rose `#9C3F34`,
  6.56:1), "Dự kiến HK3" (slate `#555E6D`, 6.49:1). Each has a matching tinted background,
  specular inset border and indicator dot.
- **Progress:** the progress meters use a flat, matte solid color with `0.9` opacity, zero 3D bulge,
  zero top specular streak, zero bottom shadow, and zero neon glare, matching the brilliant
  palette (`#4368E0` for completed credits, `#DE9726` for current credits). The track is a flat
  neutral recessed surface without inset top bevels.
- **Hover notes:** nine dashboard values and three planner verdict values carry inline
  explanations. They open on hover and keyboard focus, and use a positioned note that stays
  inside the viewport at 390 px.
- **Copy reduction:** dashboard and planner ledes removed; index copy is one line per page;
  link-guide descriptions removed. All 15 guide instruction blocks are native `<details>`
  elements and start collapsed. Opening all 15 at 1440 and 390 produces no overflow or
  clipping.
- **Images:** one local library photo, 1200×800 and about 200 KB, shown only as a flat dark
  tint over the four dark focal cards. It is not used behind body copy. No image is fetched
  at runtime.
- **Contrast:** computed from the declared text/background token pairs with the WCAG relative
  luminance formula. The lowest text pair is 4.68:1 (footer text on the dark rail); body text is
  13.62:1; muted text is 5.29:1; slate links are 5.42:1; slate links on blue-soft are 5.21:1;
  sidebar nav text over the 88% glass tint is about 5.28:1; term text is about 4.94:1; rose
  status text on rose-soft is 5.13:1. No text pair is below 4.5:1.
- **Reduced motion:** `prefers-reduced-motion: reduce` sets scroll behaviour to `auto` and
  collapses transitions. There are no keyframe animations.

## Not checked

- **Visual pass.** No screenshot or pixel review was done in this pass. The glass tint,
  photo crop, serif/sans rhythm, chart balance and collapsed rail need a human look in a
  browser.
- **Real portal journeys.** No credentials were used; registration windows, caps, fees and
  deadlines remain illustrative values.
- **Safari and Firefox.** Chromium-only measurements; local font loading, the glass blur and
  the `:has()` rail-collapse selectors are unverified in other engines.
- **Drag and drop, search and filters.** The prototype is static. Search, filters, add
  buttons and settings do not alter state; a coded build needs keyboard alternatives for
  drag and drop.
- **Screen reader and axe run.** Landmarks, labels, skip links and heading order are present,
  but no automated audit or manual screen-reader pass was run.
