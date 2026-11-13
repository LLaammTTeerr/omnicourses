import { describe, expect, it } from 'vitest';
import contract from '../../../backend/openapi.json';
import { GOAL_YEARS_AHEAD } from '../terms.js';
import { contractShape, type Shape } from '../testing/contract.js';
import { NO_INTERNSHIP, type Onboarding } from './api.js';

const onboardingDto = contract.components.schemas.OnboardingDto;

describe('onboarding types against the contract (UC-01)', () => {
  it('has the fields of OnboardingDto, every one required: PUT replaces them all', () => {
    expect(contractShape('OnboardingDto')).toEqual({
      program: 'required',
      cohort: 'required',
      targetGraduationTerm: 'required',
      creditsPerTerm: 'required',
      internshipTerm: 'required',
      finished: 'required',
    } satisfies Shape<Onboarding>);
  });

  it('asks credits per term as the API checks them: 1 or more, no upper limit', () => {
    expect(onboardingDto.properties.creditsPerTerm).toMatchObject({ minimum: 1 });
    expect(onboardingDto.properties.creditsPerTerm).not.toHaveProperty('maximum');
  });

  it('knows the "none planned" internship and the goal window', () => {
    expect(JSON.stringify(onboardingDto.properties.internshipTerm)).toContain(`"enum":["${NO_INTERNSHIP}"]`);
    expect(onboardingDto.properties.targetGraduationTerm.description).toContain(`up to ${GOAL_YEARS_AHEAD} academic years ahead`);
  });
});
