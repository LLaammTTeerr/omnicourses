import { GUIDE_GROUPS, GUIDE_LANGS, GUIDE_STATUSES, type GuideFile, type GuideLink } from './guide-file.js';

/** A guide ID: lower-case words joined by hyphens, such as `register-courses`. */
export const GUIDE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const GUIDE_ID_MAX = 64;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// AGENTS.md hard rule 1: a guide never types a credit count ("25 credits", "14–25 TC", "20 tín chỉ").
const CREDIT_NUMBER = /\d\s*(?:tín chỉ|tc\b|credits?\b)/iu;
// Guides plan §3 rule 4: a date that changes every term is linked, never typed ("15/11", "2026-11-15").
const TYPED_DATE = /\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b/u;

const isSafeUrl = (url: string) => /^https:\/\/\S+$/.test(url) || /^\/(?!\/)\S*$/.test(url);
const isRealDate = (date: string) =>
  ISO_DATE.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);

/** The problems with one content file; empty when the seed may load it. A draft only needs its identity and safe links. */
export function validateGuideFile(file: GuideFile): string[] {
  const problems: string[] = [];
  const problem = (message: string) => problems.push(`${file.id}.${file.lang}: ${message}`);
  const required = (field: string, value: string) => {
    if (!value.trim()) problem(`${field} is required`);
  };

  if (!GUIDE_ID.test(file.id) || file.id.length > GUIDE_ID_MAX) {
    problem(`id must be lower-case words joined by hyphens, at most ${GUIDE_ID_MAX} characters`);
  }
  if (!GUIDE_LANGS.includes(file.lang)) problem('lang must be vi or en');
  if (!GUIDE_STATUSES.includes(file.status)) problem('status must be draft, published or withdrawn');
  if (!GUIDE_GROUPS.includes(file.group)) problem(`group must be one of ${GUIDE_GROUPS.join(', ')}`);
  if (!Number.isInteger(file.version) || file.version < 1) problem('version must be a whole number from 1');
  for (const [field, url] of urlsOf(file)) {
    if (url && !isSafeUrl(url)) problem(`${field} must be an https address or an OmniCourse path starting with /`);
  }
  for (const [field, url] of [['portal.url', file.portal.url], ...(file.portals ?? []).map((p, i) => [`portals[${i}].url`, p.url])]) {
    if (url && !url.startsWith('https://')) problem(`${field} must be an https address`);
  }

  if (file.status !== 'published') return problems;

  required('changeNote', file.changeNote);
  if (!file.lastChecked) {
    problem('lastChecked is required: the date and the name of whoever followed the guide on the portal');
  } else {
    if (!isRealDate(file.lastChecked.on)) problem('lastChecked.on must be a date written YYYY-MM-DD');
    required('lastChecked.by', file.lastChecked.by);
  }
  required('title', file.title);
  required('summary', file.summary);
  required('when.text', file.when.text);
  required('appliesTo', file.appliesTo);
  required('portal.name', file.portal.name);
  required('portal.url', file.portal.url);
  required('portal.account', file.portal.account);
  if (!file.keywords.length || file.keywords.some((k) => !k.trim())) problem('keywords needs at least one word, and no empty ones');
  if (!file.steps.length) problem('steps needs at least one step');
  file.steps.forEach((s, i) => required(`steps[${i}].text`, s.text));
  file.prepare?.forEach((p, i) => required(`prepare[${i}].text`, p.text));
  file.notes?.forEach((n, i) => {
    required(`notes[${i}].text`, n.text);
    if (n.source.kind === 'regulation') {
      required(`notes[${i}].source.document`, n.source.document);
      required(`notes[${i}].source.clause`, n.source.clause);
      required(`notes[${i}].source.url`, n.source.url);
    }
  });
  file.citations?.forEach((c, i) => {
    required(`citations[${i}].document`, c.document);
    required(`citations[${i}].clause`, c.clause);
    required(`citations[${i}].url`, c.url);
  });
  file.portals?.forEach((p, i) => {
    required(`portals[${i}].name`, p.name);
    required(`portals[${i}].url`, p.url);
    required(`portals[${i}].account`, p.account);
    required(`portals[${i}].purpose`, p.purpose);
  });
  for (const [field, link] of linksOf(file)) {
    required(`${field}.label`, link.label);
    required(`${field}.url`, link.url);
  }
  for (const [field, text] of proseOf(file)) {
    if (CREDIT_NUMBER.test(text)) problem(`${field} types a credit number; cite the clause instead (AGENTS.md hard rule 1)`);
    if (TYPED_DATE.test(text)) problem(`${field} types a date; link the school's announcement instead (guides plan §3 rule 4)`);
  }
  return problems;
}

/** The problems with a set of content files the seed loads together. */
export function validateGuideSet(files: GuideFile[]): string[] {
  const problems = files.flatMap(validateGuideFile);
  const byKey = new Map<string, GuideFile>();
  for (const file of files) {
    const key = `${file.id}.${file.lang}`;
    if (byKey.has(key)) problems.push(`${key}: two files have this id and language`);
    byKey.set(key, file);
  }
  for (const vi of files.filter((f) => f.lang === 'vi')) {
    const en = byKey.get(`${vi.id}.en`);
    if (!en) continue;
    if (en.group !== vi.group) problems.push(`${vi.id}: the vi and en files must have the same group`);
    if (vi.status === 'published' && en.status === 'published' && vi.portal.url !== en.portal.url) {
      problems.push(`${vi.id}: the vi and en files must link the same portal.url`);
    }
  }
  return problems;
}

/** Published guides whose portal is not on a published portal board (G01): every guide sends the student to a site the board lists. */
export function portalsMissingFromBoard(files: GuideFile[]): string[] {
  const published = files.filter((f) => f.status === 'published');
  const hosts = new Set(published.flatMap((f) => f.portals ?? []).map((p) => new URL(p.url).host));
  if (!hosts.size) return [];
  return published
    .filter((f) => !f.portals && !hosts.has(new URL(f.portal.url).host))
    .map((f) => `${f.id}.${f.lang}: ${new URL(f.portal.url).host} is not on the portal board`);
}

function linksOf(file: GuideFile): [string, GuideLink][] {
  const links: [string, GuideLink | undefined][] = [
    ['when.announcement', file.when.announcement],
    ...(file.prepare ?? []).map((p, i): [string, GuideLink | undefined] => [`prepare[${i}].link`, p.link]),
    ...file.steps.map((s, i): [string, GuideLink | undefined] => [`steps[${i}].link`, s.link]),
    ...(file.related ?? []).map((l, i): [string, GuideLink] => [`related[${i}]`, l]),
  ];
  return links.filter((entry): entry is [string, GuideLink] => entry[1] !== undefined);
}

function urlsOf(file: GuideFile): [string, string][] {
  return [
    ...linksOf(file).map(([field, link]): [string, string] => [`${field}.url`, link.url]),
    ...(file.notes ?? []).flatMap((n, i): [string, string][] => (n.source.kind === 'regulation' ? [[`notes[${i}].source.url`, n.source.url]] : [])),
    ...(file.citations ?? []).map((c, i): [string, string] => [`citations[${i}].url`, c.url]),
  ];
}

// The text a reader sees, checked for typed rule values and dates. Citations and the change note are not.
function proseOf(file: GuideFile): [string, string][] {
  return [
    ['title', file.title],
    ['summary', file.summary],
    ['when.text', file.when.text],
    ['appliesTo', file.appliesTo],
    ['portal.account', file.portal.account],
    ...file.keywords.map((k, i): [string, string] => [`keywords[${i}]`, k]),
    ...(file.prepare ?? []).map((p, i): [string, string] => [`prepare[${i}].text`, p.text]),
    ...file.steps.map((s, i): [string, string] => [`steps[${i}].text`, s.text]),
    ...(file.notes ?? []).map((n, i): [string, string] => [`notes[${i}].text`, n.text]),
    ...(file.ifPortalDown ? [['ifPortalDown', file.ifPortalDown] as [string, string]] : []),
    ...(file.portals ?? []).flatMap((p, i): [string, string][] => [
      [`portals[${i}].purpose`, p.purpose],
      [`portals[${i}].account`, p.account],
    ]),
    ...linksOf(file).map(([field, link]): [string, string] => [`${field}.label`, link.label]),
  ];
}
