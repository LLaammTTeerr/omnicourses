import { buildMessage, ValidateBy } from 'class-validator';

// PostgreSQL refuses U+0000 in any text value and counts a varchar's length in code points. A
// text field of a request checks both, so a value the route accepts never makes the query fail
// with a 500 (issue #163).

/**
 * A text column's length as PostgreSQL counts it: in code points. Use it instead of MaxLength:
 * class-validator's MaxLength does not count a variation selector (U+FE0E, U+FE0F) after a
 * character, so a value it accepts could still be too long for varchar(n), and the insert would
 * fail with a 500. Same words as MaxLength's refusal.
 */
export const MaxCodePoints = (max: number) =>
  ValidateBy({
    name: 'maxCodePoints',
    constraints: [max],
    validator: {
      validate: (value: unknown) => typeof value === 'string' && [...value].length <= max,
      defaultMessage: buildMessage((each) => `${each}$property must be shorter than or equal to $constraint1 characters`),
    },
  });

/** PostgreSQL refuses U+0000 in any text value, with a 500 if it got that far. */
export const NoNullCharacter = ValidateBy({
  name: 'noNullCharacter',
  validator: {
    validate: (value: unknown) => typeof value === 'string' && !value.includes('\u0000'),
    defaultMessage: buildMessage((each) => `${each}$property must not contain a null character (U+0000)`),
  },
});
