import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { useApi } from '../hooks/useApi';
import { useAutosave, isImageDirty } from '../hooks/useAutosave';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useProgressAutosave } from '../hooks/useProgressAutosave';
import { useImageNavigation } from '../hooks/useImageNavigation';
import { getCompletedSet, isImageCompleted, useDataset } from '../state/datasetStore';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasToolbarSecondary } from './CanvasToolbarSecondary';
import { CanvasView, RULER_LEFT_SIZE, RULER_TOP_SIZE } from './CanvasView';
import { ImageGrid } from './ImageGrid';
import { TopBar } from './TopBar';
import { Toast } from './Toast';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { ClassesSidebar } from './ClassesSidebar';
import { AddClassDialog } from './AddClassDialog';
import { Dialog } from './Dialog';
import { OutOfRangeBanner } from './OutOfRangeBanner';
import { BulkDeleteClassDialog } from './BulkDeleteClassDialog';
import { BulkRenameClassDialog } from './BulkRenameClassDialog';
import { BulkMergeClassDialog } from './BulkMergeClassDialog';
import { BulkRemapDialog } from './BulkRemapDialog';
import { BulkProgressDialog } from './BulkProgressDialog';
import { SettingsDialog } from './SettingsDialog';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { DeleteImageConfirmDialog } from './DeleteImageConfirmDialog';
import { DeleteImagesBulkConfirmDialog } from './DeleteImagesBulkConfirmDialog';
import { BulkDeleteImagesProgressDialog } from './BulkDeleteImagesProgressDialog';
import { AppCredit } from './AppCredit';
import { applyTheme } from '../lib/themeManager';
import { setLocale, useT } from '../i18n';
import { plural, resolveLocale, type TranslateFn } from '@shared/i18n';
import { reorderClasses, reorderIdMapping } from '@shared/classOps';
import type {
  BulkOpMenuKind,
  BulkOpResult,
  BulkProgressUpdate,
  DeleteBulkResult,
  DeleteImageFailureReason,
  DeleteImageResult,
  FilterStatus,
  OperationLogEntry,
  ProgressFile,
  UserSettings
} from '@shared/types';

interface AppLayoutProps {
  onOpenDataset: () => void;
  settingsDialogOpen: boolean;
  onCloseSettingsDialog: () => void;
  onShowShortcutHelp: () => void;
}

function basename(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : p;
}

const ZOOM_STEP = 1.2;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const TRASH_TTL_DAYS = 30;
const BULK_DELETE_PROGRESS_THRESHOLD = 20;

type BulkDialogKind = 'delete' | 'rename' | 'merge' | 'remap';

interface DeleteSinglePending {
  kind: 'single';
  filename: string;
  hadLabelFile: boolean;
  annotationsCount: number;
}

interface DeleteBulkPending {
  kind: 'bulk';
  filenames: string[];
  totalAnnotationsApprox: number;
  annotationsApprox: boolean;
}

type DeletePending = DeleteSinglePending | DeleteBulkPending;

function deleteFailureMessage(t: TranslateFn, reason: DeleteImageFailureReason): string {
  switch (reason) {
    case 'permission_denied':
      return t('toast.deleteFailed.permission');
    case 'file_locked':
      return t('toast.deleteFailed.locked');
    case 'image_not_found':
      return t('toast.deleteFailed.notFound');
    case 'unknown':
    default:
      return t('toast.deleteFailed.unknown');
  }
}

export function AppLayout({
  onOpenDataset,
  settingsDialogOpen,
  onCloseSettingsDialog,
  onShowShortcutHelp
}: AppLayoutProps): JSX.Element {
  const api = useApi();
  const t = useT();
  const { state, dispatch } = useDataset();

  const [toast, setToast] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'switch'; filename: string }
    | { kind: 'close' }
    | null
  >(null);

  const [addClassOpen, setAddClassOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<
    | { classId: number; count: number }
    | null
  >(null);
  const [bulkDialog, setBulkDialog] = useState<BulkDialogKind | null>(null);
  const [bulkOp, setBulkOp] = useState<{ id: string; title: string } | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const [bulkProgress, setBulkProgress] = useState<BulkProgressUpdate | null>(null);
  const [bulkCancelRequested, setBulkCancelRequested] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);
  // When a rename collides with an existing class we offer to merge the source
  // into the target instead of blocking the user with an error. The merge runs
  // atomically through runBulkMerge.
  const [renameCollisionPending, setRenameCollisionPending] = useState<
    | {
        fromClassId: number;
        toClassId: number;
        fromName: string;
        toName: string;
        movedCount: number;
      }
    | null
  >(null);
  const [deletePending, setDeletePending] = useState<DeletePending | null>(null);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const showToast = useCallback((message: string) => setToast(message), []);
  const { saveCurrentNow, saveImageNow } = useAutosave(showToast);
  useProgressAutosave();

  // ---- Open the first pending image automatically on the first load
  useEffect(() => {
    if (state.phase !== 'loaded') return;
    if (state.currentImage !== null) return;
    if (state.progressFile === null) return;
    const completedSet = getCompletedSet(state);
    const firstPending = state.images.find((e) => !completedSet.has(e.filename));
    const target = firstPending ?? state.images[0];
    if (target) dispatch({ type: 'SELECT_IMAGE', filename: target.filename });
  }, [state, dispatch]);

  // ---- On open: load progress.json, scan the stats, load the settings and
  // run the trash TTL cleanup.
  const lastLoadedRootRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.phase !== 'loaded') {
      lastLoadedRootRef.current = null;
      return;
    }
    if (lastLoadedRootRef.current === state.root) return;
    lastLoadedRootRef.current = state.root;
    const root = state.root;
    const classes = state.classes;
    void (async (): Promise<void> => {
      const settingsRes = await api.loadUserSettings();
      if (settingsRes.ok) {
        dispatch({ type: 'SET_USER_SETTINGS', settings: settingsRes.settings });
        applyTheme(settingsRes.settings.theme);
      }
      const progressRes = await api.loadProgressFile(root);
      if (progressRes.ok) {
        dispatch({ type: 'LOAD_PROGRESS', progress: progressRes.progress });
        if ('recoveredFromBroken' in progressRes && progressRes.recoveredFromBroken) {
          showToast(tRef.current('toast.progressCorrupted', { path: progressRes.brokenPath }));
        }
      } else {
        showToast(tRef.current('toast.progressUnreadable', { reason: progressRes.reason }));
      }
      const stats = await api.scanDatasetStats(root, classes);
      dispatch({
        type: 'UPDATE_STATS',
        perClassCounts: stats.perClassCounts,
        totalAnnotations: stats.totalAnnotations,
        totalImages: stats.totalImages,
        outOfRange: stats.outOfRangeAnnotations
      });
      // Trash TTL cleanup (older than 30 days). Best-effort: it never blocks
      // opening the dataset.
      void api.cleanupOldTrashAndBackups(root, TRASH_TTL_DAYS).then((res) => {
        if (res.removed > 0) {
          showToast(
            plural(
              tRef.current,
              res.removed,
              'toast.trashCleaned.one',
              'toast.trashCleaned.other',
              { days: TRASH_TTL_DAYS }
            )
          );
        }
      });
    })();
  }, [state, dispatch, api, showToast]);

  // ---- Listen to the bulk progress events
  useEffect(() => {
    return api.onBulkProgress((update) => {
      if (!bulkOp || update.opId !== bulkOp.id) return;
      setBulkProgress(update);
    });
  }, [api, bulkOp]);

  // ---- Listen to the Tools menu
  useEffect(() => {
    return api.onMenuBulkOp((kind: BulkOpMenuKind) => {
      if (kind === 'recompute') {
        const s = stateRef.current;
        if (s.phase !== 'loaded') return;
        void recomputeStats(s.root, s.classes);
        return;
      }
      setBulkDialog(kind);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const recomputeStats = useCallback(
    async (root: string, classes: string[]): Promise<void> => {
      const stats = await api.scanDatasetStats(root, classes);
      dispatch({
        type: 'UPDATE_STATS',
        perClassCounts: stats.perClassCounts,
        totalAnnotations: stats.totalAnnotations,
        totalImages: stats.totalImages,
        outOfRange: stats.outOfRangeAnnotations
      });
    },
    [api, dispatch]
  );

  // ---- Safe wrapper around switching image: flushes pending edits first
  const requestSelectImage = useCallback(
    async (filename: string) => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      if (s.currentImage === filename) return;
      if (s.currentImage && isImageDirty(s, s.currentImage)) {
        const ok = await saveImageNow(s.currentImage);
        if (!ok) {
          setPendingAction({ kind: 'switch', filename });
          return;
        }
      }
      dispatch({ type: 'SELECT_IMAGE', filename });
    },
    [dispatch, saveImageNow]
  );

  // ---- Navigation inside the current filter
  const navigation = useImageNavigation((filename) => {
    void requestSelectImage(filename);
  });

  // ---- Mark completed and next
  const handleMarkCompletedAndNext = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'loaded' || !s.currentImage || !s.progressFile) return;
    const filename = s.currentImage;
    const at = new Date().toISOString();
    const by = s.userSettings.username;
    const wasCompleted = isImageCompleted(s, filename);
    if (!wasCompleted) {
      const snapshotNext = navigation.findNextPending(filename);
      dispatch({ type: 'MARK_COMPLETED', filename, at, by });
      if (snapshotNext) {
        void requestSelectImage(snapshotNext);
      } else {
        showToast(`${t('toast.allImagesDone')} 🎉`);
      }
    } else {
      const next = navigation.findNextPending(filename);
      if (next) {
        void requestSelectImage(next);
      } else {
        showToast(`${t('toast.allImagesDone')} 🎉`);
      }
    }
  }, [dispatch, navigation, requestSelectImage, showToast, t]);

  // ---- Mark pending (no auto-nav)
  const handleMarkPending = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'loaded' || !s.currentImage || !s.progressFile) return;
    if (!isImageCompleted(s, s.currentImage)) return;
    dispatch({ type: 'MARK_PENDING', filename: s.currentImage });
  }, [dispatch]);

  // ---- Filter change handlers
  const handleChangeFilterStatus = useCallback(
    (status: FilterStatus) => {
      dispatch({ type: 'SET_FILTER_STATUS', status });
    },
    [dispatch]
  );
  const handleChangeSearchQuery = useCallback(
    (query: string) => {
      dispatch({ type: 'SET_FILTER_SEARCH', query });
    },
    [dispatch]
  );

  // ---- Settings save
  const handleSaveSettings = useCallback(
    async (settings: UserSettings): Promise<void> => {
      const res = await api.saveUserSettings(settings);
      if (!res.ok) {
        showToast(t('toast.settingsSaveFailed', { reason: res.reason }));
        return;
      }
      dispatch({ type: 'SET_USER_SETTINGS', settings });
      applyTheme(settings.theme);
      void api.syncTheme(settings.theme);
      setLocale(resolveLocale(settings.language, navigator.language));
      void api.syncLanguage(settings.language);
      onCloseSettingsDialog();
      showToast(t('toast.settingsUpdated'));
    },
    [api, dispatch, onCloseSettingsDialog, showToast, t]
  );

  // ---- Close handshake
  useEffect(() => {
    const off = api.onCloseRequested(() => {
      const s = stateRef.current;
      const dirty =
        s.phase === 'loaded' && s.currentImage ? isImageDirty(s, s.currentImage) : false;
      if (!dirty) {
        void api.confirmClose();
        return;
      }
      setPendingAction({ kind: 'close' });
    });
    return () => off();
  }, [api]);

  // ---- Zoom helpers
  const stepZoom = useCallback(
    (factor: number) => {
      if (state.phase !== 'loaded') return;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.view.zoom * factor));
      dispatch({
        type: 'SET_VIEW',
        view: { zoom: newZoom, panX: state.view.panX, panY: state.view.panY }
      });
    },
    [dispatch, state]
  );
  const onZoomIn = useCallback(() => stepZoom(ZOOM_STEP), [stepZoom]);
  const onZoomOut = useCallback(() => stepZoom(1 / ZOOM_STEP), [stepZoom]);
  const onResetZoom = useCallback(() => {
    if (state.phase !== 'loaded' || !state.currentImage) return;
    const edit = state.perImage.get(state.currentImage);
    const sz = edit?.imageSize;
    if (!sz) return;
    const canvasEl = document.querySelector<HTMLCanvasElement>('canvas');
    const w = canvasEl?.parentElement?.clientWidth ?? 1;
    const h = canvasEl?.parentElement?.clientHeight ?? 1;
    // Reserve room for the rulers when they are on: the image must fit the
    // usable area (canvas minus rulers) so that sceneX=0 / sceneY=0 sit right
    // after the corner box and the "0" ticks stay visible.
    const padX = state.userSettings.showRulers ? RULER_LEFT_SIZE : 0;
    const padY = state.userSettings.showRulers ? RULER_TOP_SIZE : 0;
    const innerW = Math.max(1, w - padX);
    const innerH = Math.max(1, h - padY);
    const zoom = Math.min(innerW / sz.width, innerH / sz.height);
    const panX = padX + (innerW - sz.width * zoom) / 2;
    const panY = padY + (innerH - sz.height * zoom) / 2;
    dispatch({ type: 'SET_VIEW', view: { zoom, panX, panY } });
  }, [dispatch, state]);

  const onSaveNow = useCallback(() => {
    void saveCurrentNow();
  }, [saveCurrentNow]);

  // ---- Open the delete confirmation for one image
  const openDeleteSingle = useCallback((filename: string) => {
    const s = stateRef.current;
    if (s.phase !== 'loaded') return;
    const entry = s.images.find((e) => e.filename === filename);
    if (!entry) return;
    // Count boxes from memory when the image is loaded, otherwise fall back to
    // the has-label flag.
    const editState = s.perImage.get(filename);
    const annotationsCount = editState?.bboxes.length ?? (entry.hasLabelFile ? -1 : 0);
    setDeletePending({
      kind: 'single',
      filename,
      hadLabelFile: entry.hasLabelFile,
      annotationsCount: annotationsCount >= 0 ? annotationsCount : 0
    });
  }, []);

  // ---- Open the delete confirmation for a multi-selection
  const openDeleteBulk = useCallback((filenames: string[]) => {
    const s = stateRef.current;
    if (s.phase !== 'loaded') return;
    if (filenames.length === 0) return;
    if (filenames.length === 1) {
      openDeleteSingle(filenames[0]!);
      return;
    }
    // Estimate: sum the boxes held in memory and count 0 for images that are
    // not loaded. The exact figure comes back from the main process after the
    // delete actually runs.
    let known = 0;
    let knownExact = true;
    for (const f of filenames) {
      const e = s.perImage.get(f);
      if (e) known += e.bboxes.length;
      else knownExact = false;
    }
    setDeletePending({
      kind: 'bulk',
      filenames,
      totalAnnotationsApprox: known,
      annotationsApprox: !knownExact
    });
  }, [openDeleteSingle]);

  // ---- Perform a single delete
  const performDeleteSingle = useCallback(
    async (filename: string): Promise<void> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;

      // If this is the current image, flush pending edits first and abort on
      // failure rather than losing them.
      if (s.currentImage === filename && isImageDirty(s, filename)) {
        const okFlush = await saveImageNow(filename);
        if (!okFlush) {
          showToast(t('toast.saveBeforeDeleteFailed'));
          return;
        }
      }

      const result: DeleteImageResult = await api.deleteImage(s.root, filename);
      if (!result.ok) {
        showToast(deleteFailureMessage(t, result.reason));
        return;
      }

      // Update the store. The per-class delta can only be computed from the
      // boxes held in memory; the main process reports the total count but not
      // its breakdown by class.
      const edit = s.perImage.get(filename);
      const perClassCountsDelta: Record<number, number> = {};
      let totalAnnRemoved = 0;
      if (edit) {
        for (const b of edit.bboxes) {
          perClassCountsDelta[b.classId] = (perClassCountsDelta[b.classId] ?? 0) - 1;
          totalAnnRemoved += 1;
        }
      } else {
        totalAnnRemoved = result.annotationsCount;
      }

      // Snapshot the next target before REMOVE_IMAGES, because the image is
      // about to disappear from the filtered list.
      const wasCurrent = s.currentImage === filename;
      const nextTarget = wasCurrent ? navigation.findNextPending(filename) : null;

      dispatch({
        type: 'REMOVE_IMAGES',
        filenames: [filename],
        perClassCountsDelta,
        totalAnnotationsRemoved: totalAnnRemoved
      });
      const entry: OperationLogEntry = {
        op: 'delete_image',
        filename,
        had_label_file: result.hadLabelFile,
        annotations_count: result.annotationsCount,
        trashed_to: result.trashedTo,
        at: new Date().toISOString(),
        by: progressUserName(s.userSettings, s.progressFile)
      };
      dispatch({ type: 'APPEND_OPERATION_LOG', entry });

      if (wasCurrent) {
        if (nextTarget) {
          void requestSelectImage(nextTarget);
        } else {
          // Nothing pending left: fall back to whatever image comes first.
          const fallback = stateRef.current.phase === 'loaded'
            ? stateRef.current.images[0]?.filename ?? null
            : null;
          if (fallback) void requestSelectImage(fallback);
        }
      }

      showToast(
        t('toast.imageTrashed', {
          filename,
          details:
            result.annotationsCount > 0
              ? t('toast.imageTrashed.details', { count: result.annotationsCount })
              : ''
        })
      );
    },
    [api, dispatch, navigation, requestSelectImage, saveImageNow, showToast, t]
  );

  // ---- Perform a bulk delete
  const performDeleteBulk = useCallback(
    async (filenames: string[]): Promise<void> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      if (filenames.length === 0) return;

      // Flush first when the current image is part of the selection.
      if (s.currentImage && filenames.includes(s.currentImage) && isImageDirty(s, s.currentImage)) {
        const okFlush = await saveImageNow(s.currentImage);
        if (!okFlush) {
          showToast(t('toast.saveBeforeDeleteFailed'));
          return;
        }
      }

      const showProgress = filenames.length > BULK_DELETE_PROGRESS_THRESHOLD;
      if (showProgress) setBulkDeleteProgress({ current: 0, total: filenames.length });

      const result: DeleteBulkResult = await api.deleteImagesBulk(s.root, filenames);

      if (showProgress) setBulkDeleteProgress(null);

      // Compute perClassCountsDelta from the boxes we have in memory.
      const succeededSet = new Set(result.succeeded.map((r) => r.filename));
      const perClassCountsDelta: Record<number, number> = {};
      let totalAnnRemovedKnown = 0;
      for (const f of succeededSet) {
        const edit = s.perImage.get(f);
        if (!edit) continue;
        for (const b of edit.bboxes) {
          perClassCountsDelta[b.classId] = (perClassCountsDelta[b.classId] ?? 0) - 1;
          totalAnnRemovedKnown += 1;
        }
      }

      // For images that were not loaded we only have the total reported by the
      // main process. It cannot be split per class, but it does keep
      // total_annotations in stats_snapshot correct.
      const totalAnnFromMain = result.totalAnnotationsRemoved;
      const totalToReport = Math.max(totalAnnFromMain, totalAnnRemovedKnown);

      // Snapshot the next pending image when the current one is being deleted.
      const wasCurrentInSelection =
        s.currentImage !== null && succeededSet.has(s.currentImage);
      const nextTarget = wasCurrentInSelection
        ? navigation.findNextPending(s.currentImage!)
        : null;

      dispatch({
        type: 'REMOVE_IMAGES',
        filenames: [...succeededSet],
        perClassCountsDelta,
        totalAnnotationsRemoved: totalToReport
      });

      // One log entry per deleted image, to keep the audit trail detailed.
      const at = new Date().toISOString();
      const by = progressUserName(s.userSettings, s.progressFile);
      for (const r of result.succeeded) {
        const entry: OperationLogEntry = {
          op: 'delete_image',
          filename: r.filename,
          had_label_file: r.hadLabelFile,
          annotations_count: r.annotationsCount,
          trashed_to: r.trashedTo,
          at,
          by
        };
        dispatch({ type: 'APPEND_OPERATION_LOG', entry });
      }

      if (wasCurrentInSelection) {
        if (nextTarget) {
          void requestSelectImage(nextTarget);
        } else {
          const fallback = stateRef.current.phase === 'loaded'
            ? stateRef.current.images[0]?.filename ?? null
            : null;
          if (fallback) void requestSelectImage(fallback);
        }
      }

      // Closing toast.
      const okN = result.succeeded.length;
      const koN = result.failed.length;
      if (koN === 0) {
        showToast(
          plural(t, okN, 'toast.imagesTrashed.one', 'toast.imagesTrashed.other', {
            details:
              totalToReport > 0
                ? t('toast.imageTrashed.details', { count: totalToReport })
                : ''
          })
        );
      } else {
        const firstFail = result.failed[0];
        showToast(
          t('toast.imagesTrashed.partial', {
            ok: okN,
            failed: koN,
            example: firstFail
              ? t('toast.imagesTrashed.example', {
                  filename: firstFail.filename,
                  reason: deleteFailureMessage(t, firstFail.reason)
                })
              : ''
          })
        );
      }
    },
    [api, dispatch, navigation, requestSelectImage, saveImageNow, showToast, t]
  );

  // ---- Delete requested from the keyboard (Backspace / Shift+Del)
  const handleRequestDeleteSelectedImages = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'loaded') return;
    if (s.selectedGridImages.length === 0) return;
    openDeleteBulk(s.selectedGridImages);
  }, [openDeleteBulk]);

  useKeyboardShortcuts({
    onSaveNow,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onMarkCompletedAndNext: handleMarkCompletedAndNext,
    onMarkPending: handleMarkPending,
    onNavNext: () => {
      navigation.goToNext();
    },
    onNavPrev: () => {
      navigation.goToPrev();
    },
    onNavFirst: () => {
      navigation.goToFirst();
    },
    onNavLast: () => {
      navigation.goToLast();
    },
    onShowShortcutHelp,
    onRequestDeleteSelectedImages: handleRequestDeleteSelectedImages
  });

  // ---- Class helpers: add, rename, delete
  const handleAddClass = useCallback(
    async (name: string): Promise<void> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      if (s.classes.includes(name)) {
        showToast(t('toast.classExists', { name }));
        return;
      }
      const newClasses = [...s.classes, name];
      const yamlRes = await api.saveDataYaml(s.root, newClasses);
      if (!yamlRes.ok) {
        showToast(t('toast.dataYamlWriteFailed', { reason: yamlRes.reason }));
        return;
      }
      dispatch({ type: 'ADD_CLASS', name });
      dispatch({ type: 'ADD_CUSTOM_CLASS', name });
      const entry: OperationLogEntry = {
        op: 'add_class',
        name,
        at: new Date().toISOString(),
        by: progressUserName(s.userSettings, s.progressFile)
      };
      dispatch({ type: 'APPEND_OPERATION_LOG', entry });
      setAddClassOpen(false);
      showToast(t('toast.classAdded', { name }));
    },
    [api, dispatch, showToast, t]
  );

  const handleRenameClass = useCallback(
    async (classId: number, newName: string): Promise<void> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      const oldName = s.classes[classId];
      if (!oldName || oldName === newName) return;
      const existingTargetId = s.classes.indexOf(newName);
      if (existingTargetId !== -1) {
        // Collision: offer a merge instead of refusing. The source class is
        // collapsed into the target, removed from data.yaml, and the ids of the
        // classes after it are compacted.
        setRenameCollisionPending({
          fromClassId: classId,
          toClassId: existingTargetId,
          fromName: oldName,
          toName: newName,
          movedCount: s.perClassCounts[classId] ?? 0
        });
        return;
      }
      const newClasses = s.classes.map((c, i) => (i === classId ? newName : c));
      const yamlRes = await api.saveDataYaml(s.root, newClasses);
      if (!yamlRes.ok) {
        showToast(t('toast.dataYamlWriteFailed', { reason: yamlRes.reason }));
        return;
      }
      dispatch({ type: 'RENAME_CLASS', classId, newName });
      const entry: OperationLogEntry = {
        op: 'rename_class',
        from: oldName,
        to: newName,
        at: new Date().toISOString(),
        by: progressUserName(s.userSettings, s.progressFile)
      };
      dispatch({ type: 'APPEND_OPERATION_LOG', entry });
      showToast(t('toast.classRenamed', { name: newName }));
    },
    [api, dispatch, showToast, t]
  );

  const handleDeleteClass = useCallback(
    (classId: number) => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      const count = s.perClassCounts[classId] ?? 0;
      setConfirmDelete({ classId, count });
    },
    []
  );

  // Reordering classes changes class_id through an adjacent swap. It goes
  // through the same runBulkOp as every other bulk operation: modal progress
  // dialog, autosave flush, cancel button, rollback on error, stats refresh and
  // an entry in the operations log.

  const performDeleteClass = useCallback(
    async (classId: number, count: number): Promise<void> => {
      setConfirmDelete(null);
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      const className = s.classes[classId];
      if (!className) return;

      if (count === 0) {
        const newClasses = s.classes.filter((_, i) => i !== classId);
        const yamlRes = await api.saveDataYaml(s.root, newClasses);
        if (!yamlRes.ok) {
          showToast(t('toast.dataYamlWriteFailed', { reason: yamlRes.reason }));
          return;
        }
        const mapping: Record<number, number | null> = {};
        for (let i = 0; i < s.classes.length; i++) {
          if (i === classId) mapping[i] = null;
          else if (i > classId) mapping[i] = i - 1;
          else mapping[i] = i;
        }
        dispatch({ type: 'APPLY_CLASS_REMAP', newClasses, mapping });
        const entry: OperationLogEntry = {
          op: 'delete_class',
          class: className,
          removed_annotations: 0,
          at: new Date().toISOString(),
          by: progressUserName(s.userSettings, s.progressFile)
        };
        dispatch({ type: 'APPEND_OPERATION_LOG', entry });
        await recomputeStats(s.root, newClasses);
        showToast(t('toast.classDeleted', { name: className }));
        return;
      }

      await runBulkDelete(classId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, dispatch, showToast, recomputeStats, t]
  );

  // ---- Shared runner for the class-level bulk operations
  const runBulkOp = useCallback(
    async (
      title: string,
      logEntryBuilder: (result: BulkOpResult & { ok: true }) => OperationLogEntry,
      newClassesAfter: string[],
      classIdMapping: Record<number, number | null>,
      executor: (opId: string) => Promise<BulkOpResult>
    ): Promise<void> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;

      if (s.currentImage && isImageDirty(s, s.currentImage)) {
        const ok = await saveImageNow(s.currentImage);
        if (!ok) {
          showToast(t('toast.saveBeforeBulkFailed'));
          return;
        }
      }

      const opId = `op_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      setBulkOp({ id: opId, title });
      setBulkProgress({ opId, phase: 'scanning', current: 0, total: 0 });
      setBulkCancelRequested(false);

      const result = await executor(opId);

      setBulkOp(null);
      setBulkProgress(null);
      setBulkCancelRequested(false);

      if (!result.ok) {
        showToast(
          result.rolledBack
            ? t('toast.bulkFailedRolledBack', { reason: result.reason })
            : t('toast.bulkFailedNotRolledBack', { reason: result.reason })
        );
        if (!result.rolledBack) {
          // The rollback itself failed, so labels/ is now somewhere between the
          // two states and the class list on screen no longer describes it.
          // data.yaml was never rewritten, so the old class list is still the
          // right one to count against: rescan so the sidebar and the
          // out-of-range banner show what is actually on disk.
          await recomputeStats(s.root, s.classes);
        }
        return;
      }

      dispatch({ type: 'APPLY_CLASS_REMAP', newClasses: newClassesAfter, mapping: classIdMapping });
      dispatch({ type: 'APPEND_OPERATION_LOG', entry: logEntryBuilder(result) });
      await recomputeStats(s.root, newClassesAfter);

      showToast(t('toast.bulkDone', { title, stats: formatBulkResult(t, result) }));
    },
    [dispatch, recomputeStats, saveImageNow, showToast, t]
  );

  const runBulkDelete = useCallback(
    async (classId: number): Promise<void> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      const className = s.classes[classId];
      if (!className) return;
      const newClasses = s.classes.filter((_, i) => i !== classId);
      const mapping: Record<number, number | null> = {};
      for (let i = 0; i < s.classes.length; i++) {
        if (i === classId) mapping[i] = null;
        else if (i > classId) mapping[i] = i - 1;
        else mapping[i] = i;
      }
      await runBulkOp(
        t('bulkOp.deleteClass'),
        (r) => ({
          op: 'delete_class',
          class: className,
          removed_annotations: r.removedAnnotations ?? 0,
          at: new Date().toISOString(),
          by: progressUserName(s.userSettings, s.progressFile)
        }),
        newClasses,
        mapping,
        (opId) => api.bulkDeleteClassAnnotations(s.root, s.classes, classId, opId)
      );
    },
    [api, runBulkOp, t]
  );

  const runBulkMerge = useCallback(
    async (fromClassId: number, toClassId: number): Promise<void> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      const fromName = s.classes[fromClassId];
      const toName = s.classes[toClassId];
      if (!fromName || !toName) return;
      const finalTo = toClassId > fromClassId ? toClassId - 1 : toClassId;
      const newClasses = s.classes.filter((_, i) => i !== fromClassId);
      const mapping: Record<number, number | null> = {};
      for (let i = 0; i < s.classes.length; i++) {
        if (i === fromClassId) mapping[i] = finalTo;
        else if (i > fromClassId) mapping[i] = i - 1;
        else mapping[i] = i;
      }
      await runBulkOp(
        t('bulkOp.mergeClasses'),
        (r) => ({
          op: 'merge_class',
          from: fromName,
          to: toName,
          remapped_annotations: r.remappedAnnotations ?? 0,
          at: new Date().toISOString(),
          by: progressUserName(s.userSettings, s.progressFile)
        }),
        newClasses,
        mapping,
        (opId) => api.bulkMergeClasses(s.root, s.classes, fromClassId, toClassId, opId)
      );
    },
    [api, runBulkOp, t]
  );

  const runBulkRemap = useCallback(
    async (mapping: Array<{ from: number; to: number }>): Promise<void> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      const remap: Record<number, number | null> = {};
      for (let i = 0; i < s.classes.length; i++) remap[i] = i;
      for (const { from, to } of mapping) remap[from] = to;
      await runBulkOp(
        t('bulkOp.remapClassIds'),
        (r) => ({
          op: 'remap_class_ids',
          mapping,
          remapped_annotations: r.remappedAnnotations ?? 0,
          at: new Date().toISOString(),
          by: progressUserName(s.userSettings, s.progressFile)
        }),
        s.classes,
        remap,
        (opId) => api.bulkRemapClasses(s.root, s.classes, mapping, opId)
      );
    },
    [api, runBulkOp, t]
  );

  const requestBulkCancel = useCallback(() => {
    if (!bulkOp) return;
    setBulkCancelRequested(true);
    void api.bulkCancel(bulkOp.id);
  }, [api, bulkOp]);

  const handleReorderClass = useCallback(
    async (fromIndex: number, toIndex: number): Promise<void> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      if (fromIndex === toIndex) return;
      const fromName = s.classes[fromIndex];
      if (!fromName) return;
      // Compute newClasses and the oldId -> newId mapping here, so
      // APPLY_CLASS_REMAP can be applied locally once the IPC call succeeds.
      const newClasses = reorderClasses(s.classes, fromIndex, toIndex);
      if (newClasses === null) return;
      // Positional, never `newClasses.indexOf(name)`: a data.yaml written by
      // another tool can repeat a name, and indexOf would then map both copies
      // onto the same id. This has to match what bulkReorderClasses does to the
      // .txt files, or the boxes held in memory would end up on other classes.
      const shifts = reorderIdMapping(s.classes.length, fromIndex, toIndex);
      const mapping: Record<number, number | null> = {};
      for (let oldId = 0; oldId < s.classes.length; oldId++) {
        mapping[oldId] = shifts.get(oldId) ?? oldId;
      }
      const remapList = Object.entries(mapping)
        .filter(([from, to]) => to !== null && Number(from) !== to)
        .map(([from, to]) => ({ from: Number(from), to: to as number }));
      await runBulkOp(
        t(toIndex < fromIndex ? 'bulkOp.moveClassUp' : 'bulkOp.moveClassDown', {
          name: fromName
        }),
        (r) => ({
          op: 'remap_class_ids',
          mapping: remapList,
          remapped_annotations: r.remappedAnnotations ?? 0,
          at: new Date().toISOString(),
          by: progressUserName(s.userSettings, s.progressFile)
        }),
        newClasses,
        mapping,
        (opId) => api.bulkReorderClasses(s.root, s.classes, fromIndex, toIndex, opId)
      );
    },
    [api, runBulkOp, t]
  );

  // ---- Jump to the next annotation with an out-of-range class id
  const goToOutOfRange = useCallback(() => {
    if (state.phase !== 'loaded') return;
    const next = state.outOfRangeBboxes.find((b) => b.filename !== state.currentImage)
      ?? state.outOfRangeBboxes[0];
    if (!next) return;
    void requestSelectImage(next.filename);
  }, [state, requestSelectImage]);

  // ---- Image list: click, multi-select (Ctrl/Shift) and context menu
  const handleGridItemClick = useCallback(
    (filename: string, e: ReactMouseEvent) => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      const list = navigation.filteredImages;
      const targetIdx = list.findIndex((entry) => entry.filename === filename);

      if (e.shiftKey && s.gridSelectionAnchor) {
        const anchorIdx = list.findIndex((entry) => entry.filename === s.gridSelectionAnchor);
        if (anchorIdx >= 0 && targetIdx >= 0) {
          const lo = Math.min(anchorIdx, targetIdx);
          const hi = Math.max(anchorIdx, targetIdx);
          const range = list.slice(lo, hi + 1).map((e2) => e2.filename);
          dispatch({
            type: 'SET_GRID_SELECTION',
            filenames: range,
            anchor: s.gridSelectionAnchor
          });
          return;
        }
      }
      if (e.ctrlKey || e.metaKey) {
        const set = new Set(s.selectedGridImages);
        if (set.has(filename)) set.delete(filename);
        else set.add(filename);
        dispatch({
          type: 'SET_GRID_SELECTION',
          filenames: [...set],
          anchor: filename
        });
        return;
      }
      // Plain click: clear the multi-selection and open the image.
      if (s.selectedGridImages.length > 0) {
        dispatch({ type: 'CLEAR_GRID_SELECTION' });
      }
      void requestSelectImage(filename);
    },
    [dispatch, navigation, requestSelectImage]
  );

  const handleGridItemContextMenu = useCallback(
    (filename: string, e: ReactMouseEvent) => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      // If the right-clicked item is not part of the multi-selection, treat it
      // as a selection of one: the menu should act on what was clicked.
      const inSelection = s.selectedGridImages.includes(filename);
      const targetSelection = inSelection ? s.selectedGridImages : [filename];

      if (!inSelection && s.selectedGridImages.length > 0) {
        dispatch({ type: 'CLEAR_GRID_SELECTION' });
      }

      const isCompleted = isImageCompleted(s, filename);
      const items: ContextMenuItem[] = [
        {
          label: t('imageMenu.open'),
          onClick: () => {
            void requestSelectImage(filename);
          }
        },
        isCompleted
          ? {
              label: t('imageMenu.markPending'),
              onClick: () => {
                if (stateRef.current.phase !== 'loaded') return;
                dispatch({ type: 'MARK_PENDING', filename });
              }
            }
          : {
              label: t('imageMenu.markDone'),
              onClick: () => {
                const cur = stateRef.current;
                if (cur.phase !== 'loaded' || !cur.progressFile) return;
                dispatch({
                  type: 'MARK_COMPLETED',
                  filename,
                  at: new Date().toISOString(),
                  by: cur.userSettings.username
                });
              }
            },
        { kind: 'separator' },
        targetSelection.length > 1
          ? {
              label: t('imageMenu.deleteSelected', { count: targetSelection.length }),
              variant: 'danger',
              onClick: () => openDeleteBulk(targetSelection)
            }
          : {
              label: t('imageMenu.delete'),
              variant: 'danger',
              onClick: () => openDeleteSingle(filename)
            }
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [dispatch, openDeleteBulk, openDeleteSingle, requestSelectImage, t]
  );

  // ---- The "Advanced" toolbar deletes the current image with no confirmation.
  // The warning and the recovery instructions live in its tooltip.
  const handleDeleteCurrentImage = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'loaded' || !s.currentImage) return;
    void performDeleteSingle(s.currentImage);
  }, [performDeleteSingle]);

  if (state.phase !== 'loaded') return <></>;

  const datasetName = basename(state.root);
  const completedSet = getCompletedSet(state);
  const completedCount = completedSet.size;
  const filteredImages = navigation.filteredImages;
  const searchActive = state.filter.searchQuery.trim().length > 0;
  const multiSelectedSet = new Set(state.selectedGridImages);

  return (
    <div className="h-full w-full flex flex-col bg-app-bg">
      <TopBar
        datasetName={datasetName}
        classCount={state.classes.length}
        imageCount={state.images.length}
        completedCount={completedCount}
        filterStatus={state.filter.status}
        searchQuery={state.filter.searchQuery}
        onOpenDataset={onOpenDataset}
        onChangeFilterStatus={handleChangeFilterStatus}
        onChangeSearchQuery={handleChangeSearchQuery}
      />
      <OutOfRangeBanner
        bboxes={state.outOfRangeBboxes}
        currentImage={state.currentImage}
        onGoNext={goToOutOfRange}
      />
      <div className="flex-1 flex min-h-0">
        <aside className="w-[280px] flex-none border-r border-app-border bg-app-surface">
          <ImageGrid
            datasetRoot={state.root}
            images={filteredImages}
            totalImages={state.images.length}
            currentImage={state.currentImage}
            completedSet={completedSet}
            searchActive={searchActive}
            filterStatus={state.filter.status}
            multiSelected={multiSelectedSet}
            selectionAnchor={state.gridSelectionAnchor}
            onItemClick={handleGridItemClick}
            onItemContextMenu={handleGridItemContextMenu}
            onItemDelete={openDeleteSingle}
          />
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <CanvasToolbar
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onResetZoom={onResetZoom}
            onSaveNow={onSaveNow}
            onMarkCompletedAndNext={handleMarkCompletedAndNext}
            onMarkPending={handleMarkPending}
          />
          <CanvasToolbarSecondary
            currentImage={state.currentImage}
            onDeleteCurrentImage={handleDeleteCurrentImage}
          />
          <CanvasView
            datasetRoot={state.root}
            imageFilename={state.currentImage}
            classes={state.classes}
          />
        </div>
        <aside className="w-[280px] flex-none border-l border-app-border bg-app-surface">
          <ClassesSidebar
            onAddClass={() => setAddClassOpen(true)}
            onDeleteClass={handleDeleteClass}
            onRenameClass={handleRenameClass}
            onReorderClass={handleReorderClass}
          />
        </aside>
      </div>

      {/* Credit strip, bottom right. flex-none so it never steals height from
          the canvas row above it. */}
      <footer className="flex-none flex justify-end items-center h-6 px-3 border-t border-app-border bg-app-surface">
        <AppCredit />
      </footer>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {addClassOpen && (
        <AddClassDialog
          existingClasses={state.classes}
          onConfirm={handleAddClass}
          onCancel={() => setAddClassOpen(false)}
        />
      )}

      {confirmDelete && (
        <Dialog
          title={t('deleteClass.title')}
          message={t(
            confirmDelete.count > 0
              ? 'deleteClass.messageWithAnnotations'
              : 'deleteClass.messageNoAnnotations',
            {
              name: state.classes[confirmDelete.classId] ?? '',
              count: confirmDelete.count
            }
          )}
          primaryLabel={t('common.delete')}
          secondaryLabel={t('common.cancel')}
          onPrimary={() => {
            void performDeleteClass(confirmDelete.classId, confirmDelete.count);
          }}
          onSecondary={() => setConfirmDelete(null)}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {renameCollisionPending && (
        <Dialog
          title={t('mergeOnRename.title')}
          message={t(
            renameCollisionPending.movedCount > 0
              ? 'mergeOnRename.messageWithAnnotations'
              : 'mergeOnRename.messageNoAnnotations',
            {
              from: renameCollisionPending.fromName,
              to: renameCollisionPending.toName,
              count: renameCollisionPending.movedCount
            }
          )}
          primaryLabel={t('common.merge')}
          secondaryLabel={t('common.cancel')}
          onPrimary={() => {
            const p = renameCollisionPending;
            setRenameCollisionPending(null);
            void runBulkMerge(p.fromClassId, p.toClassId);
          }}
          onSecondary={() => setRenameCollisionPending(null)}
          onClose={() => setRenameCollisionPending(null)}
        />
      )}

      {bulkDialog === 'delete' && (
        <BulkDeleteClassDialog
          classes={state.classes}
          perClassCounts={state.perClassCounts}
          onConfirm={(classId) => {
            setBulkDialog(null);
            void runBulkDelete(classId);
          }}
          onCancel={() => setBulkDialog(null)}
        />
      )}
      {bulkDialog === 'rename' && (
        <BulkRenameClassDialog
          classes={state.classes}
          onConfirm={(classId, newName) => {
            setBulkDialog(null);
            void handleRenameClass(classId, newName);
          }}
          onCancel={() => setBulkDialog(null)}
        />
      )}
      {bulkDialog === 'merge' && (
        <BulkMergeClassDialog
          classes={state.classes}
          perClassCounts={state.perClassCounts}
          onConfirm={(fromId, toId) => {
            setBulkDialog(null);
            void runBulkMerge(fromId, toId);
          }}
          onCancel={() => setBulkDialog(null)}
        />
      )}
      {bulkDialog === 'remap' && (
        <BulkRemapDialog
          classes={state.classes}
          perClassCounts={state.perClassCounts}
          onConfirm={(mapping) => {
            setBulkDialog(null);
            void runBulkRemap(mapping);
          }}
          onCancel={() => setBulkDialog(null)}
        />
      )}

      {bulkOp && (
        <BulkProgressDialog
          title={bulkOp.title}
          update={bulkProgress}
          onCancel={bulkCancelRequested ? undefined : requestBulkCancel}
        />
      )}

      {bulkDeleteProgress && (
        <BulkDeleteImagesProgressDialog
          current={bulkDeleteProgress.current}
          total={bulkDeleteProgress.total}
        />
      )}

      {settingsDialogOpen && (
        <SettingsDialog
          initial={state.userSettings}
          onSave={handleSaveSettings}
          onCancel={onCloseSettingsDialog}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {deletePending?.kind === 'single' && (
        <DeleteImageConfirmDialog
          filename={deletePending.filename}
          annotationsCount={deletePending.annotationsCount}
          hadLabelFile={deletePending.hadLabelFile}
          onConfirm={() => {
            const p = deletePending;
            setDeletePending(null);
            void performDeleteSingle(p.filename);
          }}
          onCancel={() => setDeletePending(null)}
        />
      )}
      {deletePending?.kind === 'bulk' && (
        <DeleteImagesBulkConfirmDialog
          imageCount={deletePending.filenames.length}
          totalAnnotationsApprox={deletePending.totalAnnotationsApprox}
          annotationsApprox={deletePending.annotationsApprox}
          onConfirm={() => {
            const p = deletePending;
            setDeletePending(null);
            void performDeleteBulk(p.filenames);
          }}
          onCancel={() => setDeletePending(null)}
        />
      )}

      {pendingAction && (
        <UnsavedChangesDialog
          onSaveAndContinue={() => {
            const action = pendingAction;
            setPendingAction(null);
            void (async () => {
              const ok = await saveCurrentNow();
              if (!ok) return;
              if (action.kind === 'switch') {
                dispatch({ type: 'SELECT_IMAGE', filename: action.filename });
              } else if (action.kind === 'close') {
                void api.confirmClose();
              }
            })();
          }}
          onDiscard={() => {
            const action = pendingAction;
            setPendingAction(null);
            const s = stateRef.current;
            if (s.phase === 'loaded' && s.currentImage) {
              void api.loadAnnotations(s.root, s.currentImage).then((res) => {
                if (res.ok) {
                  dispatch({
                    type: 'LOAD_BBOXES',
                    filename: s.currentImage!,
                    bboxes: res.bboxes
                  });
                }
                if (action.kind === 'switch') {
                  dispatch({ type: 'SELECT_IMAGE', filename: action.filename });
                } else if (action.kind === 'close') {
                  void api.confirmClose();
                }
              });
            } else if (action.kind === 'close') {
              void api.confirmClose();
            }
          }}
          onCancel={() => {
            const action = pendingAction;
            setPendingAction(null);
            if (action.kind === 'close') void api.cancelClose();
          }}
        />
      )}
    </div>
  );
}

function progressUserName(
  settings: UserSettings | undefined,
  progress: ProgressFile | null
): string {
  return settings?.username ?? progress?.last_opened_by ?? 'user';
}

function formatBulkResult(t: TranslateFn, r: BulkOpResult & { ok: true }): string {
  const parts: string[] = [];
  if (r.removedAnnotations !== undefined && r.removedAnnotations > 0) {
    parts.push(t('toast.bulkStats.removed', { count: r.removedAnnotations }));
  }
  if (r.remappedAnnotations !== undefined && r.remappedAnnotations > 0) {
    parts.push(t('toast.bulkStats.remapped', { count: r.remappedAnnotations }));
  }
  parts.push(t('toast.bulkStats.files', { count: r.affectedFiles }));
  return parts.join(', ');
}
