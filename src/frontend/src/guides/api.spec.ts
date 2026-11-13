import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import type { GuideDto, GuideNoteSourceDto, GuideTextDto } from '../api-schema/types.gen.js';
import { contractEnum, contractShape } from '../testing/contract.js';
import { fetchGuide, GUIDE_GROUPS, GUIDE_LANGS, type Guide, type GuideNoteSource, type GuideText } from './api.js';

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

  it('narrows a note source, a text and a guide only within what the contract allows', () => {
    expectTypeOf<GuideNoteSource>().toExtend<GuideNoteSourceDto>();
    expectTypeOf<GuideText>().toExtend<GuideTextDto>();
    expectTypeOf<Guide>().toExtend<GuideDto>();
  });

  it('has the note sources of the contract', () => {
    // Stricter than the contract on purpose: the backend's guide validation requires the regulation fields.
    const kinds: Record<GuideNoteSource['kind'], true> = { regulation: true, team: true };
    const regulation: Record<keyof RegulationSource, true> = { kind: true, document: true, clause: true, url: true };
    expect(Object.keys(kinds).sort()).toEqual(contractEnum('GuideNoteSourceDto', 'kind'));
    expect(Object.keys(contractShape('GuideNoteSourceDto')).sort()).toEqual(Object.keys(regulation).sort());
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
