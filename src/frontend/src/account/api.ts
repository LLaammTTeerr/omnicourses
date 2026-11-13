import { request, send } from '../api.js';

// The account DTOs of the API (ADR 0004), written by hand; api.spec.ts checks them against src/backend/openapi.json.

export interface DeleteAccountBody {
  /** The current password, asked again before deleting. */
  password: string;
}

export interface DeletionScheduled {
  /** Signing in before this time cancels the deletion. */
  purgeAfter: string;
}

export const EXPORT_FILE_NAME = 'omnicourse-account.json';

/** Everything OmniCourse holds about the student, as the JSON file the API sends. */
export async function exportAccount(token: string): Promise<Blob> {
  return (await send('GET', '/users/me/export', { token })).blob();
}

/** Signs the student out everywhere; the account is purged after the grace period unless they sign in again. 403: wrong password. */
export const deleteAccount = (token: string, body: DeleteAccountBody) => request<DeletionScheduled>('DELETE', '/users/me', { token, body });
