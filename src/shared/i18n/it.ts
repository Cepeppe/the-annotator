/**
 * Italian message catalog. Every key of `en.ts` must be present here: the
 * compile-time check in `catalog.ts` fails the build otherwise.
 */
export const it = {
  // ---- Generic actions ----
  'common.ok': 'OK',
  'common.cancel': 'Annulla',
  'common.save': 'Salva',
  'common.delete': 'Elimina',
  'common.close': 'Chiudi',
  'common.add': 'Aggiungi',
  'common.rename': 'Rinomina',
  'common.merge': 'Unisci',
  'common.preview': 'Anteprima',
  'common.continue': 'Continua',

  // ---- Application menu (main process) ----
  'menu.file': 'File',
  'menu.file.openDataset': 'Apri dataset...',
  'menu.file.openRecent': 'Apri recenti',
  'menu.file.noRecent': '(nessun dataset recente)',
  'menu.file.settings': 'Impostazioni...',
  'menu.file.quit': 'Esci',
  'menu.view': 'Visualizza',
  'menu.view.reload': 'Ricarica',
  'menu.view.devTools': 'Strumenti sviluppatore',
  'menu.view.actualSize': 'Zoom originale',
  'menu.view.zoomIn': 'Aumenta zoom',
  'menu.view.zoomOut': 'Riduci zoom',
  'menu.view.lightTheme': 'Tema chiaro',
  'menu.view.darkTheme': 'Tema scuro',
  'menu.view.language': 'Lingua',
  'menu.view.fullScreen': 'Schermo intero',
  'menu.tools': 'Strumenti',
  'menu.tools.bulk': 'Operazioni bulk',
  'menu.tools.bulk.delete': 'Elimina tutte le istanze di una classe...',
  'menu.tools.bulk.rename': 'Rinomina una classe in tutto il dataset...',
  'menu.tools.bulk.merge': 'Unisci due classi...',
  'menu.tools.bulk.remap': 'Remap class_id (avanzato)...',
  'menu.tools.recomputeStats': 'Ricalcola statistiche',
  'menu.help': 'Aiuto',
  'menu.help.shortcuts': 'Scorciatoie da tastiera',
  'menu.help.about': 'Informazioni',

  // ---- Language names ----
  'language.system': 'Lingua di sistema',
  'language.en': 'English',
  'language.it': 'Italiano',

  // ---- Native dialogs (main process) ----
  'nativeDialog.selectDatasetFolder': 'Seleziona la cartella del dataset',

  // ---- Welcome screen ----
  'welcome.tagline': 'Rifinisci le annotazioni dei tuoi dataset YOLO.',
  'welcome.openDataset': 'Apri dataset',
  'welcome.opening': 'Apertura in corso...',
  'welcome.recentDatasets': 'Dataset recenti',
  'welcome.lastOpened': 'ultimo accesso {date}',
  'welcome.step1': 'Seleziona la cartella del dataset (deve contenere data.yaml, images/, labels/).',
  'welcome.step2': 'Verifica le classi e naviga le immagini dalla lista laterale.',
  'welcome.step3': "Clicca un'immagine per vederne i riquadri esistenti sul canvas.",

  // ---- Top bar ----
  'topBar.summary': '{images} immagini - {classes} classi',
  'topBar.openAnother': 'Apri altro',
  'topBar.openAnother.title': 'Apri un altro dataset',
  'topBar.status': 'Stato',
  'topBar.filter.title': 'Filtra le immagini per stato',
  'topBar.filter.all': 'Tutte',
  'topBar.filter.pending': 'Da fare',
  'topBar.filter.completed': 'Completate',
  'topBar.search.placeholder': 'Cerca per nome file...',
  'topBar.search.title': "Cerca un'immagine per nome file (senza distinzione tra maiuscole e minuscole)",
  'topBar.search.clear': 'Cancella ricerca',
  'topBar.progress': '{completed} / {total} completate ({percent}%)',

  // ---- Image list ----
  'imageGrid.count.one': '{count} immagine',
  'imageGrid.count.other': '{count} immagini',
  'imageGrid.ofTotal': ' su {total}',
  'imageGrid.selected.one': '{count} selezionata',
  'imageGrid.selected.other': '{count} selezionate',
  'imageGrid.empty.noImages': 'Nessuna immagine nella cartella selezionata.',
  'imageGrid.empty.noResults': 'Nessun risultato per questa ricerca.',
  'imageGrid.empty.noResults.hint': 'Prova con un altro nome oppure cancella il filtro.',
  'imageGrid.empty.allDone': 'Tutte le immagini sono completate.',
  'imageGrid.empty.allDone.hint': 'Cambia il filtro in "Tutte" per rivederle.',
  'imageGrid.empty.noneDone': 'Nessuna immagine ancora completata.',
  'imageGrid.empty.noneDone.hint': "Marca un'immagine come completata per vederla qui.",
  'imageGrid.empty.nothing': 'Nessuna immagine da mostrare.',
  'imageGridItem.status.done': 'Completata',
  'imageGridItem.status.toDo': 'Da fare',
  'imageGridItem.status.empty': 'Vuota',
  'imageGridItem.status.doneTitle': 'Completata',
  'imageGridItem.status.pendingWithBoxes': 'Da fare (con annotazioni)',
  'imageGridItem.status.pendingEmpty': 'Da fare (senza annotazioni)',
  'imageGridItem.delete.title': 'Elimina questa immagine dal dataset',
  'imageGridItem.delete.aria': 'Elimina {filename}',

  // ---- Canvas toolbar ----
  'toolbar.mode.select': 'Seleziona',
  'toolbar.mode.select.tooltip': 'Seleziona riquadri (S)',
  'toolbar.mode.draw': 'Disegna',
  'toolbar.mode.draw.tooltip':
    "Disegna un nuovo riquadro: primo click sul primo angolo, secondo click sull'angolo opposto. Esc annulla. (D)",
  'toolbar.zoomOut.title': 'Riduci (-)',
  'toolbar.zoomIn.title': 'Ingrandisci (+)',
  'toolbar.fit': 'Adatta',
  'toolbar.fit.title': 'Adatta alla finestra (R)',
  'toolbar.pixelGrid.show': 'Mostra la griglia pixel (visibile a zoom alti)',
  'toolbar.pixelGrid.hide': 'Nascondi la griglia pixel',
  'toolbar.rulers.show': 'Mostra i righelli sui bordi',
  'toolbar.rulers.hide': 'Nascondi i righelli',
  'toolbar.undo': 'Annulla',
  'toolbar.undo.title': 'Annulla (Ctrl+Z)',
  'toolbar.redo': 'Ripeti',
  'toolbar.redo.title': 'Ripeti (Ctrl+Y)',
  'toolbar.save': 'Salva',
  'toolbar.save.title': 'Salva ora (Ctrl+S)',
  'toolbar.markPending': 'Marca da fare',
  'toolbar.markPending.title': 'Marca come da fare (Ctrl+Shift+M)',
  'toolbar.markDone': 'Marca completata e prossima',
  'toolbar.markDone.title': "Marca come completata e passa all'immagine successiva (Spazio)",
  'toolbar.currentClass': 'Classe corrente',
  'toolbar.noClassSelected': 'Nessuna classe selezionata',
  'toolbar.saveStatus.saving': 'Salvataggio in corso...',
  'toolbar.saveStatus.dirty': 'Modifiche non salvate',
  'toolbar.saveStatus.error': 'Errore di salvataggio',
  'toolbar.saveStatus.saved': 'Salvato',

  // ---- Secondary (advanced) toolbar ----
  'advancedToolbar.label': 'Avanzate',
  'advancedToolbar.tooltip':
    "Operazioni meno frequenti e potenzialmente distruttive: l'eliminazione di un'immagine non chiede conferma. In caso di errore, l'immagine e la sua annotazione sono recuperabili a mano entro 30 giorni dalla cartella .annotation-progress-cache/trash/ nella radice del dataset.",
  'advancedToolbar.hint':
    "Operazioni meno frequenti (per esempio eliminare un'immagine dal dataset)",
  'advancedToolbar.deleteImage': 'Elimina questa immagine dal dataset',

  // ---- Canvas ----
  'canvas.empty': "Seleziona un'immagine dalla lista a sinistra per visualizzarla.",
  'canvas.loading': 'Caricamento in corso...',
  'canvas.error.openImage': "Impossibile aprire l'immagine: {reason}",
  'canvas.error.loadImage': 'Caricamento immagine fallito: {message}',
  'canvas.error.unexpected': 'Errore inatteso: {message}',
  'canvas.unknownClass': '??? (id={classId})',
  'canvas.boxCount.one': '{count} riquadro',
  'canvas.boxCount.other': '{count} riquadri',
  'canvas.selectedCount': '{count} selezionati',
  'canvas.zoom': 'Zoom {percent}%',

  // ---- Classes sidebar ----
  'classes.title': 'Classi',
  'classes.add': 'Aggiungi',
  'classes.add.title': 'Aggiungi classe',
  'classes.empty': 'Nessuna classe definita. Aggiungi la prima con il bottone qui sopra.',
  'classes.footer': '{classes} classi - {annotations} annotazioni',
  'classRow.renameHint': "{name} - doppio-click oppure l'icona a matita per rinominare",
  'classRow.moveUp.title': 'Sposta su (id minore)',
  'classRow.moveUp.aria': 'Sposta la classe in alto',
  'classRow.moveDown.title': 'Sposta giù (id maggiore)',
  'classRow.moveDown.aria': 'Sposta la classe in basso',
  'classRow.rename.title': 'Rinomina classe',
  'classRow.rename.aria': 'Rinomina classe',
  'classRow.delete.title': 'Elimina la classe "{name}"',
  'classRow.delete.aria': 'Elimina classe',

  // ---- Add class dialog ----
  'addClass.title': 'Aggiungi classe',
  'addClass.nameLabel': 'Nome della classe',
  'addClass.namePlaceholder': 'es. backhoe_loader',
  'addClass.collision': 'Esiste già una classe con questo nome.',
  'addClass.colorPreview': 'Anteprima colore (calcolato dal nome)',
  'addClass.hueSwatch': 'Tonalità {degrees} gradi',
  'addClass.colorNote':
    'Il colore viene calcolato dal nome della classe in modo stabile: classi con lo stesso nome hanno sempre lo stesso colore, in qualsiasi dataset.',

  // ---- Delete class confirmation ----
  'deleteClass.title': 'Elimina classe',
  'deleteClass.messageWithAnnotations':
    'Stai per eliminare la classe "{name}" e tutte le sue {count} annotazioni nel dataset. Operazione irreversibile (ma registrata nel log operazioni).',
  'deleteClass.messageNoAnnotations':
    'Stai per eliminare la classe "{name}". Non ha annotazioni associate, quindi viene rimossa solo da data.yaml.',

  // ---- Rename collision (offer to merge) ----
  'mergeOnRename.title': 'Unisci classi',
  'mergeOnRename.messageWithAnnotations':
    'Esiste già una classe "{to}". Vuoi unire "{from}" con "{to}"?\n\nTutte le {count} annotazioni di "{from}" diventeranno "{to}". La classe "{from}" sarà rimossa da data.yaml e gli id delle classi successive saranno compattati. Viene creato un backup automatico.',
  'mergeOnRename.messageNoAnnotations':
    'Esiste già una classe "{to}". Vuoi unire "{from}" con "{to}"?\n\nLa classe "{from}" non ha annotazioni: sarà semplicemente rimossa da data.yaml e gli id delle classi successive saranno compattati.',

  // ---- Bulk: delete class ----
  'bulkDeleteClass.title': 'Elimina tutte le istanze di una classe',
  'bulkDeleteClass.classLabel': 'Classe da eliminare',
  'bulkDeleteClass.previewHint':
    'Clicca Anteprima per vedere quante annotazioni sono coinvolte prima di procedere.',
  'bulkDeleteClass.previewOne':
    'Verrà eliminata {count} annotazione della classe {name} in tutto il dataset. La classe viene rimossa anche da data.yaml. Operazione irreversibile (ma registrata nel log).',
  'bulkDeleteClass.previewOther':
    'Verranno eliminate {count} annotazioni della classe {name} in tutto il dataset. La classe viene rimossa anche da data.yaml. Operazione irreversibile (ma registrata nel log).',
  'bulkDeleteClass.confirm': 'Conferma eliminazione',

  // ---- Bulk: merge classes ----
  'bulkMerge.title': 'Unisci due classi',
  'bulkMerge.fromLabel': 'Classe sorgente (verrà eliminata)',
  'bulkMerge.toLabel': 'Classe di destinazione',
  'bulkMerge.sameClass': 'Le due classi devono essere diverse.',
  'bulkMerge.previewHint': 'Clicca Anteprima per vedere quante annotazioni saranno spostate.',
  'bulkMerge.previewOne':
    '{count} annotazione di {from} diventerà {to}. La classe {from} sarà rimossa da data.yaml e gli id delle classi successive saranno compattati.',
  'bulkMerge.previewOther':
    '{count} annotazioni di {from} diventeranno {to}. La classe {from} sarà rimossa da data.yaml e gli id delle classi successive saranno compattati.',

  // ---- Bulk: rename class ----
  'bulkRename.title': 'Rinomina classe',
  'bulkRename.classLabel': 'Classe da rinominare',
  'bulkRename.newNameLabel': 'Nuovo nome',
  'bulkRename.collision': "Esiste già un'altra classe con questo nome.",
  'bulkRename.note':
    "Viene aggiornato solo data.yaml (l'id della classe non cambia, quindi i file .txt di annotazione non vengono toccati).",

  // ---- Bulk: remap class ids ----
  'bulkRemap.title': 'Remap class_id (avanzato)',
  'bulkRemap.intro':
    'Imposta più riassegnazioni di id classe contemporaneamente. Le righe con sorgente e destinazione uguali vengono ignorate. Tutto viene applicato in un unico batch.',
  'bulkRemap.removeRow': 'Rimuovi riga',
  'bulkRemap.addRow': 'Aggiungi riga',
  'bulkRemap.impact': 'Verranno riassegnate {count} annotazioni in totale.',
  'bulkRemap.apply': 'Applica remap',
  'bulkRemap.error.noClasses': 'Nessuna classe disponibile.',
  'bulkRemap.error.invalidClass': 'Una delle classi selezionate non è valida.',
  'bulkRemap.error.duplicateSource':
    'La classe {classId} compare più volte come sorgente: ogni id può essere mappato una sola volta.',

  // ---- Bulk progress ----
  'bulkProgress.phase.scanning': 'Analisi del dataset in corso',
  'bulkProgress.phase.backup': 'Creazione del backup di sicurezza',
  'bulkProgress.phase.applying': 'Applicazione delle modifiche',
  'bulkProgress.phase.rollback': 'Ripristino dal backup',
  'bulkProgress.phase.done': 'Completato',
  'bulkProgress.preparing': 'Preparazione',
  'bulkProgress.files': '{current} / {total} file ({percent}%)',
  'bulkProgress.backupNote':
    'Una copia di sicurezza dei file modificati viene salvata automaticamente in .annotation-progress-cache/backup/ dentro la cartella del dataset.',

  // ---- Bulk operation titles (used in progress dialog and toasts) ----
  'bulkOp.cancelled': 'Operazione annullata',
  'bulkOp.deleteClass': 'Eliminazione classe',
  'bulkOp.mergeClasses': 'Unione classi',
  'bulkOp.remapClassIds': 'Remap class_id',
  'bulkOp.moveClassUp': 'Spostamento della classe "{name}" in alto',
  'bulkOp.moveClassDown': 'Spostamento della classe "{name}" in basso',

  // ---- Bulk image deletion progress ----
  'bulkDeleteImages.title': 'Eliminazione immagini in corso',
  'bulkDeleteImages.progress': '{current} di {total} immagini elaborate ({percent}%)',
  'bulkDeleteImages.note': 'Sposto le immagini selezionate nel cestino del tool.',

  // ---- Delete image confirmation ----
  'deleteImage.title': 'Elimina immagine dal dataset',
  'deleteImage.withBoxes.one': ' insieme alla sua annotazione ({count} riquadro)',
  'deleteImage.withBoxes.other': ' insieme alla sua annotazione ({count} riquadri)',
  'deleteImage.withoutBoxes': ' (nessuna annotazione associata)',
  'deleteImage.message':
    "Stai per eliminare l'immagine {filename} dal dataset{details}.\n\nL'immagine viene spostata nel cestino del tool e può essere recuperata a mano entro 30 giorni dalla cartella .annotation-progress-cache/trash/.\n\nContinuare?",
  'deleteImagesBulk.title.one': 'Elimina {count} immagine dal dataset',
  'deleteImagesBulk.title.other': 'Elimina {count} immagini dal dataset',
  'deleteImagesBulk.annotations.one': ', per un totale di {approx}{count} annotazione',
  'deleteImagesBulk.annotations.other': ', per un totale di {approx}{count} annotazioni',
  'deleteImagesBulk.noAnnotations': ' (nessuna annotazione associata)',
  'deleteImagesBulk.message.one':
    'Stai per eliminare {count} immagine{details}.\n\nLe immagini vengono spostate nel cestino del tool e possono essere recuperate a mano entro 30 giorni dalla cartella .annotation-progress-cache/trash/.\n\nContinuare?',
  'deleteImagesBulk.message.other':
    'Stai per eliminare {count} immagini{details}.\n\nLe immagini vengono spostate nel cestino del tool e possono essere recuperate a mano entro 30 giorni dalla cartella .annotation-progress-cache/trash/.\n\nContinuare?',

  // ---- Out-of-range banner ----
  'outOfRange.message.one':
    '{count} annotazione usa un id classe che non esiste (su {files}). Aprila per decidere se assegnarle una classe esistente o eliminarla.',
  'outOfRange.message.other':
    '{count} annotazioni usano id classe che non esistono (su {files}). Aprile per decidere se assegnare una classe esistente o eliminarle.',
  'outOfRange.files.one': '{count} immagine',
  'outOfRange.files.other': '{count} immagini',
  'outOfRange.goToNext': 'Vai alla prossima ({filename})',

  // ---- Context menu on an image ----
  'imageMenu.open': 'Apri',
  'imageMenu.markPending': 'Marca da fare',
  'imageMenu.markDone': 'Marca completata',
  'imageMenu.deleteSelected': 'Elimina selezionate ({count})',
  'imageMenu.delete': 'Elimina dal dataset',

  // ---- Unsaved changes ----
  'unsaved.title': 'Modifiche non salvate',
  'unsaved.message':
    "L'immagine corrente ha modifiche non salvate. Vuoi salvarle prima di continuare?",
  'unsaved.discard': 'Scarta modifiche',
  'unsaved.saveAndContinue': 'Salva e prosegui',

  // ---- Settings ----
  'settings.title': 'Impostazioni',
  'settings.sections': 'Sezioni',
  'settings.section.general': 'Generale',
  'settings.section.appearance': 'Aspetto',
  'settings.section.model': 'Modello',
  'settings.section.advanced': 'Avanzate',
  'settings.username': 'Nome utente',
  'settings.username.placeholder': 'es. anna',
  'settings.username.hint':
    'Registrato come autore delle immagini completate e di ogni voce del log operazioni.',
  'settings.theme': "Tema dell'interfaccia",
  'settings.theme.light': 'Chiaro',
  'settings.theme.dark': 'Scuro',
  'settings.theme.hint': 'Il tema cambia subito dopo il salvataggio.',
  'settings.language': "Lingua dell'interfaccia",
  'settings.language.hint': 'Applicata subito dopo il salvataggio.',
  'settings.modelPath': 'Percorso del file modello ONNX (.onnx)',
  'settings.modelPath.placeholder': 'es. C:\\modelli\\safety_v2.onnx',
  'settings.modelPath.hint':
    'Il pre-labeling assistito da modello non è ancora implementato. Per ora il percorso viene solo memorizzato.',
  'settings.logs': "Log dell'applicazione",
  'settings.logs.open': 'Apri la cartella dei log',
  'settings.logs.error': 'Impossibile aprire la cartella dei log.',
  'settings.logs.hint':
    'Il file app-debug.log registra gli eventi importanti del tool: utile per chi ti aiuta a diagnosticare i problemi.',

  // ---- Keyboard shortcuts ----
  'shortcuts.title': 'Scorciatoie da tastiera',
  'shortcuts.footer':
    'Suggerimento: tutte le funzioni sono raggiungibili anche col mouse dalla toolbar e dai menu. Le scorciatoie sono opzionali.',
  'shortcuts.group.navigation': 'Navigazione immagini',
  'shortcuts.group.canvasModes': 'Modi del canvas',
  'shortcuts.group.boxes': 'Riquadri',
  'shortcuts.group.zoom': 'Zoom e pan',
  'shortcuts.group.saving': 'Salvataggio e undo',
  'shortcuts.group.dataset': 'Operazioni sul dataset',
  'shortcuts.key.nextImage': 'Immagine successiva',
  'shortcuts.key.prevImage': 'Immagine precedente',
  'shortcuts.key.firstImage': 'Prima immagine del filtro corrente',
  'shortcuts.key.lastImage': 'Ultima immagine del filtro corrente',
  'shortcuts.key.markDone': "Marca come completata e passa all'immagine successiva",
  'shortcuts.key.markPending': 'Marca come da fare',
  'shortcuts.key.selectMode': 'Modalità Seleziona',
  'shortcuts.key.drawMode': 'Modalità Disegna',
  'shortcuts.key.deleteBoxes': 'Elimina i riquadri selezionati nel canvas',
  'shortcuts.key.clearSelection': 'Annulla la selezione corrente',
  'shortcuts.key.copyPaste': 'Copia / incolla riquadri',
  'shortcuts.key.classDigits': 'Cambia la classe del riquadro selezionato (classi 0-9)',
  'shortcuts.key.classDigitsCtrl': 'Cambia la classe (classi 10-19)',
  'shortcuts.key.wheelZoom': 'Zoom centrato sul cursore',
  'shortcuts.key.zoomInOut': 'Zoom avanti / indietro',
  'shortcuts.key.fit': 'Adatta alla finestra',
  'shortcuts.key.saveNow': 'Salva subito',
  'shortcuts.key.undo': 'Annulla',
  'shortcuts.key.redo': 'Ripeti',
  'shortcuts.key.deleteImages':
    'Elimina dal dataset (lista immagini, con una selezione attiva)',
  'shortcuts.key.openDataset': 'Apri dataset',
  'shortcuts.key.openSettings': 'Apri Impostazioni',
  'shortcuts.key.showHelp': 'Mostra questa guida',
  'shortcuts.keys.space': 'Spazio',
  'shortcuts.keys.wheel': 'Ctrl + rotellina',

  // ---- About ----
  'about.title': 'Informazioni su the-annotator',
  'about.description':
    'È uno strumento desktop per disegnare riquadri (bbox) su dataset YOLO.',
  'about.version': 'Versione: {version}',
  'about.runtime': 'Electron {electron}, Chromium {chromium}, Node {node}',
  'about.trash.title': 'Cestino del tool',
  'about.trash.body':
    'Le immagini eliminate vengono conservate per 30 giorni nella cartella .annotation-progress-cache/trash/ dentro il dataset, raggruppate per data di eliminazione.',
  'about.trash.restore':
    "Per recuperare un'immagine, copia i file images/<nome> e labels/<nome>.txt dal cestino nelle rispettive cartelle del dataset, poi riapri il tool.",

  // ---- Credit strip ----
  'credit.developedBy': 'Sviluppato da Cepeppe',
  'credit.openProfile': 'Apri il profilo GitHub di Cepeppe',

  // ---- Error boundary ----
  'errorBoundary.title': 'Si è verificato un errore inaspettato',
  'errorBoundary.body':
    "Il tool ha incontrato un problema e una parte dell'interfaccia non risponde più come dovrebbe. Puoi:\n\n- ricaricare il tool (consigliato: il dataset corrente è a un click di distanza nella lista dei recenti);\n- copiare il log dell'errore negli appunti, per condividerlo con chi ti supporta;\n- provare a continuare a tuo rischio, sapendo che alcune funzioni potrebbero comportarsi in modo imprevedibile.\n\n",
  'errorBoundary.continue': 'Continua a tuo rischio',
  'errorBoundary.copyLog': 'Copia il log',
  'errorBoundary.reload': 'Ricarica il tool',
  'errorBoundary.log.header': 'the-annotator error log ({timestamp})',
  'errorBoundary.log.message': 'Messaggio: {message}',
  'errorBoundary.log.stack': 'Stack:',
  'errorBoundary.log.noStack': '(nessuno stack disponibile)',
  'errorBoundary.log.componentStack': 'Component stack:',

  // ---- Dataset opening errors (renderer) ----
  'openError.invalidStructure.title': 'Dataset non valido',
  'openError.invalidStructure.message':
    'La cartella selezionata non sembra contenere un dataset YOLO valido: manca {missing}.',
  'openError.missing.dataYaml': 'data.yaml',
  'openError.missing.imagesDir': 'la cartella images/',
  'openError.missing.labelsDir': 'la cartella labels/',
  'openError.createEmptyYaml': 'Crea un data.yaml vuoto',
  'openError.yaml.title': 'Errore nel file data.yaml',
  'openError.folderMissing.title': 'Cartella non trovata',
  'openError.folderMissing.message':
    'La cartella "{path}" non è più disponibile ed è stata rimossa dai recenti.',
  'openError.io.title': 'Errore di lettura',
  'openError.createYamlFailed.title': 'Impossibile creare data.yaml',
  'openError.saveSettingsFailed.title': 'Impossibile salvare le impostazioni',

  // ---- Orphan cleanup notice ----
  'orphanCleanup.title': 'Dataset ripulito',
  'orphanCleanup.removedOrphans':
    'Dataset ripulito: rimossi {count} file di annotazione orfani (senza immagine corrispondente). Sono recuperabili da .annotation-progress-cache/trash/ per 30 giorni.',
  'orphanCleanup.createdEmpty':
    'Creati {count} file di annotazione vuoti per immagini che non ne avevano.',
  'orphanCleanup.createdEmptyOnly':
    'Dataset ripulito: creati {count} file di annotazione vuoti per immagini che non ne avevano.',

  // ---- Toasts ----
  'toast.saved': 'Salvato',
  'toast.saveFailed': 'Errore di salvataggio',
  'toast.nothingToSave': 'Nessuna modifica da salvare',
  'toast.allImagesDone': 'Tutte le immagini sono completate.',
  'toast.settingsUpdated': 'Impostazioni aggiornate.',
  'toast.settingsSaveFailed': 'Impossibile salvare le impostazioni: {reason}',
  'toast.progressCorrupted':
    'Il file di stato era corrotto, ne è stato creato uno nuovo. Il vecchio si trova in {path}.',
  'toast.progressUnreadable': 'Impossibile leggere il file di stato: {reason}',
  'toast.trashCleaned.one': 'Cestino: rimossa {count} cartella più vecchia di {days} giorni.',
  'toast.trashCleaned.other': 'Cestino: rimosse {count} cartelle più vecchie di {days} giorni.',
  'toast.classExists': 'Esiste già una classe "{name}".',
  'toast.classAdded': 'Classe "{name}" aggiunta.',
  'toast.classRenamed': 'Classe rinominata in "{name}".',
  'toast.classDeleted': 'Classe "{name}" eliminata.',
  'toast.dataYamlWriteFailed': 'Impossibile scrivere data.yaml: {reason}',
  'toast.saveBeforeDeleteFailed':
    'Impossibile salvare le modifiche correnti. Eliminazione annullata.',
  'toast.saveBeforeBulkFailed':
    'Impossibile salvare le modifiche correnti. Operazione bulk annullata.',
  'toast.bulkFailedRolledBack':
    'Operazione interrotta: {reason}. Le modifiche sono state annullate.',
  'toast.bulkFailedNotRolledBack':
    'Operazione interrotta: {reason}. Attenzione: il rollback è fallito, verifica i file.',
  'toast.bulkDone': '{title} completata: {stats}.',
  'toast.bulkStats.removed': '{count} annotazioni eliminate',
  'toast.bulkStats.remapped': '{count} annotazioni riassegnate',
  'toast.bulkStats.files': '{count} file modificati',
  'toast.imageTrashed': 'Immagine "{filename}" spostata nel cestino{details}.',
  'toast.imageTrashed.details': ' ({count} annotazioni rimosse)',
  'toast.imagesTrashed.one': '{count} immagine spostata nel cestino{details}.',
  'toast.imagesTrashed.other': '{count} immagini spostate nel cestino{details}.',
  'toast.imagesTrashed.partial': '{ok} eliminate, {failed} fallite.{example}',
  'toast.imagesTrashed.example': ' Esempio di fallimento ({filename}): {reason}',
  'toast.deleteFailed.permission':
    'Permesso negato sul file. Verifica i permessi della cartella del dataset.',
  'toast.deleteFailed.locked':
    'Il file sembra aperto in un altro programma. Chiudilo e riprova.',
  'toast.deleteFailed.notFound': 'Il file immagine non è più presente nella cartella.',
  'toast.deleteFailed.unknown': "Errore inatteso durante l'eliminazione.",

  // ---- Main process: file system messages ----
  'fs.error.readDataYaml': 'Impossibile leggere data.yaml: {message}',
  'fs.error.dataYamlAtLine': 'Errore in data.yaml alla riga {line}: {message}',
  'fs.error.dataYaml': 'Errore in data.yaml: {message}',
  'fs.error.imageUnreadable': 'Immagine non leggibile, oppure formato non supportato',
  'fs.save.permissionDenied':
    'Impossibile scrivere il file di annotazione di "{filename}". Permessi insufficienti sulla cartella labels/.',
  'fs.save.fileLocked':
    'Impossibile salvare "{filename}". Il file potrebbe essere aperto in un altro programma. Chiudilo e riprova.',
  'fs.save.diskFull': 'Spazio su disco esaurito durante il salvataggio di "{filename}".',
  'fs.save.generic': 'Errore durante il salvataggio di "{filename}": {message}',
  'fs.save.recoveryNote': '\nUna copia di sicurezza è stata scritta in: {path}',

  // ---- data.yaml parsing ----
  'yaml.error.parse': 'Impossibile analizzare data.yaml',
  'yaml.error.notAMap': 'data.yaml non contiene una mappa valida',
  'yaml.error.missingNames': 'data.yaml non contiene il campo "names"',
  'yaml.error.namesShape': 'Il campo "names" deve essere una lista o una mappa',
  'yaml.error.notSerializable': 'data.yaml non è serializzabile'
} as const;
