import { NotFoundException, Param } from '@nestjs/common';
import { UuidOr404Pipe } from '../common/api-requests.js';

export const planNotFound = () => new NotFoundException('No plan with this id');

export const PlanId = () => Param('id', new UuidOr404Pipe(planNotFound));

export const PLAN_NOT_FOUND_DESCRIPTION = 'No plan with this id among the signed-in student’s plans (another student’s plan included).';
