import type { GroupId } from './groups.js';
import type { Lang } from './locale.js';
import type { IconName } from './shell/icons.js';

export interface MenuEntry {
  icon: IconName;
  label: Record<Lang, string>;
  tab?: Record<Lang, string>;
  group: GroupId;
  section: 'main' | 'account';
  phoneTab?: number;
  visitors?: true;
  grant?: true;
  unreadBadge?: true;
}

declare module 'vue-router' {
  interface RouteMeta {
    keepAlive?: boolean;
    layout?: 'public' | 'app' | 'bare' | 'auto';
    auth?: 'required' | 'guest';
    onboarding?: 'optional';
    menu?: MenuEntry;
  }
}

export const APP_PAGE = { layout: 'app', auth: 'required' } as const;
