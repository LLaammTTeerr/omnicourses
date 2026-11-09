import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { Term, TERM_NUMBERS } from './term.js';

// Any request body that names a term nests this DTO, so every module validates terms alike.
export class TermDto implements Term {
  @ApiProperty({ example: 2026, description: 'First calendar year of the academic year: 2026 means 2026–2027.' })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ enum: TERM_NUMBERS, description: 'Term of the academic year: 1, 2 or 3. Whether 3 is a main or a summer term depends on the program (APCS: main, QĐ 1175/QĐ-KHTN Điều 6.4b).' })
  @IsIn(TERM_NUMBERS)
  number!: Term['number'];
}
