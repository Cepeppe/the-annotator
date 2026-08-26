import type { OutOfRangeAnnotation } from '@shared/types';
import { plural } from '@shared/i18n';
import { useT } from '../i18n';

interface OutOfRangeBannerProps {
  bboxes: OutOfRangeAnnotation[];
  currentImage: string | null;
  onGoNext: () => void;
}

export function OutOfRangeBanner({
  bboxes,
  currentImage,
  onGoNext
}: OutOfRangeBannerProps): JSX.Element | null {
  const t = useT();
  if (bboxes.length === 0) return null;
  const filenames = new Set(bboxes.map((b) => b.filename));
  const filesCount = filenames.size;
  const next = bboxes.find((b) => b.filename !== currentImage) ?? bboxes[0]!;
  const files = plural(t, filesCount, 'outOfRange.files.one', 'outOfRange.files.other');

  return (
    <div className="flex-none flex items-center gap-3 px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-900">
      <span className="text-lg" aria-hidden>
        ⚠
      </span>
      <span className="flex-1">
        {plural(t, bboxes.length, 'outOfRange.message.one', 'outOfRange.message.other', {
          files
        })}
      </span>
      <button
        type="button"
        onClick={onGoNext}
        className="px-3 py-1 text-xs rounded-md border border-red-700 bg-white text-red-900 hover:bg-red-100"
      >
        {t('outOfRange.goToNext', { filename: next.filename })}
      </button>
    </div>
  );
}
