import type { LocationQueryValue } from 'vue-router';

/** Where a signed-in student lands when nothing asked for another page: the dashboard (F3, UC-03). */
export const HOME_SIGNED_IN = '/dashboard';

/**
 * The page to open after signing in: the `redirect` the guard put in the address, if it is a path in this app.
 * Anything else (another site, `//host`, `/\host`, a list) is ignored, so a crafted link cannot send a student away.
 */
export function afterSignIn(redirect: LocationQueryValue | LocationQueryValue[] | undefined): string {
  if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.startsWith('/\\')) return HOME_SIGNED_IN;
  return redirect;
}
