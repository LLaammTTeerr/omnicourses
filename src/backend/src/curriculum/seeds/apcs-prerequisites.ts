import type { NoPrerequisitesDecision } from './seed-types.js';

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
      printed: 'Nếu sinh viên không hoàn thành CS469 sẽ không được tiếp tục thực hiện CS470.',
      pages: { APCS2024: 8, APCS2025: 9 },
      decided_by: 'Project Lead (Lâm)',
      date: '2026-11-24',
    },
  ],
};
