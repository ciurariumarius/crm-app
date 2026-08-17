import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

async function run() {
  const source = await readFile("components/notes/notes-workspace.tsx", "utf8")
  const preferencesSource = await readFile(
    "components/notes/use-notes-workspace-preferences.ts",
    "utf8"
  )
  const notesPageSource = await readFile("app/(dashboard)/notes/page.tsx", "utf8")
  const editorSource = await readFile(
    "components/ui/rich-text-editor.tsx",
    "utf8"
  )
  const projectNotesSource = await readFile(
    "components/projects/project-sheet-content.tsx",
    "utf8"
  )
  const projectActionsSource = await readFile(
    "lib/actions/projects.ts",
    "utf8"
  )
  const noteActionsSource = await readFile(
    "lib/actions/notes.ts",
    "utf8"
  )
  const taskActionsSource = await readFile(
    "lib/actions/tasks.ts",
    "utf8"
  )
  const taskDetailsSource = await readFile(
    "components/tasks/task-details.tsx",
    "utf8"
  )
  const drawingSource = await readFile("components/notes/note-drawing-sheet.tsx", "utf8")
  const drawingNodeSource = await readFile("components/notes/note-drawing-node.tsx", "utf8")

  assert.match(source, /data-note-drag-id=\{note\.id\}/)
  assert.match(source, /draggable=\{!isLinked && !note\.deletedAt && foldersEnabled && !storageUnavailable/)
  assert.match(source, /event\.dataTransfer\.effectAllowed = "move"/)
  assert.match(source, /data-note-drag-preview/)
  assert.match(source, /event\.dataTransfer\.setDragImage\(dragPreview, 12, 18\)/)
  assert.match(source, /h-9 w-max max-w-\[240px\]/)
  assert.match(source, /text-ellipsis whitespace-nowrap/)
  assert.match(source, /data-note-folder-drop-id=\{folder\.id\}/)
  assert.match(source, /data-note-folder-drop-state=\{isDropTarget \? "target" : canDrop \? "eligible" : "idle"\}/)
  assert.match(source, /onDragOver=\{\(event\) => handleFolderDragOver\(event, folder\.id\)\}/)
  assert.match(source, /onDrop=\{\(event\) => handleFolderDrop\(event, folder\)\}/)
  assert.doesNotMatch(source, /data-note-drag-handle/)
  assert.doesNotMatch(source, />\s*Drag\s*</)
  assert.match(source, />\s*Collections\s*</)
  assert.match(source, /<DropdownMenu>/)
  assert.match(source, /group flex h-10 items-center/)
  assert.match(source, /const railCountBadgeClass =/)
  assert.match(source, /getNoteSourceType\(note\) !== "note"/)
  assert.match(source, /updateNote\(note\.id, \{ folderId \}\)/)
  assert.match(source, /toast\.success\(`Moved to \$\{nextFolderName\}`\)/)

  const collectionsSectionIndex = source.indexOf('aria-label="Collections"')
  const foldersSectionIndex = source.indexOf('aria-label="Folders"')
  assert.ok(collectionsSectionIndex >= 0 && foldersSectionIndex > collectionsSectionIndex)

  assert.match(source, /sidebarCollapsed \? null : `\$\{sidebarWidth\}px`/)
  assert.match(source, /listCollapsed \? null : `\$\{listWidth\}px`/)
  assert.match(preferencesSource, /notes\.sidebarWidth/)
  assert.match(preferencesSource, /notes\.listWidth/)
  assert.match(preferencesSource, /notes\.sidebarCollapsed/)
  assert.match(preferencesSource, /notes\.listCollapsed/)
  assert.doesNotMatch(preferencesSource, /notes\.listMode/)
  assert.match(preferencesSource, /notes\.sort/)
  assert.doesNotMatch(source, /NotesScopeSwitch|searchScope|Smart Folders &amp; Tags|Linked Notes/)
  assert.doesNotMatch(notesPageSource, /noteSmartFolder\.findMany|noteTag\.findMany|take: 400|take: 500/)
  assert.match(source, /enqueueSerializedNoteSave/)
  assert.match(source, /isNoteDraftDirty\(draftRevision, savedRevision\)/)
  assert.match(source, /noteDraftRevisionRef/)
  assert.match(source, /noteSavedRevisionRef/)
  assert.match(source, /newlyCreatedNoteIdsRef/)
  assert.match(source, /discardBlankNewNote/)
  assert.match(source, /permanentlyDeleteNote\(noteId\)/)
  assert.match(source, /resolveNoteEditorDraft/)
  assert.match(source, /shouldAcceptNoteEditorChange/)
  assert.match(source, /flushNote\(selectedNote\.id\)/)
  assert.match(source, /handleContentDraftChange\(selectedNote\.id, value\)/)
  assert.match(source, /expectedContent/)
  assert.match(source, /resolveProjectNoteDraftContent/)
  assert.match(source, /clearProjectNoteDraftIfContent/)
  assert.match(source, /const beginNewNote =/)
  assert.doesNotMatch(source, /transientEmptyNoteIdsRef/)
  assert.doesNotMatch(source, /#(?:fff0ad|fff3bd|ffd84d|b38300|8a6700|9a7000)/i)
  assert.doesNotMatch(editorSource, /(?:amber-|#b38300|#fff0ad)/i)
  assert.match(source, /Recently Deleted/)
  assert.match(source, /Project Notes/)
  assert.match(source, /Task Notes/)
  assert.match(source, /mobilePane === "folders"/)
  assert.match(source, /mobilePane === "list"/)
  assert.match(source, /mobilePane === "editor"/)
  assert.match(source, /search=\{/)
  assert.doesNotMatch(source, /subtitle="Capture/)
  assert.match(source, /showImageGallery=\{false\}/)
  assert.match(editorSource, /role: "textbox"/)
  assert.match(editorSource, /autocorrect: "on"/)
  assert.match(editorSource, /autocomplete: "off"/)
  assert.match(drawingSource, /getCoalescedEvents/)
  assert.match(drawingSource, /event\.pointerType === "pen"/)
  assert.match(drawingSource, /getStroke/)
  assert.match(drawingNodeSource, /data-note-drawing-id/)
  assert.match(projectNotesSource, /onBlur=\{flushDescriptionSave\}/)
  assert.match(projectNotesSource, /window\.addEventListener\("pagehide", flushDescriptionSave\)/)
  assert.match(projectNotesSource, /recordProjectNoteDraft/)
  assert.match(projectNotesSource, /queuedDescription !== null/)
  assert.match(projectActionsSource, /PROJECT_NOTE_UPDATE_CONFLICT/)
  assert.match(projectActionsSource, /expectedDescription/)
  assert.match(noteActionsSource, /NOTE_CONTENT_UPDATE_CONFLICT/)
  assert.match(noteActionsSource, /expectedContent/)
  assert.match(noteActionsSource, /where: \{ id: noteId, content: expectedContent \}/)
  assert.match(noteActionsSource, /NOTE_WRITE_PROTOCOL_REJECTED/)
  assert.match(projectActionsSource, /NOTE_WRITE_PROTOCOL_REJECTED/)
  assert.match(taskActionsSource, /NOTE_WRITE_PROTOCOL_REJECTED/)
  assert.match(source, /notesWriteProtocol: NOTES_WRITE_PROTOCOL_VERSION/)
  assert.match(projectNotesSource, /notesWriteProtocol: NOTES_WRITE_PROTOCOL_VERSION/)
  assert.match(taskDetailsSource, /notesWriteProtocol: NOTES_WRITE_PROTOCOL_VERSION/)

  process.stdout.write("verify-notes-drag-drop: ok\n")
}

void run()
