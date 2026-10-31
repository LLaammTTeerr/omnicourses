# OmniCourse UI prototypes

Static HTML/CSS mock-ups of OmniCourse screens, with no runtime or CDN dependency. They are a design reference for layout, typography and UX before the screens are built as Vue 3 components in `src/frontend`. They are not app code.

All data is illustrative. The student is the fake persona **Minh Anh · APCS K23**. Never put a real name or student ID in these pages or their screenshots.

## Layout

```text
docs/analysis-and-design/ui-prototypes/
├── index.html          # Prototype home and navigation
├── dashboard.html      # Overview: today's classes, Moodle deadlines, 167-credit progress, graduation criteria
├── planner.html        # Semester roadmap: terms, credit caps, equivalent-course swaps
├── schedule.html       # Weekly timetable grid
├── calendar.html       # Redirects to schedule.html
├── links.html          # School service quicklinks: 15 procedures, office locations, deadlines
├── assets/
│   ├── site.css        # Shared stylesheet
│   ├── img/            # library.jpg (see "Third-party assets")
│   └── fonts/          # Self-hosted WOFF2 fonts with their OFL licence texts
├── docs/
│   ├── RESEARCH.md     # Design references and the decision each one changed
│   └── VERIFY.md       # Contrast, responsive and UX checks
└── previews/           # Screenshots, taken with the fake persona
```

## Pages

1. **Overview (`dashboard.html`)**: student card (Minh Anh · APCS K23, GPA 3.42), today's classes and 48-hour Moodle deadlines, graduation progress donut over 6 requirement groups, exit criteria (English B2, defence education, PE, social work days), tuition status, and links that open the school portals.
2. **Roadmap (`planner.html`)**: terms HK1 to HK3 with the credit caps (14 to 25 in a main term, 12 in summer), the course pool with filters, and one-click equivalent-course swaps. Every check and fix shown here comes from the deterministic rule engine, never from a language model (AGENTS.md hard rule 1).
3. **Timetable (`schedule.html`)**: 7:00 to 18:00 grid with room, session, lecturer and credits.
4. **Quicklinks (`links.html`)**: 15 HCMUS services (course registration, tuition, B2 certificate, student affairs) with office, processing time and FAQ. OmniCourse only links to the portals; it never registers on a student's behalf (hard rule 2).

## Viewing

Open `index.html` in any browser, or serve the folder:

```bash
npx serve docs/analysis-and-design/ui-prototypes
```

## Third-party assets

- `assets/img/library.jpg`: Unsplash photo `photo-1521587760476-6c12a4b040da`, downloaded from `images.unsplash.com` on 18/10/2026, cropped to 1200×800, used under the [Unsplash License](https://unsplash.com/license).
- `assets/fonts/`: Be Vietnam Pro, JetBrains Mono and Lora under the SIL Open Font License 1.1 (texts in `assets/fonts/OFL-*.txt`).
