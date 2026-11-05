import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuideText } from './guide-text.entity.js';
import { GuideDto, GuideListItemDto, GuideListTextDto, GuideTextDto } from './guides.dto.js';
import { isOutOfDate, vietnamDate } from './out-of-date.js';
import { GUIDE_ID, GUIDE_ID_MAX } from './validate-guide.js';

/** The clock the out-of-date rule reads; tests replace it. */
export const GUIDES_CLOCK = Symbol('GUIDES_CLOCK');

// Reads the published guides. Nothing here writes: only the seed does (ADR 0010).
@Injectable()
export class GuidesService {
  constructor(
    @InjectRepository(GuideText) private readonly texts: Repository<GuideText>,
    @Inject(GUIDES_CLOCK) private readonly now: () => Date,
  ) {}

  /** Every published guide, by ID, with its list entry in each language it is published in. */
  async list(): Promise<GuideListItemDto[]> {
    const today = vietnamDate(this.now());
    const rows = await this.texts.find({ where: { status: 'published' }, relations: { guide: true }, order: { guideId: 'ASC', lang: 'ASC' } });
    const guides = new Map<string, GuideListItemDto>();
    for (const row of rows) {
      const item: GuideListItemDto = guides.get(row.guideId) ?? { id: row.guideId, group: row.guide.group, texts: {} };
      item.texts[row.lang] = listText(row, today);
      guides.set(row.guideId, item);
    }
    return [...guides.values()];
  }

  /** One published guide in each language it is published in. An unknown, draft or withdrawn guide is the same 404. */
  async get(id: string): Promise<GuideDto> {
    const rows =
      id.length <= GUIDE_ID_MAX && GUIDE_ID.test(id)
        ? await this.texts.find({ where: { guideId: id, status: 'published' }, relations: { guide: true }, order: { lang: 'ASC' } })
        : [];
    if (!rows.length) throw new NotFoundException('Guide not found');
    const today = vietnamDate(this.now());
    return { id, group: rows[0].guide.group, texts: Object.fromEntries(rows.map((row) => [row.lang, fullText(row, today)])) };
  }
}

function listText(row: GuideText, today: string): GuideListTextDto {
  return {
    title: row.title,
    keywords: row.keywords,
    portal: row.content.portal,
    version: row.version,
    lastCheckedOn: row.lastCheckedOn,
    outOfDate: isOutOfDate(row.lastCheckedOn, today),
  };
}

function fullText(row: GuideText, today: string): GuideTextDto {
  const content = row.content;
  return {
    ...listText(row, today),
    changeNote: row.changeNote,
    lastCheckedBy: row.lastCheckedBy,
    summary: content.summary,
    when: content.when,
    appliesTo: content.appliesTo,
    prepare: content.prepare ?? [],
    steps: content.steps,
    notes: content.notes ?? [],
    citations: content.citations ?? [],
    ifPortalDown: content.ifPortalDown ?? null,
    related: content.related ?? [],
    portals: content.portals ?? [],
  };
}
