export const NOTES_WRITE_PROTOCOL_VERSION = "2026-08-03-cross-note-v1"

export const NOTES_CLIENT_REFRESH_REQUIRED = "NOTES_CLIENT_REFRESH_REQUIRED"

export const NOTES_CLIENT_REFRESH_MESSAGE =
  "A Notes safety update is available. Reload this page before editing or saving notes."

export function hasCurrentNotesWriteProtocol(value: unknown) {
  return value === NOTES_WRITE_PROTOCOL_VERSION
}
