import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { Term } from './term.js';

// ADR 0009: `year` is the first calendar year of the academic year; 3 is the summer term.
// Any request body that names a term nests this DTO, so every module validates terms alike.
export class TermDto implements Term {
  @ApiProperty({ example: 2026, description: 'First calendar year of the academic year: 2026 means 2026–2027.' })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ enum: [1, 2, 3], description: '1 and 2 are main terms, 3 is the summer term.' })
  @IsIn([1, 2, 3])
  number!: 1 | 2 | 3;
}
