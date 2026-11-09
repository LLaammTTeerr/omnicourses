import { ApiProperty } from '@nestjs/swagger';
import { GUIDE_GROUPS, type GuideGroup } from './guide-file.js';
import { OUT_OF_DATE_MONTHS } from './out-of-date.js';

export class GuideLinkDto {
  @ApiProperty({ example: 'Thông báo của Phòng Đào tạo' })
  label!: string;

  @ApiProperty({ example: 'https://pdt.hcmus.edu.vn', description: 'An https address, or an OmniCourse path starting with /' })
  url!: string;
}

export class GuidePortalDto {
  @ApiProperty({ example: 'Cổng thông tin sinh viên' })
  name!: string;

  @ApiProperty({ example: 'https://portal.hcmus.edu.vn', description: 'The direct link: the deepest page the school allows' })
  url!: string;

  @ApiProperty({ example: 'Tài khoản sinh viên', description: 'The account that signs in to the portal' })
  account!: string;
}

export class GuideWhenDto {
  @ApiProperty()
  text!: string;

  @ApiProperty({ type: GuideLinkDto, required: false, description: "The school's announcement with this term's dates" })
  announcement?: GuideLinkDto;
}

export class GuideItemDto {
  @ApiProperty()
  text!: string;

  @ApiProperty({ type: GuideLinkDto, required: false })
  link?: GuideLinkDto;
}

export class GuideNoteSourceDto {
  @ApiProperty({ enum: ['regulation', 'team'], description: "regulation: a clause, with document, clause and url. team: the team's experience." })
  kind!: 'regulation' | 'team';

  @ApiProperty({ required: false })
  document?: string;

  @ApiProperty({ required: false })
  clause?: string;

  @ApiProperty({ required: false })
  url?: string;
}

export class GuideNoteDto {
  @ApiProperty()
  text!: string;

  @ApiProperty({ type: GuideNoteSourceDto })
  source!: GuideNoteSourceDto;
}

export class GuideCitationDto {
  @ApiProperty()
  document!: string;

  @ApiProperty({ example: 'Điều 7' })
  clause!: string;

  @ApiProperty()
  url!: string;
}

export class GuideBoardPortalDto extends GuidePortalDto {
  @ApiProperty({ description: 'What the student does on this site' })
  purpose!: string;
}

/** A guide in one language, as the guides list shows it. */
export class GuideListTextDto {
  @ApiProperty({ example: 'Đăng ký học phần' })
  title!: string;

  @ApiProperty({ type: [String], description: 'Words the search matches besides the title' })
  keywords!: string[];

  @ApiProperty({ type: GuidePortalDto })
  portal!: GuidePortalDto;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ format: 'date', example: '2026-11-10', description: 'The day a team member last followed the guide on the real portal' })
  lastCheckedOn!: string;

  @ApiProperty({ description: `Last checked more than ${OUT_OF_DATE_MONTHS} months ago, counted in Vietnam dates (UC-10 A5)` })
  outOfDate!: boolean;
}

export class GuideListTextsDto {
  @ApiProperty({ type: GuideListTextDto, required: false })
  vi?: GuideListTextDto;

  @ApiProperty({ type: GuideListTextDto, required: false })
  en?: GuideListTextDto;
}

export class GuideListItemDto {
  @ApiProperty({ example: 'register-courses' })
  id!: string;

  @ApiProperty({ enum: GUIDE_GROUPS })
  group!: GuideGroup;

  @ApiProperty({ type: GuideListTextsDto, description: 'Only the languages the guide is published in (UC-10 A8)' })
  texts!: GuideListTextsDto;
}

export class GuideListDto {
  @ApiProperty({ type: [GuideListItemDto] })
  guides!: GuideListItemDto[];
}

/** A whole guide in one language (UC-10 step 5). */
export class GuideTextDto extends GuideListTextDto {
  @ApiProperty()
  changeNote!: string;

  @ApiProperty()
  lastCheckedBy!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: GuideWhenDto })
  when!: GuideWhenDto;

  @ApiProperty()
  appliesTo!: string;

  @ApiProperty({ type: [GuideItemDto] })
  prepare!: GuideItemDto[];

  @ApiProperty({ type: [GuideItemDto] })
  steps!: GuideItemDto[];

  @ApiProperty({ type: [GuideNoteDto] })
  notes!: GuideNoteDto[];

  @ApiProperty({ type: [GuideCitationDto] })
  citations!: GuideCitationDto[];

  @ApiProperty({ type: String, nullable: true })
  ifPortalDown!: string | null;

  @ApiProperty({ type: [GuideLinkDto] })
  related!: GuideLinkDto[];

  @ApiProperty({ type: [GuideBoardPortalDto], description: 'G01 only: every portal the other guides use' })
  portals!: GuideBoardPortalDto[];
}

export class GuideTextsDto {
  @ApiProperty({ type: GuideTextDto, required: false })
  vi?: GuideTextDto;

  @ApiProperty({ type: GuideTextDto, required: false })
  en?: GuideTextDto;
}

export class GuideDto {
  @ApiProperty({ example: 'register-courses' })
  id!: string;

  @ApiProperty({ enum: GUIDE_GROUPS })
  group!: GuideGroup;

  @ApiProperty({ type: GuideTextsDto, description: 'Only the languages the guide is published in (UC-10 A8)' })
  texts!: GuideTextsDto;
}
