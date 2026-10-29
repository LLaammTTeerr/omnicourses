import type { CatalogDecision } from './seed-types.js';

// Courses whose printed values differ between the APCS 2024 and 2025 PDFs.
// The shared catalog holds one row per code, so each difference needs a
// decision a human signs off in review. Rule used: the newer curriculum's
// wording, because it is how the course is named today. Any difference not
// listed here aborts the seed and fails the spec.
export const apcsCatalogDecisions: CatalogDecision[] = [
  {
    code: 'CM102',
    field: 'name_vi',
    printed: [
      { curriculum: 'APCS2024', value: 'Tư duy độc lập', pages: [6, 9, 14] },
      { curriculum: 'APCS2025', value: 'Tư duy phản biện', pages: [6, 10, 15] },
    ],
    catalog_value: 'Tư duy phản biện',
    reason: 'Same code, credits and English name ("Critical Thinking") in both PDFs; 2025 renames it in Vietnamese.',
  },
  {
    code: 'BAA00004',
    field: 'name_en',
    printed: [
      { curriculum: 'APCS2024', value: 'Introduction to Laws', pages: [14] },
      { curriculum: 'APCS2025', value: 'General Law', pages: [15] },
    ],
    catalog_value: 'General Law',
    reason: 'Appendix translation changed; Vietnamese name and credits are the same.',
  },
  {
    code: 'BAA00021',
    field: 'name_en',
    printed: [
      { curriculum: 'APCS2024', value: 'Physical Education 1', pages: [14] },
      { curriculum: 'APCS2025', value: 'Gymnastic 1', pages: [15] },
    ],
    catalog_value: 'Gymnastic 1',
    reason: 'Appendix translation changed; Vietnamese name and credits are the same.',
  },
  {
    code: 'BAA00022',
    field: 'name_en',
    printed: [
      { curriculum: 'APCS2024', value: 'Physical Education 2', pages: [14] },
      { curriculum: 'APCS2025', value: 'Gymnastic 2', pages: [15] },
    ],
    catalog_value: 'Gymnastic 2',
    reason: 'Appendix translation changed; Vietnamese name and credits are the same.',
  },
  {
    code: 'BAA00030',
    field: 'name_en',
    printed: [
      { curriculum: 'APCS2024', value: 'Military Education', pages: [14] },
      { curriculum: 'APCS2025', value: 'National Defence Education', pages: [15] },
    ],
    catalog_value: 'National Defence Education',
    reason: 'Appendix translation changed; Vietnamese name and credits are the same.',
  },
];
