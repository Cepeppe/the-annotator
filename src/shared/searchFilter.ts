import type { FilterState, ImageIndexEntry } from './types';

export function applyFilter(
  images: ImageIndexEntry[],
  filter: FilterState,
  completedSet: ReadonlySet<string>
): ImageIndexEntry[] {
  const query = filter.searchQuery.trim().toLowerCase();
  const status = filter.status;
  if (status === 'all' && query.length === 0) return images;
  const result: ImageIndexEntry[] = [];
  for (const entry of images) {
    if (status === 'pending' && completedSet.has(entry.filename)) continue;
    if (status === 'completed' && !completedSet.has(entry.filename)) continue;
    if (query.length > 0 && !entry.filename.toLowerCase().includes(query)) continue;
    result.push(entry);
  }
  return result;
}
