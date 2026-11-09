// Course descriptions the F8 advisor answers from, laid out like
// `advisor/regulations/`: per document `<id>`,
//   sources/<id>.pdftotext.txt  the PDF's `pdftotext -layout` output, unchanged
//                               (the PDF itself never enters git);
//   sources/<id>.source.json    metadata written by a person, with both sha256s;
//   <id>.json                   that metadata plus `courses`.
// course-descriptions.spec.ts checks every field of every course against the
// text of its pages.
//
// Wording is exact: only line wraps are joined (one space, or none after a
// line that ends in a non-space "-"), and the letterhead and page number each
// page repeats are dropped.

/** `sources/<id>.source.json`. */
export interface CourseDescriptionSource {
  /** Lower-case words joined by hyphens; the prefix of every course id. */
  id: string;
  title: string;
  shortName: string;
  issuer: string;
  /** Place and date as printed on the cover. */
  issued: string;
  /** Language of the text. */
  language: 'en' | 'vi';
  /** null when the PDF was shared directly and has no public URL. */
  sourceUrl: string | null;
  pdf: { file: string; sha256: string; pages: number };
  textLayer: { command: string; tool: string; sha256: string };
  notes: string[];
}

/** One course description. */
export interface CourseDescription {
  /** `<document id>/<code>`. */
  id: string;
  /** The code as printed in the heading and in "Course ID". */
  code: string;
  /** null where the document prints no Vietnamese name. */
  name_vi: string | null;
  /** The heading's course name. */
  name_en: string;
  /** "Number of credits". */
  credits: number;
  /** "Knowledge block", as printed. */
  knowledge_block: string;
  /**
   * The "Prior-course" line exactly as printed, null where it is blank. Not a
   * rule: the rule engine never reads it (AGENTS.md hard rule 1).
   */
  prerequisites_printed: string | null;
  /** "Course description". */
  description: string;
  /** "Course goals": one string per bullet; a paragraph without bullets is one item. */
  goals: string[];
  /** "Course content": one string per bullet; text before the first bullet is the first item. */
  content: string[];
  /** The pages the description runs over; the first holds its heading. */
  pages: number[];
}

/** `<id>.json`. */
export interface CourseDescriptionDocument extends CourseDescriptionSource {
  courses: CourseDescription[];
}
