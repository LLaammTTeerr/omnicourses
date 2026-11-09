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
  MaxLength,
  Min,
  MinLength,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { COURSE_CODE_PATTERN } from '../common/course-code.js';
import { trimString } from '../common/transforms.js';
import { TermDto } from '../terms/term.dto.js';
import { BoardTerm, MAX_BOARD_PLACEMENTS, MAX_BOARD_TERMS, MAX_TERM_PLACEMENTS, Placement, PLACEMENT_KINDS, PlacementKind } from './plan-board.js';

const PlanName = () =>
  applyDecorators(
    ApiProperty({ example: 'Main plan', minLength: 1, maxLength: 100 }),
    Transform(trimString),
    IsString(),
    MinLength(1),
    MaxLength(100),
  );

// A field of one kind of placement: checked when that kind is sent or the field is set, and
// refused when set on the other kind. An unknown kind is the kind's error alone.
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

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 1, maximum: 30, example: 3, description: "The slot's credits. Null for a course, whose credits are the catalog's." })
  @ValidateIf(sentFor('slot', 'credits'))
  @IsInt()
  @Min(1)
  @Max(30)
  @ONLY_FOR('slot')
  credits!: number | null;
}

export class PlanTermDto implements BoardTerm {
  // @ValidateNested() alone lets a missing term through.
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

const BOARD_DESCRIPTION = `One entry per term, each term once, at most ${MAX_BOARD_TERMS} terms and ${MAX_BOARD_PLACEMENTS} placements in all; a course is placed once. Prerequisites, offering terms and credit caps are not checked here: the rule engine reports them as issues.`;

export class PlanBoardDto {
  @ApiProperty({ type: [PlanTermDto], description: BOARD_DESCRIPTION })
  @IsArray()
  @ArrayMaxSize(MAX_BOARD_TERMS)
  @ValidateNested({ each: true })
  @Type(() => PlanTermDto)
  terms!: PlanTermDto[];
}

export class CreatePlanDto {
  @PlanName()
  name!: string;

  @ApiProperty({ example: 'APCS', description: 'The program of the curriculum the plan is made against.' })
  @IsString()
  @MaxLength(50)
  programCode!: string;

  @ApiProperty({ example: 2024, description: 'The cohort of that curriculum.' })
  @IsInt()
  @Min(2000)
  @Max(2100)
  cohortYear!: number;

  // A generated plan (UC-07 step 10) is saved with its placements in one request.
  @ApiProperty({ type: [PlanTermDto], required: false, description: `${BOARD_DESCRIPTION} Left out: an empty plan.` })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BOARD_TERMS)
  @ValidateNested({ each: true })
  @Type(() => PlanTermDto)
  terms?: PlanTermDto[];
}

export class RenamePlanDto {
  @PlanName()
  name!: string;
}

export class DuplicatePlanDto {
  @ApiProperty({ required: false, example: 'Lighter load', minLength: 1, maxLength: 100, description: "The copy's name. Left out: the original's name; the UI words any \"copy of\"." })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
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

export class PlanListDto {
  @ApiProperty({ type: [PlanSummaryDto], description: 'Oldest first.' })
  plans!: PlanSummaryDto[];
}
