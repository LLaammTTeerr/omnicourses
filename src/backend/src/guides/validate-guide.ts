import { isCalendarDate } from '../common/field-validators.js';
import { type GuideCitation, GUIDE_GROUPS, GUIDE_ID, GUIDE_ID_MAX, GUIDE_LANGS, GUIDE_STATUSES, type GuideFile, type GuideLink, textKey } from './guide-file.js';

export type LoadableGuideFile =
  | (GuideFile & { status: 'draft' })
  | (GuideFile & { status: 'withdrawn' })
  | (GuideFile & { status: 'published'; lastChecked: NonNullable<GuideFile['lastChecked']> });

const CREDIT_NUMBER = /\d\s*(?:tín chỉ|tc\b|credits?\b)/iu;
const TYPED_DATE = /\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b/u;

const HTTPS_URL = /^https:\/\/\S+$/;
const APP_PATH = /^\/(?![/\\])[^\s\\]*$/;
const isSafeUrl = (url: string) => HTTPS_URL.test(url) || APP_PATH.test(url);
const oneOf = (values: readonly string[]) => `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`;

export function validateGuideFile(file: GuideFile): string[] {
  const problems = [...identityProblems(file), ...linkProblems(file)];
  if (file.status === 'published') problems.push(...publishedProblems(file), ...proseProblems(file));
  return problems.map((problem) => `${textKey(file)}: ${problem}`);
}

function identityProblems(file: GuideFile): string[] {
  return [
    ...(!GUIDE_ID.test(file.id) || file.id.length > GUIDE_ID_MAX ? [`id must be lower-case words joined by hyphens, at most ${GUIDE_ID_MAX} characters`] : []),
    ...(GUIDE_LANGS.includes(file.lang) ? [] : [`lang must be ${oneOf(GUIDE_LANGS)}`]),
    ...(GUIDE_STATUSES.includes(file.status) ? [] : [`status must be ${oneOf(GUIDE_STATUSES)}`]),
    ...(GUIDE_GROUPS.includes(file.group) ? [] : [`group must be one of ${GUIDE_GROUPS.join(', ')}`]),
    ...(Number.isInteger(file.version) && file.version >= 1 ? [] : ['version must be a whole number from 1']),
  ];
}

function linkProblems(file: GuideFile): string[] {
  return [
    ...linksOf(file)
      .filter(([, link]) => link.url && !isSafeUrl(link.url))
      .map(([field]) => `${field}.url must be an https address or an OmniCourse path starting with /`),
    ...siteUrlsOf(file)
      .filter(([, url]) => url && !HTTPS_URL.test(url))
      .map(([field]) => `${field} must be an https address`),
  ];
}

const missing = ([field, value]: [string, string]): string[] => (value.trim() ? [] : [`${field} is required`]);

function publishedProblems(file: GuideFile): string[] {
  const shown: [string, string][] = [
    ['title', file.title],
    ['summary', file.summary],
    ['when.text', file.when.text],
    ['appliesTo', file.appliesTo],
    ['portal.name', file.portal.name],
    ['portal.url', file.portal.url],
    ['portal.account', file.portal.account],
  ];
  return [
    ...missing(['changeNote', file.changeNote]),
    ...lastCheckedProblems(file.lastChecked),
    ...shown.flatMap(missing),
    ...(!file.keywords.length || file.keywords.some((k) => !k.trim()) ? ['keywords needs at least one word, and no empty ones'] : []),
    ...(file.steps.length ? [] : ['steps needs at least one step']),
    ...listedTexts(file).flatMap(missing),
  ];
}

function lastCheckedProblems(lastChecked: GuideFile['lastChecked']): string[] {
  if (!lastChecked) return ['lastChecked is required: the date and the name of whoever followed the guide on the portal'];
  return [...(isCalendarDate(lastChecked.on) ? [] : ['lastChecked.on must be a date written YYYY-MM-DD']), ...missing(['lastChecked.by', lastChecked.by])];
}

function listedTexts(file: GuideFile): [string, string][] {
  return [
    ...file.steps.map((step, i): [string, string] => [`steps[${i}].text`, step.text]),
    ...(file.prepare ?? []).map((preparation, i): [string, string] => [`prepare[${i}].text`, preparation.text]),
    ...(file.notes ?? []).flatMap((note, i): [string, string][] => [
      [`notes[${i}].text`, note.text],
      ...(note.source.kind === 'regulation' ? citationTexts(`notes[${i}].source`, note.source) : []),
    ]),
    ...(file.citations ?? []).flatMap((citation, i) => citationTexts(`citations[${i}]`, citation)),
    ...(file.portals ?? []).flatMap((portal, i): [string, string][] => [
      [`portals[${i}].name`, portal.name],
      [`portals[${i}].url`, portal.url],
      [`portals[${i}].account`, portal.account],
      [`portals[${i}].purpose`, portal.purpose],
    ]),
    ...linksOf(file).flatMap(([field, link]): [string, string][] => [
      [`${field}.label`, link.label],
      [`${field}.url`, link.url],
    ]),
  ];
}

const citationTexts = (field: string, citation: GuideCitation): [string, string][] => [
  [`${field}.document`, citation.document],
  [`${field}.clause`, citation.clause],
  [`${field}.url`, citation.url],
];

function proseProblems(file: GuideFile): string[] {
  return proseOf(file).flatMap(([field, text]) => [
    ...(CREDIT_NUMBER.test(text) ? [`${field} types a credit number; cite the clause instead (AGENTS.md hard rule 1)`] : []),
    ...(TYPED_DATE.test(text) ? [`${field} types a date; link the school's announcement instead (guides plan §3 rule 4)`] : []),
  ]);
}

export function validateGuideSet(files: GuideFile[]): string[] {
  const problems = files.flatMap(validateGuideFile);
  const byKey = new Map<string, GuideFile>();
  for (const file of files) {
    const key = textKey(file);
    if (byKey.has(key)) problems.push(`${key}: two files have this id and language`);
    byKey.set(key, file);
  }
  for (const vi of files.filter((f) => f.lang === 'vi')) {
    const en = byKey.get(textKey({ id: vi.id, lang: 'en' }));
    if (!en) continue;
    if (en.group !== vi.group) problems.push(`${vi.id}: the vi and en files must have the same group`);
    if (vi.status === 'published' && en.status === 'published' && vi.portal.url !== en.portal.url) {
      problems.push(`${vi.id}: the vi and en files must link the same portal.url`);
    }
  }
  return [...problems, ...portalsMissingFromBoard(files)];
}

export function parseGuideSet(files: GuideFile[]): { files: LoadableGuideFile[] } | { problems: string[] } {
  const problems = validateGuideSet(files);
  return problems.length ? { problems } : { files: files as LoadableGuideFile[] };
}

export function portalsMissingFromBoard(files: GuideFile[]): string[] {
  const published = files.filter((f) => f.status === 'published');
  const hosts = new Set(published.flatMap((f) => f.portals ?? []).map((p) => new URL(p.url).host));
  if (!hosts.size) return [];
  return published
    .filter((f) => !f.portals && !hosts.has(new URL(f.portal.url).host))
    .map((f) => `${textKey(f)}: ${new URL(f.portal.url).host} is not on the portal board`);
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

function siteUrlsOf(file: GuideFile): [string, string][] {
  return [
    ['portal.url', file.portal.url],
    ...(file.portals ?? []).map((p, i): [string, string] => [`portals[${i}].url`, p.url]),
    ...(file.notes ?? []).flatMap((n, i): [string, string][] => (n.source.kind === 'regulation' ? [[`notes[${i}].source.url`, n.source.url]] : [])),
    ...(file.citations ?? []).map((c, i): [string, string] => [`citations[${i}].url`, c.url]),
  ];
}

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
    ...(file.portals ?? []).flatMap((portal, i): [string, string][] => [
      [`portals[${i}].purpose`, portal.purpose],
      [`portals[${i}].account`, portal.account],
    ]),
    ...linksOf(file).map(([field, link]): [string, string] => [`${field}.label`, link.label]),
  ];
}
