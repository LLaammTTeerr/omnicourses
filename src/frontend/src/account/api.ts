import { segment } from '../api.js';
import type { Session } from '../auth/api.js';
import { requestAsUser, sendAsUser } from '../auth/store.js';

// The account DTOs of the API (ADR 0004), written by hand; api.spec.ts checks them against src/backend/openapi.json.

export interface DeleteAccountBody {
  /** The current password, asked again before deleting. */
  password: string;
}

export interface DeletionScheduled {
  /** Signing in before this time cancels the deletion. */
  purgeAfter: string;
}

export const listSessions = () => requestAsUser<Session[]>('GET', '/auth/sessions');
export const revokeSession = (id: string) => requestAsUser<void>('DELETE', `/auth/sessions/${segment(id)}`);

export const EXPORT_FILE_NAME = 'omnicourse-account.json';

/** Everything OmniCourse holds about the student, as the JSON file the API sends. */
export async function exportAccount(): Promise<Blob> {
  return (await sendAsUser('GET', '/users/me/export')).blob();
}

/** Signs the student out everywhere; the account is purged after the grace period unless they sign in again. 403: wrong password. */
export const deleteAccount = (body: DeleteAccountBody) => requestAsUser<DeletionScheduled>('DELETE', '/users/me', { body });

/** Hands a file to the browser's downloads, as a link the student clicked would. */
export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
