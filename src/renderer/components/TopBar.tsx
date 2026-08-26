import { useEffect, useRef, useState } from 'react';
import type { FilterStatus } from '@shared/types';
import { ProgressBar } from './ProgressBar';
import { useT } from '../i18n';

interface TopBarProps {
  datasetName: string;
  classCount: number;
  imageCount: number;
  completedCount: number;
  filterStatus: FilterStatus;
  searchQuery: string;
  onOpenDataset: () => void;
  onChangeFilterStatus: (status: FilterStatus) => void;
  onChangeSearchQuery: (query: string) => void;
}

const SEARCH_DEBOUNCE_MS = 200;

export function TopBar({
  datasetName,
  classCount,
  imageCount,
  completedCount,
  filterStatus,
  searchQuery,
  onOpenDataset,
  onChangeFilterStatus,
  onChangeSearchQuery
}: TopBarProps): JSX.Element {
  const t = useT();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<number | null>(null);
  const onChangeSearchRef = useRef(onChangeSearchQuery);
  onChangeSearchRef.current = onChangeSearchQuery;

  // Outside-in sync (RESET_FILTER, dataset change).
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    if (localSearch === searchQuery) return;
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      onChangeSearchRef.current(localSearch);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [localSearch, searchQuery]);

  return (
    <header className="flex-none flex flex-col gap-2 px-4 py-2 bg-app-surface border-b border-app-border">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-semibold text-app-text truncate" title={datasetName}>
            {datasetName}
          </span>
          <span className="text-xs text-app-text-muted flex-none">
            {t('topBar.summary', { images: imageCount, classes: classCount })}
          </span>
          <button
            type="button"
            onClick={onOpenDataset}
            className="px-3 py-1 text-xs rounded-md border border-app-border bg-white hover:bg-app-bg flex-none"
            title={t('topBar.openAnother.title')}
          >
            {t('topBar.openAnother')}
          </button>
        </div>
        <ProgressBar completed={completedCount} total={imageCount} />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-app-text-muted">
          <span>{t('topBar.status')}</span>
          <select
            value={filterStatus}
            onChange={(e) => onChangeFilterStatus(e.target.value as FilterStatus)}
            className="border border-app-border rounded-md px-2 py-1 text-sm bg-white"
            title={t('topBar.filter.title')}
          >
            <option value="all">{t('topBar.filter.all')}</option>
            <option value="pending">{t('topBar.filter.pending')}</option>
            <option value="completed">{t('topBar.filter.completed')}</option>
          </select>
        </label>
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={`🔍 ${t('topBar.search.placeholder')}`}
            className="w-full border border-app-border rounded-md pl-3 pr-7 py-1 text-sm bg-white"
            title={t('topBar.search.title')}
          />
          {localSearch.length > 0 && (
            <button
              type="button"
              onClick={() => setLocalSearch('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text px-1 text-sm"
              title={t('topBar.search.clear')}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
