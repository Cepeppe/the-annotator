import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode
} from 'react';
import type {
  BBoxYolo,
  FilterState,
  FilterStatus,
  ImageIndexEntry,
  OperationLogEntry,
  OutOfRangeAnnotation,
  ProgressFile,
  UserSettings
} from '@shared/types';
import {
  applyDelta,
  applyOpForward,
  applyOpInverse,
  canRedo as stackCanRedo,
  canUndo as stackCanUndo,
  countsDeltaForward,
  countsDeltaInverse,
  createUndoStack,
  popRedo,
  popUndo,
  pushOp,
  selectionAfterOp,
  type BBoxLocal,
  type UndoableOp,
  type UndoStack
} from '@shared/undoStack';
import { DEFAULT_LANGUAGE_PREFERENCE } from '@shared/i18n';

export type EditMode = 'select' | 'draw';
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'error';

export interface ImageEditState {
  bboxes: BBoxLocal[];
  imageSize: { width: number; height: number } | null;
  isDirty: boolean;
  lastSavedAt: string | null;
  undo: UndoStack;
}

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

export type DatasetState =
  | { phase: 'welcome' }
  | {
      phase: 'loaded';
      root: string;
      classes: string[];
      images: ImageIndexEntry[];
      currentImage: string | null;
      perImage: Map<string, ImageEditState>;
      lru: string[];
      mode: EditMode;
      currentClassId: number;
      selectedBboxIds: string[];
      view: ViewState;
      lockZoom: boolean;
      clipboard: BBoxYolo[];
      saveStatus: SaveStatus;
      lastSaveError: string | null;
      progressFile: ProgressFile | null;
      perClassCounts: Record<number, number>;
      outOfRangeBboxes: OutOfRangeAnnotation[];
      progressDirty: boolean;
      filter: FilterState;
      userSettings: UserSettings;
      selectedGridImages: string[];
      gridSelectionAnchor: string | null;
    };

const PER_IMAGE_LRU_LIMIT = 50;
const DEFAULT_VIEW: ViewState = { zoom: 1, panX: 0, panY: 0 };

let bboxIdCounter = 0;
export function nextBboxId(): string {
  bboxIdCounter += 1;
  return `bx_${bboxIdCounter}`;
}

export type DatasetAction =
  | {
      type: 'OPEN_DATASET';
      root: string;
      classes: string[];
      images: ImageIndexEntry[];
    }
  | { type: 'SELECT_IMAGE'; filename: string }
  | { type: 'LOAD_IMAGE_META'; filename: string; width: number; height: number }
  | { type: 'LOAD_BBOXES'; filename: string; bboxes: BBoxYolo[] }
  | { type: 'SET_MODE'; mode: EditMode }
  | { type: 'SET_CURRENT_CLASS_ID'; classId: number }
  | { type: 'SET_SELECTION'; ids: string[] }
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'APPLY_OP'; op: UndoableOp }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_SAVING' }
  | { type: 'MARK_SAVED'; filename: string; savedAt: string }
  | { type: 'MARK_SAVE_ERROR'; message: string }
  | { type: 'SET_VIEW'; view: ViewState }
  | { type: 'TOGGLE_LOCK_ZOOM' }
  | { type: 'SET_CLIPBOARD'; bboxes: BBoxYolo[] }
  | { type: 'LOAD_PROGRESS'; progress: ProgressFile }
  | {
      type: 'UPDATE_STATS';
      perClassCounts: Record<number, number>;
      totalAnnotations: number;
      totalImages: number;
      outOfRange: OutOfRangeAnnotation[];
    }
  | { type: 'APPEND_OPERATION_LOG'; entry: OperationLogEntry }
  | { type: 'ADD_CUSTOM_CLASS'; name: string }
  | { type: 'SET_CLASSES'; classes: string[] }
  | { type: 'ADD_CLASS'; name: string }
  | { type: 'RENAME_CLASS'; classId: number; newName: string }
  | { type: 'APPLY_CLASS_REMAP'; newClasses: string[]; mapping: Record<number, number | null> }
  | { type: 'MARK_PROGRESS_SAVED' }
  | { type: 'MARK_COMPLETED'; filename: string; at: string; by: string }
  | { type: 'MARK_PENDING'; filename: string }
  | { type: 'SET_FILTER_STATUS'; status: FilterStatus }
  | { type: 'SET_FILTER_SEARCH'; query: string }
  | { type: 'RESET_FILTER' }
  | { type: 'SET_USER_SETTINGS'; settings: UserSettings }
  | { type: 'SET_GRID_SELECTION'; filenames: string[]; anchor?: string | null }
  | { type: 'CLEAR_GRID_SELECTION' }
  | { type: 'REMOVE_IMAGES'; filenames: string[]; perClassCountsDelta: Record<number, number>; totalAnnotationsRemoved: number }
  | { type: 'CLOSE_DATASET' };

const initialState: DatasetState = { phase: 'welcome' };

const DEFAULT_FILTER: FilterState = { status: 'pending', searchQuery: '' };
const DEFAULT_USER_SETTINGS: UserSettings = {
  username: 'user',
  theme: 'light',
  language: DEFAULT_LANGUAGE_PREFERENCE,
  modelPath: null,
  showPixelGrid: false,
  showRulers: false
};

function emptyEditState(): ImageEditState {
  return {
    bboxes: [],
    imageSize: null,
    isDirty: false,
    lastSavedAt: null,
    undo: createUndoStack()
  };
}

function ensureEntry(map: Map<string, ImageEditState>, filename: string): ImageEditState {
  return map.get(filename) ?? emptyEditState();
}

function bumpLru(lru: string[], filename: string): string[] {
  const filtered = lru.filter((f) => f !== filename);
  filtered.push(filename);
  return filtered;
}

function evictIfNeeded(
  perImage: Map<string, ImageEditState>,
  lru: string[],
  protect: string | null
): { perImage: Map<string, ImageEditState>; lru: string[] } {
  if (lru.length <= PER_IMAGE_LRU_LIMIT) return { perImage, lru };
  const newMap = new Map(perImage);
  const newLru = [...lru];
  while (newLru.length > PER_IMAGE_LRU_LIMIT) {
    const victim = newLru.find((f) => f !== protect);
    if (!victim) break;
    newMap.delete(victim);
    const idx = newLru.indexOf(victim);
    newLru.splice(idx, 1);
  }
  return { perImage: newMap, lru: newLru };
}

function reducer(state: DatasetState, action: DatasetAction): DatasetState {
  switch (action.type) {
    case 'OPEN_DATASET': {
      const prevSettings: UserSettings =
        state.phase === 'loaded' ? state.userSettings : DEFAULT_USER_SETTINGS;
      return {
        phase: 'loaded',
        root: action.root,
        classes: action.classes,
        images: action.images,
        currentImage: null,
        perImage: new Map(),
        lru: [],
        mode: 'select',
        currentClassId: 0,
        selectedBboxIds: [],
        view: DEFAULT_VIEW,
        lockZoom: false,
        clipboard: [],
        saveStatus: 'idle',
        lastSaveError: null,
        progressFile: null,
        perClassCounts: {},
        outOfRangeBboxes: [],
        progressDirty: false,
        filter: { ...DEFAULT_FILTER },
        userSettings: prevSettings,
        selectedGridImages: [],
        gridSelectionAnchor: null
      };
    }
    case 'SET_USER_SETTINGS': {
      if (state.phase !== 'loaded') return state;
      return { ...state, userSettings: action.settings };
    }
    case 'CLOSE_DATASET':
      return initialState;
    default:
      if (state.phase !== 'loaded') return state;
      return reducerLoaded(state, action);
  }
}

function reducerLoaded(
  state: Extract<DatasetState, { phase: 'loaded' }>,
  action: DatasetAction
): DatasetState {
  switch (action.type) {
    case 'SELECT_IMAGE': {
      const lru = bumpLru(state.lru, action.filename);
      const evicted = evictIfNeeded(state.perImage, lru, action.filename);
      return {
        ...state,
        currentImage: action.filename,
        selectedBboxIds: [],
        view: state.lockZoom ? state.view : DEFAULT_VIEW,
        saveStatus: deriveSaveStatus(evicted.perImage, action.filename),
        lastSaveError: null,
        perImage: evicted.perImage,
        lru: evicted.lru
      };
    }
    case 'LOAD_IMAGE_META': {
      const entry = ensureEntry(state.perImage, action.filename);
      const next: ImageEditState = {
        ...entry,
        imageSize: { width: action.width, height: action.height }
      };
      const map = new Map(state.perImage);
      map.set(action.filename, next);
      return { ...state, perImage: map };
    }
    case 'LOAD_BBOXES': {
      const entry = ensureEntry(state.perImage, action.filename);
      const bboxes: BBoxLocal[] = action.bboxes.map((b) => ({ id: nextBboxId(), ...b }));
      const next: ImageEditState = {
        ...entry,
        bboxes,
        isDirty: false,
        lastSavedAt: entry.lastSavedAt,
        undo: createUndoStack()
      };
      const map = new Map(state.perImage);
      map.set(action.filename, next);
      return {
        ...state,
        perImage: map,
        saveStatus: state.currentImage === action.filename ? 'idle' : state.saveStatus
      };
    }
    case 'SET_MODE':
      return { ...state, mode: action.mode };
    case 'SET_CURRENT_CLASS_ID':
      return { ...state, currentClassId: action.classId };
    case 'SET_SELECTION':
      return { ...state, selectedBboxIds: dedupe(action.ids) };
    case 'TOGGLE_SELECTION': {
      const set = new Set(state.selectedBboxIds);
      if (set.has(action.id)) set.delete(action.id);
      else set.add(action.id);
      return { ...state, selectedBboxIds: [...set] };
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedBboxIds: [] };
    case 'APPLY_OP': {
      if (!state.currentImage) return state;
      const filename = state.currentImage;
      const entry = ensureEntry(state.perImage, filename);
      const bboxes = applyOpForward(entry.bboxes, action.op);
      const undo = pushOp(entry.undo, action.op);
      const map = new Map(state.perImage);
      map.set(filename, { ...entry, bboxes, undo, isDirty: true });
      const newCounts = applyDelta(state.perClassCounts, countsDeltaForward(action.op));
      return {
        ...state,
        perImage: map,
        selectedBboxIds: selectionAfterOp(state.selectedBboxIds, action.op, false),
        saveStatus: 'dirty',
        lastSaveError: null,
        perClassCounts: newCounts
      };
    }
    case 'UNDO': {
      if (!state.currentImage) return state;
      const filename = state.currentImage;
      const entry = ensureEntry(state.perImage, filename);
      const popped = popUndo(entry.undo);
      if (!popped) return state;
      const bboxes = applyOpInverse(entry.bboxes, popped.op);
      const map = new Map(state.perImage);
      map.set(filename, { ...entry, bboxes, undo: popped.next, isDirty: true });
      const newCounts = applyDelta(state.perClassCounts, countsDeltaInverse(popped.op));
      return {
        ...state,
        perImage: map,
        selectedBboxIds: selectionAfterOp(state.selectedBboxIds, popped.op, true),
        saveStatus: 'dirty',
        lastSaveError: null,
        perClassCounts: newCounts
      };
    }
    case 'REDO': {
      if (!state.currentImage) return state;
      const filename = state.currentImage;
      const entry = ensureEntry(state.perImage, filename);
      const popped = popRedo(entry.undo);
      if (!popped) return state;
      const bboxes = applyOpForward(entry.bboxes, popped.op);
      const map = new Map(state.perImage);
      map.set(filename, { ...entry, bboxes, undo: popped.next, isDirty: true });
      const newCounts = applyDelta(state.perClassCounts, countsDeltaForward(popped.op));
      return {
        ...state,
        perImage: map,
        selectedBboxIds: selectionAfterOp(state.selectedBboxIds, popped.op, false),
        saveStatus: 'dirty',
        lastSaveError: null,
        perClassCounts: newCounts
      };
    }
    case 'MARK_SAVING':
      return { ...state, saveStatus: 'saving' };
    case 'MARK_SAVED': {
      const entry = state.perImage.get(action.filename);
      if (!entry) return { ...state, saveStatus: 'idle' };
      const map = new Map(state.perImage);
      map.set(action.filename, { ...entry, isDirty: false, lastSavedAt: action.savedAt });
      const isCurrent = state.currentImage === action.filename;
      return {
        ...state,
        perImage: map,
        saveStatus: isCurrent ? 'idle' : state.saveStatus,
        lastSaveError: isCurrent ? null : state.lastSaveError
      };
    }
    case 'MARK_SAVE_ERROR':
      return { ...state, saveStatus: 'error', lastSaveError: action.message };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'TOGGLE_LOCK_ZOOM':
      return { ...state, lockZoom: !state.lockZoom };
    case 'SET_CLIPBOARD':
      return { ...state, clipboard: action.bboxes };
    case 'LOAD_PROGRESS':
      return { ...state, progressFile: action.progress, progressDirty: false };
    case 'UPDATE_STATS': {
      if (!state.progressFile) {
        return {
          ...state,
          perClassCounts: action.perClassCounts,
          outOfRangeBboxes: action.outOfRange
        };
      }
      const perClassCountsByName: Record<string, number> = {};
      for (const [idStr, count] of Object.entries(action.perClassCounts)) {
        const id = Number(idStr);
        const name = state.classes[id];
        if (name) perClassCountsByName[name] = count;
      }
      const completedCount = Object.keys(state.progressFile.completed_images).length;
      const newProgress: ProgressFile = {
        ...state.progressFile,
        stats_snapshot: {
          ...state.progressFile.stats_snapshot,
          total_images: action.totalImages,
          total_annotations: action.totalAnnotations,
          per_class_counts: perClassCountsByName,
          completed: completedCount,
          pending: Math.max(0, action.totalImages - completedCount)
        }
      };
      return {
        ...state,
        progressFile: newProgress,
        perClassCounts: action.perClassCounts,
        outOfRangeBboxes: action.outOfRange,
        progressDirty: true
      };
    }
    case 'APPEND_OPERATION_LOG': {
      if (!state.progressFile) return state;
      const newProgress: ProgressFile = {
        ...state.progressFile,
        operations_log: [...state.progressFile.operations_log, action.entry]
      };
      return { ...state, progressFile: newProgress, progressDirty: true };
    }
    case 'ADD_CUSTOM_CLASS': {
      if (!state.progressFile) return state;
      if (state.progressFile.custom_classes_added.includes(action.name)) return state;
      const newProgress: ProgressFile = {
        ...state.progressFile,
        custom_classes_added: [...state.progressFile.custom_classes_added, action.name]
      };
      return { ...state, progressFile: newProgress, progressDirty: true };
    }
    case 'SET_CLASSES': {
      const safeCurrent = Math.min(state.currentClassId, Math.max(0, action.classes.length - 1));
      return { ...state, classes: action.classes, currentClassId: safeCurrent };
    }
    case 'ADD_CLASS': {
      const newClasses = [...state.classes, action.name];
      const newPerCount = { ...state.perClassCounts };
      newPerCount[newClasses.length - 1] = newPerCount[newClasses.length - 1] ?? 0;
      return {
        ...state,
        classes: newClasses,
        currentClassId: newClasses.length - 1,
        perClassCounts: newPerCount
      };
    }
    case 'RENAME_CLASS': {
      const newClasses = state.classes.map((c, i) => (i === action.classId ? action.newName : c));
      return { ...state, classes: newClasses };
    }
    case 'APPLY_CLASS_REMAP': {
      // Dataset-wide bulk op: rebuild the class list, remap the boxes held in
      // memory and drop the undo stacks, which no longer match the file.
      const newPerImage = new Map<string, ImageEditState>();
      for (const [filename, edit] of state.perImage) {
        const newBboxes: BBoxLocal[] = [];
        for (const b of edit.bboxes) {
          const target = action.mapping[b.classId];
          if (target === null || target === undefined) continue;
          newBboxes.push({ ...b, classId: target });
        }
        newPerImage.set(filename, {
          ...edit,
          bboxes: newBboxes,
          undo: createUndoStack(),
          isDirty: false
        });
      }
      const safeCurrent = Math.min(
        state.currentClassId,
        Math.max(0, action.newClasses.length - 1)
      );
      return {
        ...state,
        classes: action.newClasses,
        perImage: newPerImage,
        selectedBboxIds: [],
        currentClassId: safeCurrent,
        saveStatus: deriveSaveStatus(newPerImage, state.currentImage ?? '')
      };
    }
    case 'MARK_PROGRESS_SAVED':
      return { ...state, progressDirty: false };
    case 'MARK_COMPLETED': {
      if (!state.progressFile) return state;
      const prev = state.progressFile.completed_images;
      if (prev[action.filename]) return state;
      const newCompleted = {
        ...prev,
        [action.filename]: { completed_at: action.at, by: action.by }
      };
      const totalImages = state.images.length;
      const completedCount = Object.keys(newCompleted).length;
      const newProgress: ProgressFile = {
        ...state.progressFile,
        completed_images: newCompleted,
        stats_snapshot: {
          ...state.progressFile.stats_snapshot,
          total_images: totalImages,
          completed: completedCount,
          pending: Math.max(0, totalImages - completedCount)
        }
      };
      return { ...state, progressFile: newProgress, progressDirty: true };
    }
    case 'MARK_PENDING': {
      if (!state.progressFile) return state;
      const prev = state.progressFile.completed_images;
      if (!prev[action.filename]) return state;
      const newCompleted: ProgressFile['completed_images'] = { ...prev };
      delete newCompleted[action.filename];
      const totalImages = state.images.length;
      const completedCount = Object.keys(newCompleted).length;
      const newProgress: ProgressFile = {
        ...state.progressFile,
        completed_images: newCompleted,
        stats_snapshot: {
          ...state.progressFile.stats_snapshot,
          total_images: totalImages,
          completed: completedCount,
          pending: Math.max(0, totalImages - completedCount)
        }
      };
      return { ...state, progressFile: newProgress, progressDirty: true };
    }
    case 'SET_FILTER_STATUS':
      if (state.filter.status === action.status) return state;
      return { ...state, filter: { ...state.filter, status: action.status } };
    case 'SET_FILTER_SEARCH':
      if (state.filter.searchQuery === action.query) return state;
      return { ...state, filter: { ...state.filter, searchQuery: action.query } };
    case 'RESET_FILTER':
      return { ...state, filter: { ...DEFAULT_FILTER } };
    case 'SET_GRID_SELECTION': {
      const filenames = dedupe(action.filenames);
      const anchor =
        action.anchor !== undefined
          ? action.anchor
          : filenames.length > 0
            ? (filenames[filenames.length - 1] ?? null)
            : null;
      return { ...state, selectedGridImages: filenames, gridSelectionAnchor: anchor };
    }
    case 'CLEAR_GRID_SELECTION':
      if (state.selectedGridImages.length === 0 && state.gridSelectionAnchor === null) return state;
      return { ...state, selectedGridImages: [], gridSelectionAnchor: null };
    case 'REMOVE_IMAGES': {
      const removeSet = new Set(action.filenames);
      if (removeSet.size === 0) return state;
      const newImages = state.images.filter((e) => !removeSet.has(e.filename));
      const newPerImage = new Map(state.perImage);
      for (const f of removeSet) newPerImage.delete(f);
      const newLru = state.lru.filter((f) => !removeSet.has(f));
      const newGridSelection = state.selectedGridImages.filter((f) => !removeSet.has(f));
      const newGridAnchor =
        state.gridSelectionAnchor && removeSet.has(state.gridSelectionAnchor)
          ? null
          : state.gridSelectionAnchor;
      let newProgress = state.progressFile;
      if (newProgress) {
        const newCompleted: ProgressFile['completed_images'] = { ...newProgress.completed_images };
        for (const f of removeSet) delete newCompleted[f];
        const totalImages = newImages.length;
        const completedCount = Object.keys(newCompleted).length;
        // per_class_counts is keyed by class name: apply the deltas by name.
        const newPerNameCounts: Record<string, number> = {
          ...newProgress.stats_snapshot.per_class_counts
        };
        for (const [idStr, dlt] of Object.entries(action.perClassCountsDelta)) {
          const id = Number(idStr);
          const name = state.classes[id];
          if (!name) continue;
          const cur = newPerNameCounts[name] ?? 0;
          const next = cur + dlt;
          newPerNameCounts[name] = next < 0 ? 0 : next;
        }
        newProgress = {
          ...newProgress,
          completed_images: newCompleted,
          stats_snapshot: {
            ...newProgress.stats_snapshot,
            total_images: totalImages,
            completed: completedCount,
            pending: Math.max(0, totalImages - completedCount),
            total_annotations: Math.max(
              0,
              newProgress.stats_snapshot.total_annotations - action.totalAnnotationsRemoved
            ),
            per_class_counts: newPerNameCounts
          }
        };
      }
      const newPerClassCounts: Record<number, number> = { ...state.perClassCounts };
      for (const [idStr, dlt] of Object.entries(action.perClassCountsDelta)) {
        const id = Number(idStr);
        const cur = newPerClassCounts[id] ?? 0;
        const next = cur + dlt;
        newPerClassCounts[id] = next < 0 ? 0 : next;
      }
      const newOutOfRange = state.outOfRangeBboxes.filter((b) => !removeSet.has(b.filename));
      const newCurrent = state.currentImage && removeSet.has(state.currentImage) ? null : state.currentImage;
      return {
        ...state,
        images: newImages,
        perImage: newPerImage,
        lru: newLru,
        currentImage: newCurrent,
        selectedGridImages: newGridSelection,
        gridSelectionAnchor: newGridAnchor,
        progressFile: newProgress,
        progressDirty: newProgress !== state.progressFile,
        perClassCounts: newPerClassCounts,
        outOfRangeBboxes: newOutOfRange,
        saveStatus: newCurrent === null ? 'idle' : state.saveStatus,
        lastSaveError: newCurrent === null ? null : state.lastSaveError
      };
    }
    default:
      return state;
  }
}

function deriveSaveStatus(perImage: Map<string, ImageEditState>, filename: string): SaveStatus {
  const entry = perImage.get(filename);
  if (!entry) return 'idle';
  return entry.isDirty ? 'dirty' : 'idle';
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

interface DatasetContextValue {
  state: DatasetState;
  dispatch: Dispatch<DatasetAction>;
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error('useDataset must be called inside a DatasetProvider');
  return ctx;
}

export function getCurrentEditState(state: DatasetState): ImageEditState | null {
  if (state.phase !== 'loaded' || !state.currentImage) return null;
  return state.perImage.get(state.currentImage) ?? null;
}

export function canUndoCurrent(state: DatasetState): boolean {
  const edit = getCurrentEditState(state);
  return edit ? stackCanUndo(edit.undo) : false;
}

export function canRedoCurrent(state: DatasetState): boolean {
  const edit = getCurrentEditState(state);
  return edit ? stackCanRedo(edit.undo) : false;
}

export function getCompletedSet(state: DatasetState): Set<string> {
  if (state.phase !== 'loaded' || !state.progressFile) return new Set();
  return new Set(Object.keys(state.progressFile.completed_images));
}

export function isImageCompleted(state: DatasetState, filename: string): boolean {
  if (state.phase !== 'loaded' || !state.progressFile) return false;
  return Boolean(state.progressFile.completed_images[filename]);
}
