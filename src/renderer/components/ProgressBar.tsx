import { useMemo } from 'react';
import { useNumberFormat, useT } from '../i18n';

interface ProgressBarProps {
  completed: number;
  total: number;
}

export function ProgressBar({ completed, total }: ProgressBarProps): JSX.Element {
  const t = useT();
  const formatNumber = useNumberFormat();
  const percent = total > 0 ? (completed / total) * 100 : 0;
  const label = useMemo(
    () =>
      t('topBar.progress', {
        completed: formatNumber(completed),
        total: formatNumber(total),
        percent: formatNumber(percent, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        })
      }),
    [completed, total, percent, formatNumber, t]
  );

  return (
    <div
      className="flex items-center gap-2 min-w-[260px]"
      title={label}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="flex-1 h-2 rounded-full bg-app-border overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-200"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <span className="text-xs text-app-text-muted whitespace-nowrap">{label}</span>
    </div>
  );
}
