/**
 * English message catalog. This file is the source of truth for the set of
 * translation keys: every other locale is type-checked against `keyof typeof en`
 * in `catalog.ts`, so a missing or misspelled key fails the build.
 *
 * Placeholders use `{name}` and are substituted by `translate()`.
 * Keys ending in `.one` / `.other` are plural variants, selected by `plural()`.
 */
export const en = {
  // ---- Generic actions ----
  'common.ok': 'OK',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'common.add': 'Add',
  'common.rename': 'Rename',
  'common.merge': 'Merge',
  'common.preview': 'Preview',
  'common.continue': 'Continue',

  // ---- Application menu (main process) ----
  'menu.file': 'File',
  'menu.file.openDataset': 'Open dataset...',
  'menu.file.openRecent': 'Open recent',
  'menu.file.noRecent': '(no recent datasets)',
  'menu.file.settings': 'Settings...',
  'menu.file.quit': 'Quit',
  'menu.view': 'View',
  'menu.view.reload': 'Reload',
  'menu.view.devTools': 'Developer tools',
  'menu.view.actualSize': 'Actual size',
  'menu.view.zoomIn': 'Zoom in',
  'menu.view.zoomOut': 'Zoom out',
  'menu.view.lightTheme': 'Light theme',
  'menu.view.darkTheme': 'Dark theme',
  'menu.view.language': 'Language',
  'menu.view.fullScreen': 'Full screen',
  'menu.tools': 'Tools',
  'menu.tools.bulk': 'Bulk operations',
  'menu.tools.bulk.delete': 'Delete every instance of a class...',
  'menu.tools.bulk.rename': 'Rename a class across the dataset...',
  'menu.tools.bulk.merge': 'Merge two classes...',
  'menu.tools.bulk.remap': 'Remap class_id (advanced)...',
  'menu.tools.recomputeStats': 'Recompute statistics',
  'menu.help': 'Help',
  'menu.help.shortcuts': 'Keyboard shortcuts',
  'menu.help.about': 'About',

  // ---- Language names ----
  'language.system': 'System language',
  'language.en': 'English',
  'language.it': 'Italiano',

  // ---- Native dialogs (main process) ----
  'nativeDialog.selectDatasetFolder': 'Select the dataset folder',

  // ---- Welcome screen ----
  'welcome.tagline': 'Refine the annotations of your YOLO datasets.',
  'welcome.openDataset': 'Open dataset',
  'welcome.opening': 'Opening...',
  'welcome.recentDatasets': 'Recent datasets',
  'welcome.lastOpened': 'last opened {date}',
  'welcome.step1': 'Pick the dataset folder (it must contain data.yaml, images/, labels/).',
  'welcome.step2': 'Check the class list and browse the images in the side list.',
  'welcome.step3': 'Click an image to see its existing boxes on the canvas.',

  // ---- Top bar ----
  'topBar.summary': '{images} images - {classes} classes',
  'topBar.openAnother': 'Open another',
  'topBar.openAnother.title': 'Open another dataset',
  'topBar.status': 'Status',
  'topBar.filter.title': 'Filter images by status',
  'topBar.filter.all': 'All',
  'topBar.filter.pending': 'To do',
  'topBar.filter.completed': 'Done',
  'topBar.search.placeholder': 'Search by file name...',
  'topBar.search.title': 'Search an image by file name (case-insensitive)',
  'topBar.search.clear': 'Clear search',
  'topBar.progress': '{completed} / {total} done ({percent}%)',

  // ---- Image list ----
  'imageGrid.count.one': '{count} image',
  'imageGrid.count.other': '{count} images',
  'imageGrid.ofTotal': ' of {total}',
  'imageGrid.selected.one': '{count} selected',
  'imageGrid.selected.other': '{count} selected',
  'imageGrid.empty.noImages': 'No images in the selected folder.',
  'imageGrid.empty.noResults': 'No match for this search.',
  'imageGrid.empty.noResults.hint': 'Try another name or clear the filter.',
  'imageGrid.empty.allDone': 'Every image is done.',
  'imageGrid.empty.allDone.hint': 'Switch the filter to "All" to see them again.',
  'imageGrid.empty.noneDone': 'No image marked as done yet.',
  'imageGrid.empty.noneDone.hint': 'Mark an image as done to see it here.',
  'imageGrid.empty.nothing': 'Nothing to show.',
  'imageGridItem.status.done': 'Done',
  'imageGridItem.status.toDo': 'To do',
  'imageGridItem.status.empty': 'Empty',
  'imageGridItem.status.doneTitle': 'Done',
  'imageGridItem.status.pendingWithBoxes': 'To do (has annotations)',
  'imageGridItem.status.pendingEmpty': 'To do (no annotations)',
  'imageGridItem.delete.title': 'Delete this image from the dataset',
  'imageGridItem.delete.aria': 'Delete {filename}',

  // ---- Canvas toolbar ----
  'toolbar.mode.select': 'Select',
  'toolbar.mode.select.tooltip': 'Select boxes (S)',
  'toolbar.mode.draw': 'Draw',
  'toolbar.mode.draw.tooltip':
    'Draw a new box: 1st click sets one corner, 2nd click sets the opposite corner. Esc cancels. (D)',
  'toolbar.zoomOut.title': 'Zoom out (-)',
  'toolbar.zoomIn.title': 'Zoom in (+)',
  'toolbar.fit': 'Fit',
  'toolbar.fit.title': 'Fit to window (R)',
  'toolbar.pixelGrid.show': 'Show pixel grid (visible at high zoom)',
  'toolbar.pixelGrid.hide': 'Hide pixel grid',
  'toolbar.rulers.show': 'Show rulers along the edges',
  'toolbar.rulers.hide': 'Hide rulers',
  'toolbar.undo': 'Undo',
  'toolbar.undo.title': 'Undo (Ctrl+Z)',
  'toolbar.redo': 'Redo',
  'toolbar.redo.title': 'Redo (Ctrl+Y)',
  'toolbar.save': 'Save',
  'toolbar.save.title': 'Save now (Ctrl+S)',
  'toolbar.markPending': 'Mark as to do',
  'toolbar.markPending.title': 'Mark as to do (Ctrl+Shift+M)',
  'toolbar.markDone': 'Mark done and next',
  'toolbar.markDone.title': 'Mark as done and go to the next image (Space)',
  'toolbar.currentClass': 'Current class',
  'toolbar.noClassSelected': 'No class selected',
  'toolbar.saveStatus.saving': 'Saving...',
  'toolbar.saveStatus.dirty': 'Unsaved changes',
  'toolbar.saveStatus.error': 'Save failed',
  'toolbar.saveStatus.saved': 'Saved',

  // ---- Secondary (advanced) toolbar ----
  'advancedToolbar.label': 'Advanced',
  'advancedToolbar.tooltip':
    'Less frequent, potentially destructive operations: deleting an image does not ask for confirmation. If that was a mistake, the image and its annotation can be restored by hand within 30 days from the .annotation-progress-cache/trash/ folder at the dataset root.',
  'advancedToolbar.hint': 'Less frequent operations (for example deleting an image from the dataset)',
  'advancedToolbar.deleteImage': 'Delete this image from the dataset',

  // ---- Canvas ----
  'canvas.empty': 'Pick an image from the list on the left to display it.',
  'canvas.loading': 'Loading...',
  'canvas.error.openImage': 'Cannot open the image: {reason}',
  'canvas.error.loadImage': 'Image loading failed: {message}',
  'canvas.error.unexpected': 'Unexpected error: {message}',
  'canvas.unknownClass': '??? (id={classId})',
  'canvas.boxCount.one': '{count} box',
  'canvas.boxCount.other': '{count} boxes',
  'canvas.selectedCount': '{count} selected',
  'canvas.zoom': 'Zoom {percent}%',

  // ---- Classes sidebar ----
  'classes.title': 'Classes',
  'classes.add': 'Add',
  'classes.add.title': 'Add class',
  'classes.empty': 'No class defined yet. Add the first one with the button above.',
  'classes.footer': '{classes} classes - {annotations} annotations',
  'classRow.renameHint': '{name} - double-click or use the pencil icon to rename',
  'classRow.moveUp.title': 'Move up (lower id)',
  'classRow.moveUp.aria': 'Move class up',
  'classRow.moveDown.title': 'Move down (higher id)',
  'classRow.moveDown.aria': 'Move class down',
  'classRow.rename.title': 'Rename class',
  'classRow.rename.aria': 'Rename class',
  'classRow.delete.title': 'Delete class "{name}"',
  'classRow.delete.aria': 'Delete class',

  // ---- Add class dialog ----
  'addClass.title': 'Add class',
  'addClass.nameLabel': 'Class name',
  'addClass.namePlaceholder': 'e.g. backhoe_loader',
  'addClass.collision': 'A class with this name already exists.',
  'addClass.colorPreview': 'Colour preview (derived from the name)',
  'addClass.hueSwatch': 'Hue {degrees} degrees',
  'addClass.colorNote':
    'The colour is derived from the class name in a stable way: a class with the same name always gets the same colour, in any dataset.',

  // ---- Delete class confirmation ----
  'deleteClass.title': 'Delete class',
  'deleteClass.messageWithAnnotations':
    'This deletes the class "{name}" and all of its {count} annotations across the dataset. The operation cannot be undone (but it is recorded in the operations log).',
  'deleteClass.messageNoAnnotations':
    'This deletes the class "{name}". It has no annotations, so it is only removed from data.yaml.',

  // ---- Rename collision (offer to merge) ----
  'mergeOnRename.title': 'Merge classes',
  'mergeOnRename.messageWithAnnotations':
    'A class named "{to}" already exists. Do you want to merge "{from}" into "{to}"?\n\nAll {count} annotations of "{from}" become "{to}". The class "{from}" is removed from data.yaml and the ids of the following classes are compacted. A backup is created automatically.',
  'mergeOnRename.messageNoAnnotations':
    'A class named "{to}" already exists. Do you want to merge "{from}" into "{to}"?\n\nThe class "{from}" has no annotations: it is simply removed from data.yaml and the ids of the following classes are compacted.',

  // ---- Bulk: delete class ----
  'bulkDeleteClass.title': 'Delete every instance of a class',
  'bulkDeleteClass.classLabel': 'Class to delete',
  'bulkDeleteClass.previewHint':
    'Click Preview to see how many annotations are affected before going ahead.',
  'bulkDeleteClass.previewOne':
    'This deletes {count} annotation of class {name} across the dataset. The class is also removed from data.yaml. The operation cannot be undone (but it is recorded in the log).',
  'bulkDeleteClass.previewOther':
    'This deletes {count} annotations of class {name} across the dataset. The class is also removed from data.yaml. The operation cannot be undone (but it is recorded in the log).',
  'bulkDeleteClass.confirm': 'Confirm deletion',

  // ---- Bulk: merge classes ----
  'bulkMerge.title': 'Merge two classes',
  'bulkMerge.fromLabel': 'Source class (will be deleted)',
  'bulkMerge.toLabel': 'Target class',
  'bulkMerge.sameClass': 'The two classes must be different.',
  'bulkMerge.previewHint': 'Click Preview to see how many annotations will be moved.',
  'bulkMerge.previewOne':
    '{count} annotation of {from} becomes {to}. The class {from} is removed from data.yaml and the ids of the following classes are compacted.',
  'bulkMerge.previewOther':
    '{count} annotations of {from} become {to}. The class {from} is removed from data.yaml and the ids of the following classes are compacted.',

  // ---- Bulk: rename class ----
  'bulkRename.title': 'Rename class',
  'bulkRename.classLabel': 'Class to rename',
  'bulkRename.newNameLabel': 'New name',
  'bulkRename.collision': 'Another class with this name already exists.',
  'bulkRename.note':
    'Only data.yaml is updated (the class id does not change, so the .txt annotation files are left untouched).',

  // ---- Bulk: remap class ids ----
  'bulkRemap.title': 'Remap class_id (advanced)',
  'bulkRemap.intro':
    'Set several class id reassignments at once. Rows where source and target are the same are ignored. Everything is applied in a single batch.',
  'bulkRemap.removeRow': 'Remove row',
  'bulkRemap.addRow': 'Add row',
  'bulkRemap.impact': 'This reassigns {count} annotations in total.',
  'bulkRemap.apply': 'Apply remap',
  'bulkRemap.error.noClasses': 'No class available.',
  'bulkRemap.error.invalidClass': 'One of the selected classes is not valid.',
  'bulkRemap.error.duplicateSource':
    'Class {classId} appears more than once as a source: each id can only be mapped once.',

  // ---- Bulk progress ----
  'bulkProgress.phase.scanning': 'Scanning the dataset',
  'bulkProgress.phase.backup': 'Creating the safety backup',
  'bulkProgress.phase.applying': 'Applying the changes',
  'bulkProgress.phase.rollback': 'Rolling back from the backup',
  'bulkProgress.phase.done': 'Done',
  'bulkProgress.preparing': 'Preparing',
  'bulkProgress.files': '{current} / {total} files ({percent}%)',
  'bulkProgress.backupNote':
    'A safety copy of the modified files is saved automatically under .annotation-progress-cache/backup/ inside the dataset folder.',

  // ---- Bulk operation titles (used in progress dialog and toasts) ----
  'bulkOp.cancelled': 'Operation cancelled',
  'bulkOp.deleteClass': 'Class deletion',
  'bulkOp.mergeClasses': 'Class merge',
  'bulkOp.remapClassIds': 'class_id remap',
  'bulkOp.moveClassUp': 'Move class "{name}" up',
  'bulkOp.moveClassDown': 'Move class "{name}" down',

  // ---- Bulk image deletion progress ----
  'bulkDeleteImages.title': 'Deleting images',
  'bulkDeleteImages.progress': '{current} of {total} images processed ({percent}%)',
  'bulkDeleteImages.note': 'Moving the selected images to the tool trash.',

  // ---- Delete image confirmation ----
  'deleteImage.title': 'Delete image from the dataset',
  'deleteImage.withBoxes.one': ' along with its annotation ({count} box)',
  'deleteImage.withBoxes.other': ' along with its annotation ({count} boxes)',
  'deleteImage.withoutBoxes': ' (no annotation attached)',
  'deleteImage.message':
    'You are about to delete the image {filename} from the dataset{details}.\n\nThe image is moved to the tool trash and can be restored by hand within 30 days from the .annotation-progress-cache/trash/ folder.\n\nContinue?',
  'deleteImagesBulk.title.one': 'Delete {count} image from the dataset',
  'deleteImagesBulk.title.other': 'Delete {count} images from the dataset',
  'deleteImagesBulk.annotations.one': ', {approx}{count} annotation in total',
  'deleteImagesBulk.annotations.other': ', {approx}{count} annotations in total',
  'deleteImagesBulk.noAnnotations': ' (no annotation attached)',
  'deleteImagesBulk.message.one':
    'You are about to delete {count} image{details}.\n\nThe images are moved to the tool trash and can be restored by hand within 30 days from the .annotation-progress-cache/trash/ folder.\n\nContinue?',
  'deleteImagesBulk.message.other':
    'You are about to delete {count} images{details}.\n\nThe images are moved to the tool trash and can be restored by hand within 30 days from the .annotation-progress-cache/trash/ folder.\n\nContinue?',

  // ---- Out-of-range banner ----
  'outOfRange.message.one':
    '{count} annotation uses a class id that does not exist (across {files}). Open it to decide whether to reassign an existing class or delete it.',
  'outOfRange.message.other':
    '{count} annotations use class ids that do not exist (across {files}). Open them to decide whether to reassign an existing class or delete them.',
  'outOfRange.files.one': '{count} image',
  'outOfRange.files.other': '{count} images',
  'outOfRange.goToNext': 'Go to the next one ({filename})',

  // ---- Context menu on an image ----
  'imageMenu.open': 'Open',
  'imageMenu.markPending': 'Mark as to do',
  'imageMenu.markDone': 'Mark as done',
  'imageMenu.deleteSelected': 'Delete selected ({count})',
  'imageMenu.delete': 'Delete from the dataset',

  // ---- Unsaved changes ----
  'unsaved.title': 'Unsaved changes',
  'unsaved.message':
    'The current image has unsaved changes. Do you want to save them before continuing?',
  'unsaved.discard': 'Discard changes',
  'unsaved.saveAndContinue': 'Save and continue',

  // ---- Settings ----
  'settings.title': 'Settings',
  'settings.sections': 'Sections',
  'settings.section.general': 'General',
  'settings.section.appearance': 'Appearance',
  'settings.section.model': 'Model',
  'settings.section.advanced': 'Advanced',
  'settings.username': 'User name',
  'settings.username.placeholder': 'e.g. anna',
  'settings.username.hint':
    'Recorded as the author of completed images and of every entry in the operations log.',
  'settings.theme': 'Interface theme',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.hint': 'The theme changes as soon as you save.',
  'settings.language': 'Interface language',
  'settings.language.hint': 'Applied immediately after saving.',
  'settings.modelPath': 'ONNX model file path (.onnx)',
  'settings.modelPath.placeholder': 'e.g. C:\\models\\safety_v2.onnx',
  'settings.modelPath.hint':
    'Model-assisted pre-labeling is not implemented yet. For now the path is only stored.',
  'settings.logs': 'Application log',
  'settings.logs.open': 'Open log folder',
  'settings.logs.error': 'Cannot open the log folder.',
  'settings.logs.hint':
    'The app-debug.log file records the important events of the tool: useful for whoever is helping you troubleshoot.',

  // ---- Keyboard shortcuts ----
  'shortcuts.title': 'Keyboard shortcuts',
  'shortcuts.footer':
    'Tip: every feature is also reachable with the mouse from the toolbar and the menus. Shortcuts are optional.',
  'shortcuts.group.navigation': 'Image navigation',
  'shortcuts.group.canvasModes': 'Canvas modes',
  'shortcuts.group.boxes': 'Boxes',
  'shortcuts.group.zoom': 'Zoom and pan',
  'shortcuts.group.saving': 'Saving and undo',
  'shortcuts.group.dataset': 'Dataset operations',
  'shortcuts.key.nextImage': 'Next image',
  'shortcuts.key.prevImage': 'Previous image',
  'shortcuts.key.firstImage': 'First image of the current filter',
  'shortcuts.key.lastImage': 'Last image of the current filter',
  'shortcuts.key.markDone': 'Mark as done and go to the next image',
  'shortcuts.key.markPending': 'Mark as to do',
  'shortcuts.key.selectMode': 'Select mode',
  'shortcuts.key.drawMode': 'Draw mode',
  'shortcuts.key.deleteBoxes': 'Delete the boxes selected on the canvas',
  'shortcuts.key.clearSelection': 'Clear the current selection',
  'shortcuts.key.copyPaste': 'Copy / paste boxes',
  'shortcuts.key.classDigits': 'Change the class of the selected box (classes 0-9)',
  'shortcuts.key.classDigitsCtrl': 'Change the class (classes 10-19)',
  'shortcuts.key.wheelZoom': 'Zoom centred on the cursor',
  'shortcuts.key.zoomInOut': 'Zoom in / out',
  'shortcuts.key.fit': 'Fit to window',
  'shortcuts.key.saveNow': 'Save now',
  'shortcuts.key.undo': 'Undo',
  'shortcuts.key.redo': 'Redo',
  'shortcuts.key.deleteImages': 'Delete from the dataset (image list, with an active selection)',
  'shortcuts.key.openDataset': 'Open dataset',
  'shortcuts.key.openSettings': 'Open Settings',
  'shortcuts.key.showHelp': 'Show this help',
  'shortcuts.keys.space': 'Space',
  'shortcuts.keys.wheel': 'Ctrl + wheel',

  // ---- About ----
  'about.title': 'About the-annotator',
  'about.description': 'is a desktop tool for drawing bounding boxes (bbox) on YOLO datasets.',
  'about.version': 'Version: {version}',
  'about.runtime': 'Electron {electron}, Chromium {chromium}, Node {node}',
  'about.trash.title': 'Tool trash',
  'about.trash.body':
    'Deleted images are kept for 30 days in the .annotation-progress-cache/trash/ folder inside the dataset, grouped by deletion date.',
  'about.trash.restore':
    'To restore an image, copy the files images/<name> and labels/<name>.txt from the trash back into the matching dataset folders, then reopen the tool.',

  // ---- Error boundary ----
  'errorBoundary.title': 'Something went wrong',
  'errorBoundary.body':
    'The tool hit a problem and part of the interface is no longer responding as it should. You can:\n\n- reload the tool (recommended: the current dataset is one click away in the recent list);\n- copy the error log to the clipboard, to share it with whoever supports you;\n- try to continue at your own risk, knowing that some features may behave unpredictably.\n\n',
  'errorBoundary.continue': 'Continue at your own risk',
  'errorBoundary.copyLog': 'Copy log',
  'errorBoundary.reload': 'Reload the tool',
  'errorBoundary.log.header': 'the-annotator error log ({timestamp})',
  'errorBoundary.log.message': 'Message: {message}',
  'errorBoundary.log.stack': 'Stack:',
  'errorBoundary.log.noStack': '(no stack available)',
  'errorBoundary.log.componentStack': 'Component stack:',

  // ---- Dataset opening errors (renderer) ----
  'openError.invalidStructure.title': 'Not a valid dataset',
  'openError.invalidStructure.message':
    'The selected folder does not look like a valid YOLO dataset: {missing} is missing.',
  'openError.missing.dataYaml': 'data.yaml',
  'openError.missing.imagesDir': 'the images/ folder',
  'openError.missing.labelsDir': 'the labels/ folder',
  'openError.createEmptyYaml': 'Create an empty data.yaml',
  'openError.yaml.title': 'Error in data.yaml',
  'openError.folderMissing.title': 'Folder not found',
  'openError.folderMissing.message':
    'The folder "{path}" is no longer available, so it was removed from the recent list.',
  'openError.io.title': 'Read error',
  'openError.createYamlFailed.title': 'Cannot create data.yaml',
  'openError.saveSettingsFailed.title': 'Cannot save the settings',

  // ---- Orphan cleanup notice ----
  'orphanCleanup.title': 'Dataset tidied up',
  'orphanCleanup.removedOrphans':
    'Dataset tidied up: removed {count} orphan annotation files (no matching image). They can be recovered from .annotation-progress-cache/trash/ for 30 days.',
  'orphanCleanup.createdEmpty':
    'Created {count} empty annotation files for images that had none.',
  'orphanCleanup.createdEmptyOnly':
    'Dataset tidied up: created {count} empty annotation files for images that had none.',

  // ---- Toasts ----
  'toast.saved': 'Saved',
  'toast.saveFailed': 'Save failed',
  'toast.nothingToSave': 'No change to save',
  'toast.allImagesDone': 'Every image is done.',
  'toast.settingsUpdated': 'Settings updated.',
  'toast.settingsSaveFailed': 'Cannot save the settings: {reason}',
  'toast.progressCorrupted':
    'The progress file was corrupted, so a new one was created. The old one is at {path}.',
  'toast.progressUnreadable': 'Cannot read the progress file: {reason}',
  'toast.trashCleaned.one': 'Trash: removed {count} folder older than {days} days.',
  'toast.trashCleaned.other': 'Trash: removed {count} folders older than {days} days.',
  'toast.classExists': 'A class named "{name}" already exists.',
  'toast.classAdded': 'Class "{name}" added.',
  'toast.classRenamed': 'Class renamed to "{name}".',
  'toast.classDeleted': 'Class "{name}" deleted.',
  'toast.dataYamlWriteFailed': 'Cannot write data.yaml: {reason}',
  'toast.saveBeforeDeleteFailed': 'Cannot save the current changes. Deletion cancelled.',
  'toast.saveBeforeBulkFailed': 'Cannot save the current changes. Bulk operation cancelled.',
  'toast.bulkFailedRolledBack':
    'Operation stopped: {reason}. The changes have been rolled back.',
  'toast.bulkFailedNotRolledBack':
    'Operation stopped: {reason}. Warning: the rollback failed, please check your files.',
  'toast.bulkDone': '{title} finished: {stats}.',
  'toast.bulkStats.removed': '{count} annotations deleted',
  'toast.bulkStats.remapped': '{count} annotations reassigned',
  'toast.bulkStats.files': '{count} files changed',
  'toast.imageTrashed': 'Image "{filename}" moved to the trash{details}.',
  'toast.imageTrashed.details': ' ({count} annotations removed)',
  'toast.imagesTrashed.one': '{count} image moved to the trash{details}.',
  'toast.imagesTrashed.other': '{count} images moved to the trash{details}.',
  'toast.imagesTrashed.partial': '{ok} deleted, {failed} failed.{example}',
  'toast.imagesTrashed.example': ' Example failure ({filename}): {reason}',
  'toast.deleteFailed.permission':
    'Permission denied on the file. Check the permissions of the dataset folder.',
  'toast.deleteFailed.locked': 'The file seems to be open in another program. Close it and retry.',
  'toast.deleteFailed.notFound': 'The image file is no longer in the folder.',
  'toast.deleteFailed.unknown': 'Unexpected error while deleting.',

  // ---- Main process: file system messages ----
  'fs.error.readDataYaml': 'Cannot read data.yaml: {message}',
  'fs.error.dataYamlAtLine': 'Error in data.yaml at line {line}: {message}',
  'fs.error.dataYaml': 'Error in data.yaml: {message}',
  'fs.error.imageUnreadable': 'Image not readable, or format not supported',
  'fs.save.permissionDenied':
    'Cannot write the annotation file for "{filename}". Not enough permissions on the labels/ folder.',
  'fs.save.fileLocked':
    'Cannot save "{filename}". The file may be open in another program. Close it and retry.',
  'fs.save.diskFull': 'The disk ran out of space while saving "{filename}".',
  'fs.save.generic': 'Error while saving "{filename}": {message}',
  'fs.save.recoveryNote': '\nA safety copy was written to: {path}',

  // ---- data.yaml parsing ----
  'yaml.error.parse': 'Could not parse data.yaml',
  'yaml.error.notAMap': 'data.yaml does not contain a valid mapping',
  'yaml.error.missingNames': 'data.yaml does not contain the "names" field',
  'yaml.error.namesShape': 'The "names" field must be a list or a mapping',
  'yaml.error.notSerializable': 'data.yaml cannot be serialized'
} as const;
