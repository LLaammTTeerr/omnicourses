import { ApiProperty } from '@nestjs/swagger';
import type { CreditCaps } from './credit-caps.js';

// The credit caps of a term (ADR 0012) in a response. The degree audit and the plan issues both
// return them, so the DTO sits with the rule it implements, as TermDto sits with Term.
export class CreditCapsDto implements CreditCaps {
  @ApiProperty({ type: Number, nullable: true })
  min!: number | null;

  @ApiProperty()
  max!: number;
}
