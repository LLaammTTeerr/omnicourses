import type { NoPrerequisitesDecision } from './seed-types.js';

/**
 * APCS courses have no prerequisite, except one. The Project Lead decided "no prerequisite" on
 * 15 November 2026. The exception, CS469 before CS470, is printed in the curriculum PDFs. The seed has
 * recorded it since 21 November 2026 (#111), and the Project Lead decided it on 24 November 2026. The seeds
 * of APCS 2024 and APCS 2025 carry the decision, and `db:seed` records every course of both curricula as
 * "no prerequisite", except CS470, which needs CS469 (ADR 0011, amendment of 15 November 2026). Offering
 * terms stay not recorded.
 */
export const apcsNoPrerequisites: NoPrerequisitesDecision = {
  decided_by: 'Project Lead (Lâm)',
  date: '2026-11-15',
  source:
    'Stated by the Project Lead on the team Discord on 15 November 2026: "apcs have no prerequisite". ' +
    'One printed rule is kept: none, except CS469 before CS470, printed in the note under 7.3 ' +
    '"Kiến thức tốt nghiệp" of the APCS 2024 and 2025 curriculum PDFs (p. 8 of APCS 2024, p. 9 of APCS 2025). ' +
    'Thắng found the rule on 17 November 2026, in the review of #111. The seed has recorded it since ' +
    '21 November 2026: asked to choose, the Project Lead left the choice open, and the AI agent that works ' +
    'in his name chose to record it. On 24 November 2026 Thắng confirmed the printed rule, and the Project ' +
    'Lead decided it on the team Discord: "trust Thang". The PDFs print no prerequisite column, and the ' +
    '"Prior-course" lines of the 2021 course-description booklet below are not rules.',
  except: [
    {
      code: 'CS470',
      requires: ['CS469'],
      // Rule (iii) of the note, as printed. (i) and (ii) of the same note are counting rules, not prerequisites,
      // and are not loaded.
      printed: 'Nếu sinh viên không hoàn thành CS469 sẽ không được tiếp tục thực hiện CS470.',
      pages: { APCS2024: 8, APCS2025: 9 },
      // In the seed since 21 November 2026 (#111), by the choice of the AI agent that works in the Project
      // Lead's name. The decision is the Project Lead's, of 24 November 2026 (ADR 0011).
      decided_by: 'Project Lead (Lâm)',
      date: '2026-11-24',
    },
  ],
};
