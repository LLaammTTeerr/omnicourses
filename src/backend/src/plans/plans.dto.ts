import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { COURSE_CODE_PATTERN } from '../common/course-code.js';
import { MaxCodePoints, NoNullCharacter, TermDto, trimString } from '../common/field-validators.js';
import { type BoardTerm, type Placement, PLACEMENT_KINDS, type PlacementKind } from '../rules/types.js';
import { MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR } from '../terms/term.js';
import { MAX_BOARD_PLACEMENTS, MAX_BOARD_TERMS, MAX_TERM_PLACEMENTS } from './plan-board.js';

const PLAN_NAME_MAX_LENGTH = 100;
const MAX_SLOT_CREDITS = 30;

const PlanName = () =>
  applyDecorators(
    ApiProperty({ example: 'Main plan', minLength: 1, maxLength: PLAN_NAME_MAX_LENGTH }),
    Transform(trimString),
    IsString(),
    NoNullCharacter,
    MinLength(1),
    MaxCodePoints(PLAN_NAME_MAX_LENGTH),
  );

const ONLY_FOR = (kind: PlacementKind) =>
  ValidateBy({
    name: `onlyFor${kind}`,
    validator: {
      validate: (_value, args) => {
        const sent = (args?.object as PlanPlacementDto).kind;
        return sent === kind || !(PLACEMENT_KINDS as readonly unknown[]).includes(sent);
      },
      defaultMessage: (args) => `${args?.property} must be null unless kind is ${kind}`,
    },
  });
const sentFor = (kind: PlacementKind, field: keyof PlanPlacementDto) => (p: PlanPlacementDto) => p.kind === kind || (p[field] !== null && p[field] !== undefined);

export class PlanPlacementDto implements Placement {
  @ApiProperty({ enum: PLACEMENT_KINDS, description: 'course: a course of the catalog. slot: credits held for a requirement group, no course chosen yet.' })
  @IsIn(PLACEMENT_KINDS)
  kind!: PlacementKind;

  @ApiProperty({ type: String, nullable: true, required: false, example: 'CSC10001', description: 'A catalog course code, exactly as stored. Set for a course, null for a slot.' })
  @ValidateIf(sentFor('course', 'courseCode'))
  @IsString()
  @Matches(COURSE_CODE_PATTERN, { message: 'courseCode must be 2–20 capital letters or digits' })
  @ONLY_FOR('course')
  courseCode!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, required: false, description: "A requirement group of the plan's curriculum. Set for a slot, null for a course." })
  @ValidateIf(sentFor('slot', 'requirementGroupId'))
  @IsUUID()
  @ONLY_FOR('slot')
  requirementGroupId!: string | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 1, maximum: MAX_SLOT_CREDITS, example: 3, description: "The slot's credits. Null for a course, whose credits are the catalog's." })
  @ValidateIf(sentFor('slot', 'credits'))
  @IsInt()
  @Min(1)
  @Max(MAX_SLOT_CREDITS)
  @ONLY_FOR('slot')
  credits!: number | null;
}

export class PlanTermDto implements BoardTerm {
  @ApiProperty({ type: TermDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => TermDto)
  term!: TermDto;

  @ApiProperty({ type: [PlanPlacementDto], description: `In order, at most ${MAX_TERM_PLACEMENTS}. A term with nothing placed is left out.` })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TERM_PLACEMENTS)
  @ValidateNested({ each: true })
  @Type(() => PlanPlacementDto)
  placements!: PlanPlacementDto[];
}

const BoardTerms = () => applyDecorators(Type(() => PlanTermDto), ValidateNested({ each: true }), ArrayMaxSize(MAX_BOARD_TERMS), IsArray());

const BOARD_DESCRIPTION = `One entry per term, each term once, at most ${MAX_BOARD_TERMS} terms and ${MAX_BOARD_PLACEMENTS} placements in all; a course is placed once. Prerequisites, offering terms and credit caps are not checked here: the rule engine reports them as issues.`;

export class PlanBoardDto {
  @ApiProperty({ type: [PlanTermDto], description: BOARD_DESCRIPTION })
  @BoardTerms()
  terms!: PlanTermDto[];
}

export class PlanDropPreviewDto {
  @ApiProperty({ type: [PlanTermDto], description: `The board without the placement (a moved course is taken out of its term first). ${BOARD_DESCRIPTION}` })
  @BoardTerms()
  terms!: PlanTermDto[];

  @ApiProperty({ type: PlanPlacementDto, description: 'What is dropped. It is added at the end of each target term in turn.' })
  @IsDefined()
  @ValidateNested()
  @Type(() => PlanPlacementDto)
  placement!: PlanPlacementDto;

  @ApiProperty({ type: [TermDto], description: `The terms to try it in, each once, at most ${MAX_BOARD_TERMS}.` })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BOARD_TERMS)
  @ValidateNested({ each: true })
  @Type(() => TermDto)
  targets!: TermDto[];
}

export class CreatePlanDto {
  @PlanName()
  name!: string;

  @ApiProperty({ example: 'APCS', description: 'The program of the curriculum the plan is made against.' })
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(50)
  programCode!: string;

  @ApiProperty({ example: 2024, description: 'The cohort of that curriculum.' })
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  cohortYear!: number;

  @ApiProperty({ type: [PlanTermDto], required: false, description: `${BOARD_DESCRIPTION} Left out: an empty plan.` })
  @IsOptional()
  @BoardTerms()
  terms?: PlanTermDto[];
}

export class RenamePlanDto {
  @PlanName()
  name!: string;
}

export class DuplicatePlanDto {
  @ApiProperty({ required: false, example: 'Lighter load', minLength: 1, maxLength: PLAN_NAME_MAX_LENGTH, description: "The copy's name. Left out: the original's name; the UI words any \"copy of\"." })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @NoNullCharacter
  @MinLength(1)
  @MaxCodePoints(PLAN_NAME_MAX_LENGTH)
  name?: string;
}

export class PlanCurriculumDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'APCS2024' })
  code!: string;

  @ApiProperty({ example: 'APCS' })
  programCode!: string;

  @ApiProperty({ example: 2024 })
  cohortYear!: number;
}

export class PlanSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Main plan' })
  name!: string;

  @ApiProperty({ type: PlanCurriculumDto, description: 'The curriculum the plan is made against; it stays the same when the student changes program or cohort.' })
  curriculum!: PlanCurriculumDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last rename or change of placements.' })
  updatedAt!: Date;
}

export class PlanDto extends PlanSummaryDto {
  @ApiProperty({ type: [PlanTermDto], description: 'Terms oldest first, placements in order. A body to PUT back as it is.' })
  terms!: PlanTermDto[];
}

export class PlanPreviewDto {
  @ApiProperty({ description: 'Terms with at least one placement.' })
  termCount!: number;

  @ApiProperty({ description: 'Placements of a course.' })
  courseCount!: number;

  @ApiProperty({ description: 'Placements of an elective slot (a course of a group, not chosen yet).' })
  slotCount!: number;

  @ApiProperty({ type: TermDto, nullable: true, description: 'The earliest term with a placement; null for an empty plan.' })
  firstTerm!: TermDto | null;

  @ApiProperty({ type: TermDto, nullable: true, description: 'The latest term with a placement; null for an empty plan.' })
  lastTerm!: TermDto | null;
}

export class PlanListItemDto extends PlanSummaryDto {
  @ApiProperty({ type: PlanPreviewDto })
  preview!: PlanPreviewDto;
}

export class PlanListDto {
  @ApiProperty({ type: [PlanListItemDto], description: 'Oldest first.' })
  plans!: PlanListItemDto[];
}
