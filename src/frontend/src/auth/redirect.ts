import type { LocationQueryValue } from 'vue-router';

export const HOME_SIGNED_IN = '/dashboard';

export function afterSignIn(redirect: LocationQueryValue | LocationQueryValue[] | undefined): string {
  if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.startsWith('/\\')) return HOME_SIGNED_IN;
  return redirect;
}
