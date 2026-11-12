/**
 * The student handbook (Sổ tay sinh viên): from the PDF's `pdftotext` output to retrievable passages
 * with section and page citations (F8, ADR 0016).
 *
 * A handbook is a compilation, not one decision: office and faculty pages, the academic calendar, and
 * excerpts of several regulations, each with its own Điều numbering. So it gets its own extractor,
 * deterministic like the regulation one, plus a redaction pass: the repository is public and the
 * handbook prints staff names, phone numbers and e-mail addresses (AGENTS.md hard rule 3).
 */

/** Hand-written facts about the source: `sources/<id>.source.json`. */
export interface HandbookSource {
  /** Lower-case words joined by hyphens; the prefix of every passage id. */
  id: string;
  title: string;
  /** How a student names it in a citation. */
  shortName: string;
  issuer: string;
  /** Where the PDF came from. It stays out of git. */
  obtained: string;
  pdf: { sha256: string; pages: number };
  textLayer: { command: string; tool: string; sha256: string };
  /** PDF page number minus printed page number. */
  printedPageOffset: number;
  sections: HandbookSection[];
  /** Hand corrections of the text layer, each with its reason. */
  overrides: HandbookOverride[];
  /** Pages left out on purpose, with the reason. */
  excluded: { pdfPages: [number, number]; reason: string }[];
  notes: string[];
}

export interface HandbookSection {
  /** Short slug, the second segment of the passage ids. */
  id: string;
  /** The section title as a student would cite it. */
  title: string;
  /** `regulation`: Chương › Điều › khoản; `prose`: split at upper-case headings. */
  kind: 'regulation' | 'prose';
  /** First and last PDF page. */
  pdfPages: [number, number];
  /** The section starts at this exact line of its first page (default: the top of the page). */
  startsAt?: string;
  /** The section ends just before this exact line of its last page (default: the end of the page). */
  endsBefore?: string;
  /** Prose only: a regular expression; only upper-case lines matching it open a passage. */
  headings?: string;
  /** Prose only: a regular expression for headings carried into the labels of the passages under them. */
  context?: string;
  /**
   * Prose only: a context heading takes the next upper-case line only when `<heading so far> | <line>`
   * matches this ("KHOA" + "ĐỊA CHẤT"); any other upper-case line after it opens a passage of its own.
   */
  contextContinues?: string;
}

/**
 * - `replacePage`: the text layer of `pdfPage` holds text the printed page does not show (hidden
 *   layers); `lines` is the visible text, transcribed from the page image.
 * - `dropLines`: exact lines removed from `pdfPage` (stray hidden text, or a personal name the
 *   automatic redaction misses).
 */
export type HandbookOverride =
  | { kind: 'replacePage'; pdfPage: number; reason: string; lines: string[] }
  | { kind: 'dropLines'; pdfPage: number; reason: string; lines: string[] };

/** One retrievable unit: a khoản of an excerpted regulation, or a headed block of a prose section. */
export interface HandbookPassage {
  /** `<id>/<section>/d<article>[/k<khoan>][/p<part>]` or `<id>/<section>/p<n>`. */
  id: string;
  /** The citation: section, then Điều and khoản where the source numbers them. */
  label: string;
  section: { id: string; title: string };
  /** The heading the passage sits under: a chapter title or a printed upper-case heading. */
  heading: string | null;
  article: { number: number; title: string } | null;
  khoan: number | null;
  /** Printed page numbers. */
  pages: number[];
  /** The source wording after redaction; paragraphs separated by `\n`. */
  text: string;
}

export interface HandbookDocument extends HandbookSource {
  passages: HandbookPassage[];
  /** How many source lines the redaction removed, by rule. Counts only, never the lines. */
  redactions: Record<string, number>;
}

interface Line {
  text: string;
  /** Printed page number. */
  page: number;
}

const collapse = (text: string): string => text.normalize('NFC').replace(/\s+/gu, ' ').trim();

// ---------------------------------------------------------------------------------------------
// Redaction

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/u;
const DATE = /\b\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?\b/gu;
const PHONE = /(?:\+?84|\(?0\d{1,3}\)?)[\s.]?\d{2,4}[\s.]?\d{2,4}(?:[\s.]?\d{2,4})?/u;
const EXTENSION = /(?<![\p{L}\p{N}])(?:ext|số nội bộ|phím)(?![\p{L}\p{N}])/iu;
const ACADEMIC_TITLE = /(?:^|[\s(,;:])(?:PGS|GS|TS|ThS|CN|KS|BS|NCS)\s?\.\s?(?:TS\.?\s?)?\p{Lu}|(?<![\p{L}\p{N}])(?:Thạc sĩ|Tiến sĩ|Giáo sư|Phó giáo sư)\s+\p{Lu}/u;
const HONORIFIC = /(?<![\p{L}\p{N}])(?:Ông|Bà)\s+\p{Lu}\p{Ll}+/u;
const SURNAMES =
  'Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Lý|Đinh|Lâm|Mai|Trương|Tô|Hà|Cao|Châu|Tạ|Thái|Đoàn|Lương|Kiều|Quách|Trịnh|Đào|Chu|Tăng|Lưu|Văn|Từ|Triệu|Tôn|Mạc|Khúc|Phùng|Vương|Âu|Diệp|Ung|Thân|Giang|Hứa|Lục|Doãn';
// Not after a house number: "227 Nguyễn Văn Cừ" is a street. JavaScript's \b is ASCII-only, hence the lookarounds.
const PERSON_NAME = new RegExp(`(?<!\\d\\s?)(?<![\\p{L}\\p{N}])(?:${SURNAMES})(?:\\s+\\p{Lu}\\p{Ll}*){2,3}(?![\\p{L}\\p{N}])`, 'gu');
/** Place, street and organisation names that look like a person's name. */
const PUBLIC_NAMES = [
  'Hồ Chí Minh',
  'Nguyễn Văn Cừ',
  'Đoàn Thanh Niên',
  'Đoàn Thanh niên',
  'Lê Duẩn',
  'Lê Lợi',
  'Trần Hưng Đạo',
  'Võ Văn Ngân',
  'Hà Nội',
];
/** A line that opens the contact block of an office or a faculty: names, addresses and numbers follow. */
const CONTACT_BLOCK = /^(?:Thông tin chung|Thông tin liên hệ|Ban Chủ nhiệm|Ban chủ nhiệm|Một số thông tin liên hệ|Đội ngũ tham vấn viên|Liên hệ|Văn phòng khoa)(?![\p{L}\p{N}])/u;
const ADDRESS = /(?<![\p{L}\p{N}])(?:Cơ sở \d|Nguyễn Văn Cừ|Linh Trung|Dĩ An|KP\s?\d|Q\.\s?5|TP\.?\s?HCM\b.*\d|Tầng \d+,? [Tt]òa|Phòng [A-Z]\.?\s?\d)/u;
/**
 * A line that still belongs to a contact block: a role ("Trưởng Khoa:"), a label ending in a colon, a
 * line in brackets, a short line of capitalised words (a name), or any line redaction or the address
 * rule catches. The first line that is none of these ends the block, so the faculty's own text after
 * its contacts is kept.
 */
const CONTACT_LINE =
  /^(?:[-+•]\s*)?(?:Thông tin|Ban [Cc]hủ nhiệm|Trưởng|Phó|Trợ lý|Giáo vụ|Văn phòng|Hotline|E-?mail|Điện thoại|ĐT|Fax|Website|Fanpage|Địa chỉ|Liên hệ|Cố vấn|Chuyên viên|Giám đốc|Thư ký|Tham vấn)|:$|^\(.*\)$|^f\s/u;
const NAME_LINE = /^(?:[-+•]\s*)?(?:\p{Lu}[\p{L}.]*\s*){2,6}$/u;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:edu\.vn|com|vn|me|org)\/\S*/iu;

export type RedactionRule = 'email' | 'phone' | 'academic_title' | 'honorific' | 'person_name' | 'contact_block' | 'address' | 'override';

/** Why a line must not be published, or null. Dates are not phone numbers. */
export function redactionRule(line: string): RedactionRule | null {
  if (EMAIL.test(line)) return 'email';
  const withoutDates = line.replace(DATE, ' ');
  if (PHONE.test(withoutDates) || EXTENSION.test(line)) return 'phone';
  if (ACADEMIC_TITLE.test(line)) return 'academic_title';
  if (HONORIFIC.test(line)) return 'honorific';
  if (personNames(line).length > 0) return 'person_name';
  return null;
}

/** Names in a line that look like a person's: a common surname and two or three capitalised words. */
export function personNames(line: string): string[] {
  let rest = line;
  for (const name of PUBLIC_NAMES) rest = rest.split(name).join(' ');
  return [...rest.matchAll(PERSON_NAME)].map((m) => m[0]);
}

const isHeading = (text: string): boolean => {
  const letters = text.replace(/[^\p{L}]/gu, '');
  return letters.length >= 4 && text.length <= 80 && text === text.toUpperCase() && /\p{Lu}/u.test(text);
};

// ---------------------------------------------------------------------------------------------
// Pages and lines

/** The section's lines with their printed page, after overrides, page numbers and redaction. */
function sectionLines(source: HandbookSource, pages: string[], section: HandbookSection, counts: Record<string, number>): Line[] {
  const [first, last] = section.pdfPages;
  const lines: Line[] = [];
  let contact = false;
  for (let pdfPage = first; pdfPage <= last; pdfPage++) {
    const page = pdfPage - source.printedPageOffset;
    const replace = source.overrides.find((o) => o.kind === 'replacePage' && o.pdfPage === pdfPage);
    let raw = replace ? replace.lines : pages[pdfPage - 1].split('\n');
    for (const o of source.overrides) {
      if (o.kind !== 'dropLines' || o.pdfPage !== pdfPage) continue;
      for (const drop of o.lines) {
        const at = raw.findIndex((l) => collapse(l) === collapse(drop));
        if (at === -1) throw new Error(`override on PDF page ${pdfPage}: no line "${drop}"`);
        raw = [...raw.slice(0, at), ...raw.slice(at + 1)];
        counts.override = (counts.override ?? 0) + 1;
      }
    }
    let texts = raw.map(collapse).filter(Boolean);
    // The printed page number: the page's last line, or a line of its own mid-page where the text
    // layer reads a two-column page column by column.
    texts = texts.filter((t) => t !== String(page));
    if (pdfPage === first && section.startsAt !== undefined) {
      const at = texts.indexOf(section.startsAt);
      if (at === -1) throw new Error(`section ${section.id}: no line "${section.startsAt}" on PDF page ${pdfPage}`);
      texts = texts.slice(at);
    }
    if (pdfPage === last && section.endsBefore !== undefined) {
      const at = texts.indexOf(section.endsBefore);
      if (at === -1) throw new Error(`section ${section.id}: no line "${section.endsBefore}" on PDF page ${pdfPage}`);
      texts = texts.slice(0, at);
    }
    for (const text of texts) {
      if (isHeading(text)) contact = false;
      if (section.kind === 'prose' && CONTACT_BLOCK.test(text)) contact = true;
      const rule = redactionRule(text) ?? (section.kind === 'prose' && ADDRESS.test(text) ? 'address' : null);
      if (contact && !isHeading(text) && !CONTACT_BLOCK.test(text)) {
        const signal = CONTACT_LINE.test(text) || NAME_LINE.test(text) || URL.test(text) || rule !== null || ADDRESS.test(text);
        if (!signal) contact = false;
      }
      if (contact && !isHeading(text)) {
        // Inside a contact block only a public web address survives, on its own.
        const url = URL.exec(text);
        if (url && !EMAIL.test(text)) lines.push({ text: url[0].replace(/[).,;]+$/u, ''), page });
        else counts.contact_block = (counts.contact_block ?? 0) + 1;
        continue;
      }
      if (rule) {
        counts[rule] = (counts[rule] ?? 0) + 1;
        continue;
      }
      lines.push({ text, page });
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------------------------
// Paragraphs

/** A line that starts a new paragraph: a list marker, a numbered or lettered item, a heading. */
const STARTS_PARAGRAPH = /^(?:[-+•●❖−–*]|\d+(?:\.\d+)*[.)](?:\s|$)|[a-zđ][.)]\s|[IVX]+\.(?:\s|$)|Điều \d|Chương [IVX]|CHƯƠNG [IVX]|Tiêu chí \d|Bước \d|\(\*\))/u;

/** Joins wrapped lines into paragraphs. A marker alone on its line ("1.") takes the next line with it. */
export function paragraphs(lines: string[]): string[] {
  const out: string[] = [];
  let pendingMarker = false;
  for (const line of lines) {
    const startsNew = STARTS_PARAGRAPH.test(line) || isHeading(line) || out.length === 0 || /[:;]$/u.test(out[out.length - 1]);
    if (pendingMarker) {
      out[out.length - 1] = `${out[out.length - 1]} ${line}`;
      pendingMarker = false;
    } else if (startsNew) {
      out.push(line);
    } else {
      const left = out[out.length - 1];
      out[out.length - 1] = /\p{L}-$/u.test(left) && /^\p{L}/u.test(line) ? `${left}${line}` : `${left} ${line}`;
    }
    // A marker alone on its line ("1."), or a calendar date alone ("06/9 - 14/9/2024:"), takes the next line with it.
    pendingMarker = /^(?:\d+(?:\.\d+)*[.)]|[a-zđ][.)]|[-•●−–]|[\d\s/-]+:)$/u.test(line);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Passages

export const MAX_PASSAGE = 1500;

/** Splits text longer than MAX_PASSAGE at paragraph breaks, keeping each part under it where it can. */
export function splitLong(text: string): string[] {
  if (text.length <= MAX_PASSAGE) return [text];
  const parts: string[] = [];
  let current = '';
  for (const paragraph of text.split('\n')) {
    if (current && current.length + paragraph.length + 1 > MAX_PASSAGE) {
      parts.push(current);
      current = paragraph;
    } else current = current ? `${current}\n${paragraph}` : paragraph;
  }
  if (current) parts.push(current);
  return parts;
}

interface Draft {
  idPath: string;
  label: string;
  heading: string | null;
  article: { number: number; title: string } | null;
  khoan: number | null;
  lines: Line[];
}

function finish(source: HandbookSource, section: HandbookSection, drafts: Draft[]): HandbookPassage[] {
  const passages: HandbookPassage[] = [];
  for (const draft of drafts) {
    const body = paragraphs(draft.lines.map((l) => l.text)).join('\n');
    // Keep every numbered khoản, however short. In prose, drop a heading with nothing under it (a
    // faculty's name page) and stray fragments, but keep a short calendar entry (the summer term's dates).
    const letters = (text: string) => text.replace(/[^\p{L}]/gu, '').length;
    const keep =
      draft.article !== null ? letters(body) > 0 : section.kind === 'prose' && draft.heading !== null ? letters(body) - letters(draft.heading) >= 10 : letters(body) >= 30;
    if (!keep) continue;
    const parts = splitLong(body);
    let from = 0;
    parts.forEach((text, i) => {
      // The pages of a part: those of the lines its words came from.
      const pages = pagesOf(draft.lines, text, from);
      from = pages.next;
      const suffix = parts.length > 1 ? `/p${i + 1}` : '';
      passages.push({
        id: `${source.id}/${section.id}/${draft.idPath}${suffix}`.replace(/\/{2,}/gu, '/').replace(/\/$/u, ''),
        label: parts.length > 1 ? `${draft.label} (phần ${i + 1})` : draft.label,
        section: { id: section.id, title: section.title },
        heading: draft.heading,
        article: draft.article,
        khoan: draft.khoan,
        pages: pages.list,
        text,
      });
    });
  }
  return passages;
}

/** The printed pages a part spans, by counting its words through the draft's lines. */
function pagesOf(lines: Line[], text: string, fromLine: number): { list: number[]; next: number } {
  let words = text.split(/\s+/u).filter(Boolean).length;
  const list: number[] = [];
  let at = fromLine;
  while (at < lines.length && words > 0) {
    if (!list.includes(lines[at].page)) list.push(lines[at].page);
    words -= lines[at].text.split(/\s+/u).filter(Boolean).length;
    at++;
  }
  if (list.length === 0 && lines.length > 0) list.push(lines[Math.min(fromLine, lines.length - 1)].page);
  return { list, next: at };
}

const CHAPTER = /^(?:Chương|CHƯƠNG)\s+([IVXLC]+)$/u;
const ARTICLE = /^Điều\s+(\d+)\s*[.:]\s*(.*)$/u;
const KHOAN = /^(\d+)(?:\.(\d+))?\.(?:\s+(.*))?$/u;

/** An excerpted regulation: one passage per khoản, one for an article's text before its first khoản. */
function regulationPassages(source: HandbookSource, section: HandbookSection, lines: Line[]): HandbookPassage[] {
  const drafts: Draft[] = [];
  let chapter: string | null = null;
  let expectChapterTitle = false;
  let article: Draft['article'] = null;
  let expectArticleTitle = false;
  let current: Draft = { idPath: 'gioi-thieu', label: `${section.title}, phần mở đầu`, heading: null, article: null, khoan: null, lines: [] };
  drafts.push(current);
  const seenKhoan = new Map<number, number>();
  let lastKhoan = 0;

  for (const line of lines) {
    const chapterMatch = CHAPTER.exec(line.text);
    if (chapterMatch) {
      chapter = '';
      expectChapterTitle = true;
      continue;
    }
    if (expectChapterTitle && isHeading(line.text)) {
      chapter = chapter ? `${chapter} ${line.text}` : line.text;
      continue;
    }
    expectChapterTitle = false;
    const articleMatch = ARTICLE.exec(line.text);
    if (articleMatch) {
      article = { number: Number(articleMatch[1]), title: articleMatch[2] };
      seenKhoan.clear();
      lastKhoan = 0;
      expectArticleTitle = true;
      current = { idPath: `d${article.number}`, label: `${section.title}, Điều ${article.number}`, heading: chapter, article, khoan: null, lines: [] };
      drafts.push(current);
      continue;
    }
    if (expectArticleTitle && article && /^\p{Ll}/u.test(line.text)) {
      article.title = `${article.title} ${line.text}`;
      continue;
    }
    expectArticleTitle = false;
    const khoanMatch = article ? KHOAN.exec(line.text) : null;
    if (khoanMatch && article) {
      // "12.3." numbers khoản 3 of Điều 12; "1.1." under Điều 1 likewise. Anything else is a list item.
      const dotted = khoanMatch[2] !== undefined;
      if (!dotted || Number(khoanMatch[1]) === article.number) {
        const number = Number(dotted ? khoanMatch[2] : khoanMatch[1]);
        if (number === lastKhoan + 1 || (number === 1 && lastKhoan > 0)) {
          const occurrence = (seenKhoan.get(number) ?? 0) + 1;
          seenKhoan.set(number, occurrence);
          lastKhoan = number;
          const repeat = occurrence > 1 ? `-${occurrence}` : '';
          current = {
            idPath: `d${article.number}/k${number}${repeat}`,
            label: `${section.title}, Điều ${article.number}, khoản ${number}${occurrence > 1 ? ` (lần ${occurrence})` : ''}`,
            heading: chapter,
            article,
            khoan: number,
            lines: [line],
          };
          drafts.push(current);
          continue;
        }
      }
    }
    current.lines.push(line);
  }
  return finish(source, section, drafts);
}

/**
 * A prose section: one passage per printed upper-case heading; consecutive heading lines merge. With
 * `headings`, only lines matching it open a passage (a calendar prints its events in capitals too).
 * A heading matching `context` (a faculty's name, a programme's calendar) is carried into the labels
 * of the passages under it, so "CHUẨN ĐẦU RA" says whose.
 */
function prosePassages(source: HandbookSource, section: HandbookSection, lines: Line[]): HandbookPassage[] {
  const opens = section.headings ? new RegExp(section.headings, 'u') : null;
  const contextPattern = section.context ? new RegExp(section.context, 'u') : null;
  const continues = new RegExp(section.contextContinues ?? '(?!)', 'u');
  const drafts: Draft[] = [];
  const contextOf = new Map<Draft, { text: string; owner: Draft } | null>();
  let current: Draft | null = null;
  let context: { text: string; owner: Draft } | null = null;
  let headingOpen = false;
  let n = 0;
  for (const line of lines) {
    const heading = isHeading(line.text);
    const startsContext = heading && !!contextPattern?.test(line.text);
    const continuesContext = context?.owner === current && continues.test(`${context.text} | ${line.text}`);
    const starts = heading && (startsContext || !opens || opens.test(line.text));
    const merges = context?.owner === current ? continuesContext : !(startsContext || (opens && starts));
    if (heading && headingOpen && current && merges) {
      current.heading = `${current.heading} ${line.text}`;
      if (context?.owner === current) context.text = current.heading;
      current.lines.push(line);
      continue;
    }
    if (starts) {
      n++;
      current = { idPath: `p${n}`, label: '', heading: line.text, article: null, khoan: null, lines: [line] };
      if (startsContext) {
        context = { text: line.text, owner: current };
        // A two-column page can give a heading before the faculty name above it: what opened
        // earlier on the same page belongs to this context too.
        for (let i = drafts.length - 1; i >= 0 && drafts[i].lines[0]?.page === line.page && contextOf.get(drafts[i])?.owner !== drafts[i]; i--) {
          contextOf.set(drafts[i], context);
        }
      }
      contextOf.set(current, context);
      drafts.push(current);
      headingOpen = true;
      continue;
    }
    headingOpen = false;
    if (!current) {
      n++;
      current = { idPath: `p${n}`, label: '', heading: null, article: null, khoan: null, lines: [] };
      contextOf.set(current, context);
      drafts.push(current);
    }
    current.lines.push(line);
  }
  for (const draft of drafts) {
    const ctx = contextOf.get(draft);
    draft.label = [section.title, ctx && ctx.text !== draft.heading ? ctx.text : null, draft.heading].filter(Boolean).join(' – ');
  }
  return finish(source, section, drafts);
}

/** Builds the passages. Throws when the text layer is not the one the source describes. */
export function extractHandbook(source: HandbookSource, pdftotext: string): HandbookDocument {
  const pages = pdftotext.replace(/\f$/u, '').split('\f');
  if (pages.length !== source.pdf.pages) throw new Error(`the text has ${pages.length} pages, the PDF ${source.pdf.pages}`);
  const counts: Record<string, number> = {};
  const passages: HandbookPassage[] = [];
  for (const section of source.sections) {
    const lines = sectionLines(source, pages, section, counts);
    passages.push(...(section.kind === 'regulation' ? regulationPassages(source, section, lines) : prosePassages(source, section, lines)));
  }
  const seen = new Set<string>();
  for (const p of passages) {
    if (seen.has(p.id)) throw new Error(`duplicate passage id ${p.id}`);
    seen.add(p.id);
  }
  const redactions = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  return { ...source, passages, redactions };
}

/** The human-readable version; generated, so it never drifts from the JSON. */
export function renderHandbookMarkdown(document: HandbookDocument): string {
  const out: string[] = [
    `# ${document.title} (${document.shortName})`,
    `<!-- Generated from ${document.id}.json by extract-handbook. Do not edit by hand. -->`,
    [
      `- Issuer: ${document.issuer}`,
      `- Source: ${document.obtained}`,
      `- PDF: ${document.pdf.pages} pages, sha256 \`${document.pdf.sha256}\``,
      `- Text layer: \`${document.textLayer.command}\` (${document.textLayer.tool}), sha256 \`${document.textLayer.sha256}\``,
      `- Passages: ${document.passages.length}; lines removed by redaction: ${Object.entries(document.redactions)
        .map(([rule, n]) => `${rule} ${n}`)
        .join(', ')}`,
    ].join('\n'),
    '## Notes',
    [...document.notes, ...document.excluded.map((e) => `PDF pages ${e.pdfPages[0]}–${e.pdfPages[1]} are left out: ${e.reason}`)].map((n) => `- ${n}`).join('\n'),
  ];
  let section = '';
  for (const p of document.passages) {
    if (p.section.id !== section) {
      section = p.section.id;
      out.push(`## ${p.section.title}`);
    }
    out.push(`### ${p.label}\n\n\`${p.id}\` · tr. ${p.pages.join(', ')}`, p.text.split('\n').join('\n\n'));
  }
  return `${out.join('\n\n')}\n`;
}
