import { request, send } from '../api.js';
import type { DeleteAccountDto, DeletionScheduledDto } from '../api-schema/types.gen.js';

// The account DTOs of the API (ADR 0004), generated from the contract (ADR 0018).

/** The current password, asked again before deleting. */
export type DeleteAccountBody = DeleteAccountDto;
export type DeletionScheduled = DeletionScheduledDto;

export const EXPORT_FILE_NAME = 'omnicourse-account.json';

/** Everything OmniCourse holds about the student, as the JSON file the API sends. */
export async function exportAccount(token: string): Promise<Blob> {
  return (await send('GET', '/users/me/export', { token })).blob();
}

/** Signs the student out everywhere; the account is purged after the grace period unless they sign in again. 403: wrong password. */
export const deleteAccount = (token: string, body: DeleteAccountBody) => request<DeletionScheduled>('DELETE', '/users/me', { token, body });
