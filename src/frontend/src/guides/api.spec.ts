import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { contractEnum, contractShape, type Shape } from '../testing/contract.js';
import {
  fetchGuide,
  fetchGuides,
  GUIDE_GROUPS,
  GUIDE_LANGS,
  type Guide,
  type GuideItem,
  type GuideLink,
  type GuideListItem,
  type GuideListText,
  type GuideNoteSource,
  type GuidePortal,
  type GuideText,
} from './api.js';

type RegulationSource = Extract<GuideNoteSource, { kind: 'regulation' }>;

describe('guide types against the contract', () => {
  it('lists every guide group of the contract', () => {
    expect([...GUIDE_GROUPS].sort()).toEqual(contractEnum('GuideListItemDto', 'group'));
    expect([...GUIDE_GROUPS].sort()).toEqual(contractEnum('GuideDto', 'group'));
  });

  it('keys guide texts by the languages of the contract', () => {
    const texts = Object.fromEntries(GUIDE_LANGS.map((lang) => [lang, 'optional']));
    expect(contractShape('GuideListTextsDto')).toEqual(texts);
    expect(contractShape('GuideTextsDto')).toEqual(texts);
  });

  it.each([
    ['GuideListItemDto', { id: 'required', group: 'required', texts: 'required' } satisfies Shape<GuideListItem>],
    ['GuideDto', { id: 'required', group: 'required', texts: 'required' } satisfies Shape<Guide>],
    ['GuidePortalDto', { name: 'required', url: 'required', account: 'required' } satisfies Shape<GuidePortal>],
    ['GuideLinkDto', { label: 'required', url: 'required' } satisfies Shape<GuideLink>],
    [
      'GuideListTextDto',
      { title: 'required', keywords: 'required', portal: 'required', version: 'required', lastCheckedOn: 'required', outOfDate: 'required' } satisfies Shape<GuideListText>,
    ],
    [
      'GuideTextDto',
      {
        title: 'required',
        keywords: 'required',
        portal: 'required',
        version: 'required',
        lastCheckedOn: 'required',
        outOfDate: 'required',
        changeNote: 'required',
        lastCheckedBy: 'required',
        summary: 'required',
        when: 'required',
        appliesTo: 'required',
        prepare: 'required',
        steps: 'required',
        notes: 'required',
        citations: 'required',
        ifPortalDown: 'required',
        related: 'required',
        portals: 'required',
      } satisfies Shape<GuideText>,
    ],
    ['GuideWhenDto', { text: 'required', announcement: 'optional' } satisfies Shape<GuideText['when']>],
    ['GuideItemDto', { text: 'required', link: 'optional' } satisfies Shape<GuideItem>],
    ['GuideNoteDto', { text: 'required', source: 'required' } satisfies Shape<GuideText['notes'][number]>],
    ['GuideCitationDto', { document: 'required', clause: 'required', url: 'required' } satisfies Shape<GuideText['citations'][number]>],
    ['GuideBoardPortalDto', { name: 'required', url: 'required', account: 'required', purpose: 'required' } satisfies Shape<GuideText['portals'][number]>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
  });

  it('has the note sources of the contract', () => {
    // Stricter than the contract on purpose: the backend's guide validation requires the regulation fields.
    const kinds: Record<GuideNoteSource['kind'], true> = { regulation: true, team: true };
    const regulation: Record<keyof RegulationSource, true> = { kind: true, document: true, clause: true, url: true };
    expect(Object.keys(kinds).sort()).toEqual(contractEnum('GuideNoteSourceDto', 'kind'));
    expect(Object.keys(contractShape('GuideNoteSourceDto')).sort()).toEqual(Object.keys(regulation).sort());
  });
});

describe('fetchGuides', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks for the list with no token (ADR 0010) and gives its guides', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ guides: [{ id: 'zz-a' }] }));
    await expect(fetchGuides()).resolves.toEqual([{ id: 'zz-a' }]);
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/guides`, expect.objectContaining({ method: 'GET', headers: {} }));
  });
});

describe('fetchGuide', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks for the id escaped and gives the guide', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: 'a b' }));
    await expect(fetchGuide('a b')).resolves.toEqual({ id: 'a b' });
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/guides/a%20b`, expect.objectContaining({ method: 'GET', headers: {} }));
  });

  it('gives null when no published guide has the id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
    await expect(fetchGuide('zz-missing')).resolves.toBeNull();
  });

  it('fails on any other error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    await expect(fetchGuide('zz-fresh')).rejects.toThrow('GET /guides/zz-fresh failed: 500');
  });
});
