import type { LanguagePreference } from './i18n/types';

export interface BBoxYolo {
  classId: number;
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
}

export interface BBoxGeometry {
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
}

export interface ImageIndexEntry {
  filename: string;
  hasLabelFile: boolean;
}

export type InvalidStructureReason =
  | 'missing_data_yaml'
  | 'missing_images_dir'
  | 'missing_labels_dir';

export interface OrphanCleanupSummary {
  /** Orphan .txt files (no matching image) moved to the trash. */
  removedOrphanTxt: number;
  /** Empty .txt files created for images that had no annotation file. */
  createdEmptyTxt: number;
  trashPath: string | null;
}

export type OpenDatasetOk = {
  ok: true;
  root: string;
  classes: string[];
  images: ImageIndexEntry[];
  orphanCleanup?: OrphanCleanupSummary;
};

export type OpenDatasetError =
  | { ok: false; reason: 'cancelled' }
  | {
      ok: false;
      reason: 'invalid_structure';
      attemptedRoot: string;
      missing: InvalidStructureReason;
    }
  | {
      ok: false;
      reason: 'yaml_parse_error';
      attemptedRoot: string;
      details: string;
    }
  | { ok: false; reason: 'io_error'; attemptedRoot?: string; details: string };

export type OpenDatasetResult = OpenDatasetOk | OpenDatasetError;

export type LoadAnnotationsResult =
  | { ok: true; bboxes: BBoxYolo[]; warnings: string[] }
  | { ok: false; reason: 'parse_error' | 'io_error'; details: string };

export type ImageDataUrlResult =
  | { ok: true; dataUrl: string; width: number; height: number }
  | { ok: false; reason: string };

export type ThumbnailResult =
  | { ok: true; dataUrl: string }
  | { ok: false; reason: string };

export type CreateEmptyDataYamlResult =
  | { ok: true }
  | { ok: false; reason: string };

export type SaveAnnotationsResult =
  | { ok: true; savedAt: string }
  | {
      ok: false;
      reason: 'io_error';
      details: string;
      recoveredTo?: string;
    };

export type OperationLogEntry =
  | { op: 'rename_class'; from: string; to: string; at: string; by: string }
  | {
      op: 'delete_class';
      class: string;
      removed_annotations: number;
      at: string;
      by: string;
    }
  | {
      op: 'merge_class';
      from: string;
      to: string;
      remapped_annotations: number;
      at: string;
      by: string;
    }
  | {
      op: 'remap_class_ids';
      mapping: Array<{ from: number; to: number }>;
      remapped_annotations: number;
      at: string;
      by: string;
    }
  | { op: 'add_class'; name: string; at: string; by: string }
  | {
      op: 'delete_image';
      filename: string;
      had_label_file: boolean;
      annotations_count: number;
      trashed_to: string;
      at: string;
      by: string;
    };

export interface ProgressStatsSnapshot {
  total_images: number;
  completed: number;
  pending: number;
  total_annotations: number;
  per_class_counts: Record<string, number>;
}

export interface ProgressFile {
  schema_version: '1.0';
  dataset_root_name: string;
  last_opened_at: string;
  last_opened_by: string;
  completed_images: Record<string, { completed_at: string; by: string }>;
  custom_classes_added: string[];
  operations_log: OperationLogEntry[];
  stats_snapshot: ProgressStatsSnapshot;
}

export type LoadProgressFileResult =
  | { ok: true; progress: ProgressFile; createdNew: boolean }
  | {
      ok: true;
      progress: ProgressFile;
      createdNew: false;
      recoveredFromBroken: true;
      brokenPath: string;
    }
  | { ok: false; reason: string };

export type SaveProgressFileResult =
  | { ok: true }
  | { ok: false; reason: string };

export type SaveDataYamlResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface OutOfRangeAnnotation {
  filename: string;
  classId: number;
  lineNo: number;
}

export interface ScanDatasetStatsResult {
  totalImages: number;
  totalAnnotations: number;
  perClassCounts: Record<number, number>;
  outOfRangeAnnotations: OutOfRangeAnnotation[];
}

export type BulkOpKind =
  | 'delete_class'
  | 'merge_classes'
  | 'remap_classes'
  | 'reorder_classes';

export type BulkOpMenuKind = 'delete' | 'rename' | 'merge' | 'remap' | 'recompute';

export type BulkOpSuccess = {
  ok: true;
  affectedFiles: number;
  removedAnnotations?: number;
  remappedAnnotations?: number;
  backupPath: string;
};

export type BulkOpFailure = {
  ok: false;
  reason: string;
  rolledBack: boolean;
};

export type BulkOpResult = BulkOpSuccess | BulkOpFailure;

export interface BulkProgressUpdate {
  opId: string;
  phase: 'scanning' | 'backup' | 'applying' | 'rollback' | 'done';
  current: number;
  total: number;
  message?: string;
}

export interface CreateBackupResult {
  ok: true;
  backupPath: string;
}

export type CreateBackupResponse =
  | CreateBackupResult
  | { ok: false; reason: string };

export interface RecentDataset {
  path: string;
  name: string;
  lastOpenedAt: string;
}

export type LoadRecentDatasetsResult =
  | { ok: true; datasets: RecentDataset[] }
  | { ok: false; reason: string };

export type AppTheme = 'light' | 'dark';

export interface UserSettings {
  username: string;
  theme: AppTheme;
  language: LanguagePreference;
  modelPath: string | null;
  showPixelGrid: boolean;
  showRulers: boolean;
}

export type LoadUserSettingsResult =
  | { ok: true; settings: UserSettings }
  | { ok: false; reason: string };

export type SaveUserSettingsResult =
  | { ok: true }
  | { ok: false; reason: string };

export type FilterStatus = 'all' | 'pending' | 'completed';

export interface FilterState {
  status: FilterStatus;
  searchQuery: string;
}

export type DeleteImageFailureReason =
  | 'image_not_found'
  | 'permission_denied'
  | 'file_locked'
  | 'unknown';

export type DeleteImageResult =
  | {
      ok: true;
      filename: string;
      hadLabelFile: boolean;
      annotationsCount: number;
      trashedTo: string;
      removedFromCompleted: boolean;
    }
  | {
      ok: false;
      filename: string;
      reason: DeleteImageFailureReason;
      details?: string;
      rolledBack: boolean;
    };

export interface DeleteBulkResult {
  succeeded: Array<Extract<DeleteImageResult, { ok: true }>>;
  failed: Array<{ filename: string; reason: DeleteImageFailureReason; details?: string }>;
  totalAnnotationsRemoved: number;
}

export interface CleanupResult {
  removed: number;
  freedBytes: number;
}

export interface OpenFolderResult {
  ok: boolean;
  reason?: string;
}

export interface AppInfo {
  version: string;
  electronVersion: string;
  chromiumVersion: string;
  nodeVersion: string;
  platform: string;
  logsFolder: string;
}
