import { useDataset } from '../state/datasetStore';
import { ClassRow } from './ClassRow';
import { useT } from '../i18n';

interface ClassesSidebarProps {
  onAddClass: () => void;
  onDeleteClass: (classId: number) => void;
  onRenameClass: (classId: number, newName: string) => Promise<void> | void;
  onReorderClass: (fromIndex: number, toIndex: number) => Promise<void> | void;
}

export function ClassesSidebar({
  onAddClass,
  onDeleteClass,
  onRenameClass,
  onReorderClass
}: ClassesSidebarProps): JSX.Element {
  const { state, dispatch } = useDataset();
  const t = useT();
  if (state.phase !== 'loaded') return <></>;

  const lastIdx = state.classes.length - 1;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none flex items-center justify-between px-3 py-2 border-b border-app-border">
        <h2 className="text-sm font-semibold text-app-text">{t('classes.title')}</h2>
        <button
          type="button"
          onClick={onAddClass}
          title={t('classes.add.title')}
          className="px-2 py-1 text-xs rounded-md border border-app-accent bg-app-accent text-white hover:brightness-110"
        >
          + {t('classes.add')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {state.classes.length === 0 && (
          <div className="px-3 py-6 text-xs text-app-text-muted text-center">
            {t('classes.empty')}
          </div>
        )}
        {state.classes.map((name, idx) => (
          <ClassRow
            key={`${idx}-${name}`}
            classId={idx}
            name={name}
            count={state.perClassCounts[idx] ?? 0}
            isCurrent={state.currentClassId === idx}
            canMoveUp={idx > 0}
            canMoveDown={idx < lastIdx}
            onSelect={() => dispatch({ type: 'SET_CURRENT_CLASS_ID', classId: idx })}
            onDelete={() => onDeleteClass(idx)}
            onRename={(newName) => onRenameClass(idx, newName)}
            onMoveUp={() => onReorderClass(idx, idx - 1)}
            onMoveDown={() => onReorderClass(idx, idx + 1)}
          />
        ))}
      </div>
      <div className="flex-none px-3 py-2 border-t border-app-border text-[11px] text-app-text-muted">
        {t('classes.footer', {
          classes: state.classes.length,
          annotations: sumCounts(state.perClassCounts)
        })}
      </div>
    </div>
  );
}

function sumCounts(counts: Record<number, number>): number {
  let s = 0;
  for (const v of Object.values(counts)) s += v;
  return s;
}
