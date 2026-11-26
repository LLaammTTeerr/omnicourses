import { segment } from '../api.js';
import type { Session } from '../auth/api.js';
import { requestAsUser, sendAsUser } from '../auth/store.js';

export interface DeleteAccountBody {
  password: string;
}

export interface DeletionScheduled {
  purgeAfter: string;
}

export const DELETION_GRACE_DAYS = 30;

export const listSessions = () => requestAsUser<Session[]>('GET', '/auth/sessions');
export const revokeSession = (id: string) => requestAsUser<void>('DELETE', `/auth/sessions/${segment(id)}`);

export const EXPORT_FILE_NAME = 'omnicourse-account.json';

export async function exportAccount(): Promise<Blob> {
  return (await sendAsUser('GET', '/users/me/export')).blob();
}

export const deleteAccount = (body: DeleteAccountBody) => requestAsUser<DeletionScheduled>('DELETE', '/users/me', { body });

export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
