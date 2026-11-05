import type { GuideFile } from '../guide-file.js';

// G02 Register for courses (guides plan §4, §5). Draft: fill in the text by hand, have
// a team member follow it on the portal, then set lastChecked and status 'published'.
// See README.md in this folder. Search expectations: B1 test cases, GUIDE-01c.
export default {
  id: 'register-courses',
  lang: 'en',
  status: 'draft',
  version: 1,
  changeNote: '',
  lastChecked: null,
  group: 'registration',
  title: 'Register for courses',
  keywords: [],
  summary: '',
  when: { text: '' },
  appliesTo: '',
  // From the UI prototype's portal list. Replace with the deepest page the portal allows.
  portal: { name: '', url: 'https://portal.hcmus.edu.vn', account: '' },
  steps: [],
} satisfies GuideFile;
