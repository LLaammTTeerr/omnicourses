import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { COURSE_CODE_PATTERN, canonicalForm } from './course-code.js';

export interface CourseCodeFieldOptions {
  /** Trim and upper-case a typed or transcribed code before it is checked (canonicalCourseCode's form); off where a code must already be exact. */
  canonicalize?: boolean;
  /** The 400 message when the code does not match: each route words its own. */
  message: string;
}

/**
 * A course-code body field (ADR 0007): a string matching COURSE_CODE_PATTERN. The validators are
 * listed in the order a stacked `@IsString() @Matches()` registers them, so the 400's messages keep
 * their order.
 */
export const CourseCodeField = ({ canonicalize = false, message }: CourseCodeFieldOptions): PropertyDecorator =>
  applyDecorators(
    Matches(COURSE_CODE_PATTERN, { message }),
    IsString(),
    ...(canonicalize ? [Transform(({ value }) => (typeof value === 'string' ? canonicalForm(value) : value))] : []),
  );
