# OmniCourse reports and course deliverables

XeLaTeX sources for the **Elements of Software Engineering (HCMUS)** deliverables of OmniCourse: the project assignments (PA1, PA2, …) and the weekly reports. This folder replaces the old `/pa` folder.

The assignment briefs (`PA1.pdf`, `PA2.pdf`, …) are the instructor's handouts. Download them from the course page on Moodle into the matching `assignments/PAn/` folder. They are git-ignored and never committed, and so is every built PDF.

## Layout

```text
report/
├── shared/
│   ├── omnicourse.sty          # Style: colours, typography, cover, tables, font fallbacks
│   ├── meta.example.tex        # Template with fake names and IDs (committed)
│   └── meta.tex                # Real names, student IDs, group ID (git-ignored, local only)
├── weekly/
│   ├── README.md               # Week, sprint and milestone schedule
│   └── WeeklyReport-WeekNN.tex # One file per week (Week01 to Week10)
├── assignments/
│   ├── PA1/                    # Inception, due 18/10/2026: ProjectPlan.tex, Vision.tex (v1.0)
│   └── PA2/                    # Elaboration, due 01/11/2026: ProjectPlan.tex, Vision.tex (v2.0), UseCase-Specification.tex
├── dist/                       # Packaged submissions (generated, git-ignored)
├── build.ps1                   # Build and package on Windows (PowerShell)
└── build.sh                    # Build and package on Linux, macOS and Git Bash
```

## Before the first build

The documents read the team table from `shared/meta.tex`, which is git-ignored because student IDs are personal data (AGENTS.md hard rule 3). Create it from the template, then put the real names, IDs and group ID in it on your machine only:

```bash
cp report/shared/meta.example.tex report/shared/meta.tex
```

Both build scripts stop with this instruction when `meta.tex` is missing.

- `\OmniCourseGroup`: group ID, for example `PA1-Group03`. Covers and ZIP names follow it.
- `\OmniCourseTeamTable`, `\OmniCourseTeamShort`, `\teamtable`: members, student IDs and roles.

## Commands

| Target | PowerShell | Bash | Builds |
| :--- | :--- | :--- | :--- |
| Everything | `.\build.ps1` | `./build.sh all` | Every document |
| One week | `.\build.ps1 -Target week3` | `./build.sh week3` | Weekly report for week 3 |
| All weeks | `.\build.ps1 -Target weekly` | `./build.sh weekly` | Every weekly report |
| PA1 | `.\build.ps1 -Target pa1` | `./build.sh pa1` | ProjectPlan and Vision v1.0 |
| PA2 | `.\build.ps1 -Target pa2` | `./build.sh pa2` | ProjectPlan, Vision v2.0 and Use-Case Specification |
| Clean | `.\build.ps1 -Clean` | `./build.sh clean` | Deletes `.aux`, `.log`, `.toc`, `.out` |

### Container build (Docker or Podman)

Without a local TeX installation, run the same build in the pinned TeX Live image (`ghcr.io/xu-cheng/texlive-full:20261001`):

```powershell
.\build.ps1 -Docker -Target pa2
.\build.ps1 -Docker -Package pa2
```

```bash
./build.sh --docker pa2
./build.sh --docker pa2-package
```

### Packaging a submission

The brief asks for a folder `PAn-Group[GroupId]` with the PDFs, zipped as `PAn-Group[GroupId].zip`.

- PA1: `ProjectPlan.pdf`, `Vision.pdf`, `WeeklyReport-Week01.pdf`, `WeeklyReport-Week02.pdf`.
- PA2: `ProjectPlan.pdf` (v2.0), `Vision.pdf` (v2.0), `UseCase-Specification.pdf`, `WeeklyReport-Week03.pdf`, `WeeklyReport-Week04.pdf`.

```powershell
.\build.ps1 -Package pa2
```

```bash
./build.sh pa2-package
```

The ZIP lands in `report/dist/`, ready to upload to Moodle.

## Fonts

The style falls back across platforms so every machine builds the same document:

- Serif: Palatino Linotype → Palatino → TeX Gyre Pagella → Liberation Serif / DejaVu Serif → Latin Modern Roman.
- Sans: Segoe UI → SF Pro Display → TeX Gyre Heros → Helvetica Neue → Liberation Sans / DejaVu Sans → Latin Modern Sans.
- Mono: Consolas → Menlo → TeX Gyre Cursor → Liberation Mono / DejaVu Sans Mono → Latin Modern Mono.

All fallbacks render Vietnamese diacritics.
