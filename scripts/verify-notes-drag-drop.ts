import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

async function run() {
  const source = await readFile("components/notes/notes-workspace.tsx", "utf8")
  const preferencesSource = await readFile(
    "components/notes/use-notes-workspace-preferences.ts",
    "utf8"
  )

  assert.match(source, /data-note-drag-id=\{note\.id\}/)
  assert.match(source, /draggable=\{!isLinked && !note\.deletedAt && foldersEnabled && !storageUnavailable/)
  assert.match(source, /event\.dataTransfer\.effectAllowed = "move"/)
  assert.match(source, /data-note-drag-preview/)
  assert.match(source, /event\.dataTransfer\.setDragImage\(dragPreview, 12, 18\)/)
  assert.match(source, /h-9 w-max max-w-\[240px\]/)
  assert.match(source, /text-ellipsis whitespace-nowrap/)
  assert.match(source, /data-note-folder-drop-id=\{folder\.id\}/)
  assert.match(source, /data-note-folder-drop-state=\{dropState\}/)
  assert.match(source, /onDragOver=\{\(event\) => handleFolderDragOver\(event, folder\.id\)\}/)
  assert.match(source, /onDrop=\{\(event\) => handleFolderDrop\(event, folder\)\}/)
  assert.doesNotMatch(source, /data-note-drag-handle/)
  assert.doesNotMatch(source, />\s*Drag\s*</)
  assert.match(source, />\s*Collections\s*</)
  assert.match(source, /<DropdownMenu>/)
  assert.match(source, /group relative flex h-10 items-center/)
  assert.match(source, /const railCountBadgeClass =/)
  assert.match(source, /group-hover:opacity-0 group-focus-within:opacity-0/)
  assert.match(source, /getNoteSourceType\(note\) !== "note"/)
  assert.match(source, /updateNote\(note\.id, \{ folderId \}\)/)
  assert.match(source, /toast\.success\(`Moved to \$\{nextFolderName\}`\)/)

  const foldersSectionIndex = source.indexOf('aria-labelledby={isMobile ? "mobile-note-folders"')
  const collectionsSectionIndex = source.indexOf('aria-labelledby={isMobile ? "mobile-note-collections"')
  assert.ok(foldersSectionIndex >= 0 && collectionsSectionIndex > foldersSectionIndex)

  assert.match(source, /gridTemplateColumns: `\$\{sidebarWidth\}px 5px \$\{listWidth\}px 5px minmax\(520px, 1fr\)`/)
  assert.match(preferencesSource, /notes\.sidebarWidth/)
  assert.match(preferencesSource, /notes\.listWidth/)
  assert.match(preferencesSource, /notes\.listMode/)
  assert.match(preferencesSource, /notes\.sort/)
  assert.match(source, /Current View/)
  assert.match(source, /All Notes/)
  assert.match(source, /Recently Deleted/)
  assert.match(source, /Smart Folders &amp; Tags/)
  assert.match(source, /Linked Notes/)
  assert.match(source, /mobilePane === "folders"/)
  assert.match(source, /mobilePane === "list"/)
  assert.match(source, /mobilePane === "editor"/)
  assert.match(source, /bg-\[#fff0ad\]/)

  process.stdout.write("verify-notes-drag-drop: ok\n")
}

void run()
