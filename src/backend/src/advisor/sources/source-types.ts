// Shape of the advisor's source documents (F8): one JSON file per official
// document in this folder, with the document's `pdftotext -layout` output in
// `text/`, so a test can check that every entry is the document's own words.
// The PDFs themselves are never committed.
//
// Wording is exact: only line wraps are joined (one space, or none after a
// line that ends in "-"). Pages are PDF page indexes, which in these documents
// equal the printed page numbers.

/** The document an entry comes from. */
export interface SourceDocument {
  /** Stable id, the prefix of every entry id. */
  id: string;
  /** The PDF's file name as shared. */
  file: string;
  /** sha256 of that PDF, to tell a later edition apart. */
  sha256: string;
  pages: number;
  title: string;
  issuer: string;
  /** Place and date as printed on the cover. */
  issued: string;
  /** Language of the text: 'en' or 'vi'. */
  language: string;
  /** Path of the committed text, relative to this folder. */
  text: string;
  note: string;
}

/** One course description. */
export interface CourseDescriptionEntry {
  /** `<document id>/<code>`; stable across regenerations. */
  id: string;
  /** The course code as printed in the heading and in "Course ID". */
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
  /** Page of the course heading. */
  page: number;
  /** Last page the entry runs onto. */
  last_page: number;
}

export interface CourseDescriptionSource {
  document: SourceDocument;
  entries: CourseDescriptionEntry[];
}
