import { describe, expect, it } from 'vitest';
import { isSecretColumn } from './account-export.js';

describe('secret columns', () => {
  // TypeORM names a column after its property unless `name` is set, so camelCase counts too.
  it.each(['password_hash', 'token_hash', 'google_sub', 'api_key', 'refresh_token', 'client_secret', 'passwordHash', 'apiKey', 'APIKey', 'Password_Hash', 'password', 'token'])(
    'drops %s',
    (column) => {
      expect(isSecretColumn(column)).toBe(true);
    },
  );

  // The documented rule is a suffix (AGENTS.md): a secret word elsewhere in the name is the student's data.
  it.each(['email', 'display_name', 'input_tokens', 'user_id', 'subject_code', 'keyboard_layout', 'key_count', 'sub_total', 'hash_algorithm', 'token_expires_at'])(
    'keeps %s',
    (column) => {
      expect(isSecretColumn(column)).toBe(false);
    },
  );
});
