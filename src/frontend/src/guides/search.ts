import { fold } from '../text-search.js';
import type { GuideListItem } from './api.js';


/** True when the query, as a whole phrase folded (UC-10 step 3), appears in the title or a keyword of any language the guide has. An empty query matches every guide. */
export function matches(item: GuideListItem, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  return Object.values(item.texts).some((text) => text !== undefined && [text.title, ...text.keywords].some((s) => fold(s).includes(q)));
}
