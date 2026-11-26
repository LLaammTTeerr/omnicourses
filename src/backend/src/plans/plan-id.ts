import { NotFoundException, Param } from '@nestjs/common';
import { UuidOr404Pipe } from '../common/api-requests.js';

/** The answer for a plan that is missing or someone else's: the same, so it reveals nothing. */
export const planNotFound = () => new NotFoundException('No plan with this id');

/** A malformed id is a 404 like any unknown plan: a 400 or a 500 would tell ids apart. */
export const PlanId = () => Param('id', new UuidOr404Pipe(planNotFound));

export const PLAN_NOT_FOUND_DESCRIPTION = 'No plan with this id among the signed-in student’s plans (another student’s plan included).';
