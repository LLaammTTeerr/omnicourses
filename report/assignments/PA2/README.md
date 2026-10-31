# Project Assignment 2 (PA2) -- Elaboration Phase (Sprint 2)

- **Course:** Elements of Software Engineering (HCMUS)
- **Phase:** Elaboration (Sprint 2: Weeks 3 -- 4)
- **Period:** 19 October 2026 -- 1 November 2026
- **Due Date:** 01/11/2026
- **Total Points:** 50 points

---

## 1. Deliverables Checklist & Grading Rubric

| Item | Component | Pts | Source File | Deliverable PDF | Status |
| :---: | :--- | :---: | :--- | :--- | :---: |
| **a** | **Revised Project Plan & Vision Document (2nd submission)**<br>• Incorporate TA feedback from PA1.<br>• Detail schedule, functional & non-functional requirements, competitors.<br>• Update **Revision History** for each document.<br>• **Highlight changes in BLUE font** (`\textcolor{blue}{...}`). | 5 | `ProjectPlan.tex`<br>`Vision.tex` | `ProjectPlan.pdf`<br>`Vision.pdf` | In progress |
| **c** | **Use-Case Model**<br>Actor-use case diagrams & relationships. Included in the Use-Case Specification document. | 5 | Included in `UseCase-Specification.tex` | Included in `UseCase-Specification.pdf` | In progress |
| **d** | **Use-Case Specification**<br>Detailed flows (Basic flow, Alternative flows, Pre-conditions, Post-conditions) for key use cases. | 10 | `UseCase-Specification.tex` | `UseCase-Specification.pdf` | In progress |
| **e** | **UI Prototyping**<br>Prototypes/screens for at least 3 key use cases directly matching specifications. | 5 | See `docs/analysis-and-design/ui-prototypes/` | `UI-Prototypes.pdf` (made by hand, not built by the scripts) | In progress |
| **f** | **Project Execution & Tracking**<br>Teamwork, task board, continuous integration, Build B0 deployed. | 20 | Git repo, Discord board, Staging CI | Verified by TA | Ongoing |
| **g** | **Weekly Reports (Sprint 2)**<br>Week 3 (19/10--25/10) & Week 4 (26/10--01/11). | 5 | `../../weekly/WeeklyReport-Week03.tex`<br>`../../weekly/WeeklyReport-Week04.tex` | `WeeklyReport-Week03.pdf`<br>`WeeklyReport-Week04.pdf` | Ready / In progress |

---

## 2. Key Rules from Professor & TAs (`PA2.pdf`)

1. **Blue Highlighting:** All modifications, expansions, and responses to TA feedback from PA1 must be highlighted with **blue font** (`\textcolor{ocAccent}{...}` or `\textcolor{blue}{...}`) in both `ProjectPlan.pdf` and `Vision.pdf`.
2. **Revision History:** Every revised document must include an updated row in the Revision History table explicitly noting what changed in version 2.0.
3. **Use-Case Specifications:** Each use case must have a complete main flow and alternative flows.
4. **UI Prototypes:** Must directly correspond to the steps described in the Use-Case specifications for at least 3 key scenarios.

---

## 3. Submission Package Structure

According to `PA2.pdf`:
> *"You must copy all documents to the directory named `PA2-Group[GroupId]` and compress the whole directory to zip/rar file. For example: `PA2-Group01.zip`"*

When packaged (via `build.ps1 -Package PA2` or `build.sh pa2-package`):
```text
PA2-GroupXX/
├── ProjectPlan.pdf             # Version 2.0 (with blue text changes)
├── Vision.pdf                  # Version 2.0 (with blue text changes)
├── UseCase-Specification.pdf   # Diagrams + use case specs
├── UI-Prototypes.pdf           # add by hand: the build scripts do not produce it
├── WeeklyReport-Week03.pdf
└── WeeklyReport-Week04.pdf
```
