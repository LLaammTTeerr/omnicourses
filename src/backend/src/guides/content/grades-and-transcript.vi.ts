import type { GuideFile } from '../guide-file.js';

// G07 View your grades and download your transcript PDF (guides plan §4, §5). Draft: fill
// in the text by hand, have a team member follow it on the portal, then set lastChecked
// and status 'published'. See README.md in this folder. Search expectations: GUIDE-01c.
export default {
  id: 'grades-and-transcript',
  lang: 'vi',
  status: 'draft',
  version: 1,
  changeNote: '',
  lastChecked: null,
  group: 'records-and-certificates',
  title: 'Xem điểm, tải bảng điểm',
  keywords: [],
  summary: '',
  when: { text: '' },
  appliesTo: '',
  // From the UI prototype's portal list. Replace with the deepest page the portal allows.
  portal: { name: '', url: 'https://portal.hcmus.edu.vn', account: '' },
  steps: [],
} satisfies GuideFile;
