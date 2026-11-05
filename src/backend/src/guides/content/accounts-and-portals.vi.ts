import type { GuideFile } from '../guide-file.js';

// G01 Your school accounts and portals (guides plan §4, §5). Draft: fill in the text by
// hand, have a team member follow it on the portal, then set lastChecked and status
// 'published'. See README.md in this folder. Search expectations: GUIDE-01c.
export default {
  id: 'accounts-and-portals',
  lang: 'vi',
  status: 'draft',
  version: 1,
  changeNote: '',
  lastChecked: null,
  group: 'accounts-and-portals',
  title: 'Tài khoản và cổng thông tin',
  keywords: [],
  summary: '',
  when: { text: '' },
  appliesTo: '',
  // From the UI prototype's portal list. Replace with the deepest page the portal allows.
  portal: { name: '', url: 'https://portal.hcmus.edu.vn', account: '' },
  steps: [],
  // The board (guides plan §5 G01). From the UI prototype's list: keep only the sites
  // APCS students use, and fill in each name, account and purpose.
  portals: [
    { name: '', url: 'https://portal.hcmus.edu.vn', account: '', purpose: '' },
    { name: '', url: 'https://hocphi.hcmus.edu.vn', account: '', purpose: '' },
    { name: '', url: 'https://courses.fit.hcmus.edu.vn', account: '', purpose: '' },
    { name: '', url: 'https://courses.ctda.hcmus.edu.vn', account: '', purpose: '' },
    { name: '', url: 'https://www.ctda.hcmus.edu.vn', account: '', purpose: '' },
    { name: '', url: 'https://www.fit.hcmus.edu.vn', account: '', purpose: '' },
    { name: '', url: 'https://pdt.hcmus.edu.vn', account: '', purpose: '' },
    { name: '', url: 'https://ctsv.hcmus.edu.vn', account: '', purpose: '' },
    { name: '', url: 'https://glib.hcmus.edu.vn', account: '', purpose: '' },
    { name: '', url: 'https://hcmus.edu.vn', account: '', purpose: '' },
  ],
} satisfies GuideFile;
