# Research notes

What I looked at before writing markup, and the concrete decision each observation changed.
No claim here is a measurement of the final pages; those are in `VERIFY.md`.

## Design references

- **Apple Human Interface Guidelines, Materials.** The page separates Liquid Glass, a
  functional layer for controls and navigation, from standard materials in the content layer.
  It also says the regular variant is the one for text-heavy surfaces, and that clear glass
  belongs over visually rich media, with a dimming layer when the backdrop is bright.
  Read at <https://developer.apple.com/design/human-interface-guidelines/materials>.
  **Outcome:** used as a boundary. Content stays opaque; glass is limited to the fixed
  navigation rail, with a dark 88% tint, blur and a faint top sheen. Body copy never sits on a
  live backdrop, and the photographic cards keep a flat dark tint.

- **Apple Human Interface Guidelines, Typography.** Default body sizes are 17 pt on iOS and
  13 pt on macOS, light weights are discouraged, and one typeface is preferred for hierarchy.
  The tracking table also shows tight tracking at display sizes and looser tracking at small
  sizes. Read at <https://developer.apple.com/design/human-interface-guidelines/typography>.
  **Borrowed:** generous body size (16 px), 14 px buttons, tabular numerals for credits and
  GPA, and tight tracking only at display sizes. The typefaces are self-hosted Be Vietnam Pro
  for UI/body and Lora 600 for display; neither depends on a CDN.

- **Local `ui-ux-pro-max` skill.** A minimal design-system query returned Swiss Modernism
  2.0 with an academic pairing and a scholarly navy/gold palette. **Used:** the minimal
  density, flat surfaces, 1 px rules, and the "essential elements only" test. **Rejected:**
  the all-sans Swiss voice, the Google Fonts URL (offline constraint), and the navy/gold
  palette (the SchemeColor "Basically Minimal" direction above is warmer and less generic).
  The final UI keeps the Swiss grid discipline but uses Be Vietnam Pro + Lora.

- **shadcn/ui Blocks, `dashboard-01` and `sidebar-07`.** The examples are a persistent
  sidebar plus a main stack of summary cards, a chart and a data table, not a grid of equal
  feature cards. Read at <https://ui.shadcn.com/blocks>.
  **Borrowed:** the dashboard is a wide progress table with one narrow side column; the
  planner is a wide board with a persistent 300 px course-pool rail. The page has one
  reading path, not a dashboard of unrelated tiles.

- **coss ui (the current home of the Origin UI component set).** The component index lists
  Meter, Progress, Empty, Segmented Control, Kbd, Frame and Group as first-class pieces.
  Read at <https://originui.com/> (redirects to <https://coss.com/ui>).
  **Borrowed:** credit meters always sit next to the exact number (`19 / 43`), the unused
  buffer term is an explicit empty state rather than an empty box, and the pool filters read as
  a segmented control. The search field is plain; the prototype does not fake a command
  shortcut.

- **21st.dev registry.** The catalogue is organised by the job a component does (hero,
  pricing, button, dialog) and the code is copied into the repo instead of imported. Read at
  <https://21st.dev/>. **Borrowed:** the decision to hand-write the handful of components
  this page needs. The prototype has no build step and no runtime dependency, so pulling a
  React/Tailwind registry into it would have been the wrong trade.

- **godly.website, Recent.** The feed I saw led with a spacing-visualisation dashboard and a
  password-strength interaction, both built around one dominant object with a lot of air
  around it. Read at <https://godly.website/>. **Borrowed:** one oversized focal card per
  page (next action, plan check, registration guide), one oversized h1, and ambient light
  instead of decorated cards.

- **css.glass.** The generator is JavaScript-only and rendered as a loading state in the
  text fetch, so I could not read its recipe. **Outcome:** reference only. The rail uses a
  hand-written CSS glass recipe (88% dark tint, 18 px blur, 1.3 saturation, hairline inner
  highlight) rather than the generator. Glass is confined to navigation; content panels stay
  opaque so text contrast does not depend on the blur.

- **Awwwards and Dribbble glassmorphism tags.** Awwwards returned HTTP 403 to the fetch and
  Dribbble returned no usable content, so I did not borrow from either. I am not claiming a
  survey of those galleries.

## Visual direction

The previous pass was too pale, too rounded and too decorative. This version is a warm-paper
editorial UI with one smoked-glass navigation rail: ink text, a slate-blue accent, a rose
warning colour and a sand highlight. Content surfaces stay flat. Decorative gradients are
limited to a fixed ambient wash behind the rail and a faint top sheen on the glass; the only
other gradients are conic chart fills.

- **Colour source.** SchemeColor's "Basically Minimal" palette is
  `#D1BAA3 · #C0938C · #7882A4 · #C4D1C4 · #E8E5E1` (sand, dusty rose, slate blue, sage,
  warm grey). Read at <https://www.schemecolor.com/tag/minimal>. **Borrowed:** the muted
  sand/rose/slate/sage family. The web values were darkened for WCAG text contrast: paper
  `#F4F1EB`, surface `#FFFEFB`, ink `#22252B`, slate `#55627F`, rose `#8E5049`, sage
  `#536650`, sand `#C9B49A`, rail `#364154`.
- **Type.** Multi-font pairing: Be Vietnam Pro for UI and body text; Lora 600 for display
  headings; JetBrains Mono 500/600 for technical data, CS course codes (`CS333`, `CS486`),
  credit hours, deadlines, tabular metrics and chips. All are self-hosted WOFF2 files with
  Vietnamese and Latin subsets in `assets/fonts/`, so there is no runtime CDN. Display sizes
  are 52 px desktop and 35 px mobile; body is 16 px with 1.55 leading. Button text is 14 px
  (13 px for the small variant), not 11–12 px.
- **Shape.** Radii are 4–12 px: small controls 5 px, panels 8 px, focal cards 12 px. The
  navigation rail is attached to the left with right-edge `0 24px 24px 0` rounding on desktop
  (`0 0 20px 20px` on mobile), enhanced with liquid-glass edge reflections and high-blur
  saturation. Progress meters are flat matte pills with 0.88 opacity, without 3D bulge or glossy glare.
- **Image.** `assets/img/library.jpg` is a local Unsplash photo, cropped to 1200×800 and
  compressed to about 200 KB. It is used only behind the dark focal cards at 12% visibility,
  never behind body copy or as a decorative full-page background.
- **Layout.** Desktop uses an attached 236 px liquid-glass left rail: brand and term at the top,
  a vertical nav list, then settings and the user avatar at the bottom. A collapse control
  pointing in (`←`) collapses the rail to 76 px; when collapsed, an expand arrow pointing out
  (`→`) reopens it, and the settings button is centered precisely. The collapse is CSS-only
  (hidden checkbox plus `:has()`), so the prototype still ships no JavaScript. At 900 px the rail
  sits flush at the top with rounded bottom corners and a horizontal nav. The dashboard places
  the credit Donut and requirement Pie charts directly after the stats band.
- **Data display.** The dashboard features a credit completion donut (125 / 167) and a
  curriculum pie (167 TC across 6 blocks) built as pure vector SVG, eliminating any conic-gradient
  aliasing (răng cưa). They share a brilliant modern academic palette: brilliant indigo (`#4368E0`),
  emerald (`#289E68`), amber (`#DE9726`), coral rose (`#E05450`), cerulean slate (`#5285B8`),
  and twilight navy (`#414C6B`). Requirement states have 4 distinct colors: completed green,
  active blue, warning rose, and planned slate. Values that need an explanation carry a hover/focus note.
- **Less copy.** Page ledes are one short line or removed. Index descriptions are one line.
  Link-guide descriptions are gone, and the 15 instruction blocks are native `<details>`
  elements collapsed to a single "Hướng dẫn" control.

## Content sources

- **APCS K2023 curriculum PDF**, `CTDT_CTTT_2023-3.pdf`, at
  <https://www.ctda.hcmus.edu.vn/wp-content/uploads/2025/03/CTDT_CTTT_2023-3.pdf>, linked from
  the CTDA programme page
  <https://www.ctda.hcmus.edu.vn/vi/educational-program/chuong-trinh-tien-tien/>. The
  2023 programme uses `CS161`, `CS202`, `CS333`, `CS418`, `CS468`-style codes, not the
  `CSC10001` codes from the standard programme. The prototype follows the APCS codes.
  The structure table is 60 + 26 + 16 + 12 + 43 + 10 = 167 credits, which is the total used
  on the dashboard.

- **HCMUS portal links**, taken from the university home page:
  <https://portal.hcmus.edu.vn/>, <https://hocphi.hcmus.edu.vn/dang-nhap>,
  <https://courses.hcmus.edu.vn/>, <https://pdt.hcmus.edu.vn/dstn>,
  <https://hcmus.edu.vn/quytrinh-bieumau/>, <https://glib.hcmus.edu.vn/>.
  The registration window, caps, fees and deadlines are plausible prototype values, not
  quoted policy. The footer says the numbers are illustrative.

- **Visual assets.** `assets/img/library.jpg` is Unsplash image
  `photo-1521587760476-6c12a4b040da`, downloaded from `images.unsplash.com` on 18/10/2026
  and used under the Unsplash License. `assets/fonts/` contains Be Vietnam Pro and Lora
  WOFF2 files under the SIL Open Font License; both license texts are included beside the
  files. No asset is fetched at runtime.

## What I deliberately did not do

- No gradient fills on content, gradient text, neon borders, badge soup, decorative blobs,
  emoji, or card elevation. Glass is limited to the navigation rail; the ambient wash and top
  sheen are fixed, low-contrast surfaces. Shadows are limited to the rail, tooltips and inset
  meter depth.
- No pill-shaped buttons. Radii are 4–12 px; the only circles are the avatar, status dots and
  step numerals, and the only pills are the progress meters.
- No icon font and no runtime CDN. Icons are one inline SVG sprite with 1.5 px strokes; fonts
  and the library photo are local files.
- No lorem ipsum. Course names, codes, requirement groups and portal names are real APCS /
  HCMUS material, with the dates and personal record clearly framed as a prototype.

## Anti-slop pass

- **Search.** I ran `npx skills find "ai slop"` and read the listings. The top result was
  `leonxlnx/taste-skill@design-taste-frontend` (631.6K installs). Its summary names the
  default model page: centred headline, small label above it, three icon cards, a soft
  gradient, thin rules. I did not install it, because it is a scripted workflow and this
  page has no build step. I used the rule: the idea comes from the subject, not the styling.
  **Applied:** the pages are a student's term, not a landing page. They open on credits,
  dates and links, not a pitch. No three-card row, no decorative gradient, and no small label
  sitting above the h1. The headline is the first thing on the page.

- **`mengto/skills@no-ai-design-slop`.** Its useful test is that slop is a reflex choice,
  not a colour or a card. A choice is suspect when it could be pasted into an unrelated
  product unchanged. **Applied:** every sentence now carries a fact, date, course code,
  account or action. The marketing lines and the quote in the links hero are gone.

- **Local `no-ai-slop` skill.** I used its copy rules: no binary contrasts, throat-clearing,
  faux insight, importance puffery, summary-recap endings or em-dash rhythm. **Applied:**
  "Còn 26 tín chỉ", "2 lỗi", "Hạn nộp: 30/06/2027", "Tối đa 22 TC". Short labels, exact
  numbers, no sentences that could belong to any student app.

- **Minimal palette.** Warm paper `#F4F1EB`, warm-white surface `#FFFEFB`, ink `#22252B`,
  slate `#55627F`, rose `#8E5049`, sage `#536650`, sand `#C9B49A`. Slate is the single
  interactive accent; rose and sand are status/highlight colours. The rail is a translucent
  `#364154` glass at 88%; the footer stays flat `#364154`. Be Vietnam Pro carries the UI at
  16 px; Lora 600 carries display headings and large numerals.
