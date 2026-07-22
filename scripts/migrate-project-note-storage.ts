import "dotenv/config"
import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { access, copyFile, mkdir, readdir, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import {
  createSignedProjectNoteUrl,
  getProjectNotesStorageRoot,
  resolveProjectNoteAbsolutePath,
  signProjectNotePath,
} from "../lib/project-note-storage"

const prisma = new PrismaClient()
const PROJECT_NOTE_URL_PATTERN = /\/api\/project-notes\/file\?[^"'<>\s]+/g
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ContentRow = { id: string; content: string }
type FileMove = { sourceRelativePath: string; destinationRelativePath: string; hash: string }

async function exists(filePath: string) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function sha256(filePath: string) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex")
}

async function listFiles(root: string, relativeDirectory = ""): Promise<string[]> {
  const absoluteDirectory = path.join(root, relativeDirectory)
  let entries
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }

  const files: string[] = []
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory.replaceAll(path.sep, "/"), entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(root, relativePath))
    else if (entry.isFile()) files.push(relativePath)
    else throw new Error(`Unsupported storage entry (only files/directories are allowed): ${relativePath}`)
  }
  return files
}

async function getLegacyTenantIds(files: string[]) {
  const ids = new Set<string>()
  const tenantTable = await prisma.$queryRawUnsafe<Array<{ count: number | bigint }>>(
    `SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'tenants'`
  )
  if (Number(tenantTable[0]?.count ?? 0) === 1) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM tenants ORDER BY id`)
    for (const row of rows) ids.add(row.id)
  }
  for (const file of files) {
    const segments = file.split("/")
    if (segments.length >= 3 && UUID_PATTERN.test(segments[0] || "")) ids.add(segments[0])
  }
  return ids
}

function parseProjectNoteUrl(rawUrl: string) {
  const htmlEscaped = rawUrl.includes("&amp;")
  const decodedUrl = rawUrl.replaceAll("&amp;", "&")
  try {
    const url = new URL(decodedUrl, "http://project-notes.local")
    const relativePath = url.searchParams.get("path") || ""
    if (!relativePath) return null
    const expiresAtRaw = url.searchParams.get("exp")
    const expiresAtUnix = expiresAtRaw ? Number.parseInt(expiresAtRaw, 10) : undefined
    return {
      htmlEscaped,
      relativePath,
      expiresAtUnix: Number.isFinite(expiresAtUnix) && (expiresAtUnix ?? 0) > 0 ? expiresAtUnix : undefined,
    }
  } catch {
    return null
  }
}

function buildRewrittenUrl(relativePath: string, expiresAtUnix: number | undefined, htmlEscaped: boolean) {
  const url = expiresAtUnix
    ? createSignedProjectNoteUrl(relativePath, { expiresAtUnix })
    : `/api/project-notes/file?path=${encodeURIComponent(relativePath)}&sig=${signProjectNotePath(relativePath)}`
  return htmlEscaped ? url.replaceAll("&", "&amp;") : url
}

function migrateContentUrls(content: string, legacyTenantIds: Set<string>) {
  let rewrittenCount = 0
  const referencedPaths: string[] = []
  const nextContent = content.replace(PROJECT_NOTE_URL_PATTERN, (rawUrl) => {
    const parsed = parseProjectNoteUrl(rawUrl)
    if (!parsed) return rawUrl
    const segments = parsed.relativePath.split("/")
    const isLegacy = segments.length >= 3 && legacyTenantIds.has(segments[0] || "")
    const nextRelativePath = isLegacy ? segments.slice(1).join("/") : parsed.relativePath
    referencedPaths.push(nextRelativePath)
    if (!isLegacy) return rawUrl
    rewrittenCount += 1
    return buildRewrittenUrl(nextRelativePath, parsed.expiresAtUnix, parsed.htmlEscaped)
  })
  return { content: nextContent, referencedPaths, rewrittenCount }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const storageRoot = path.resolve(getProjectNotesStorageRoot())
  const files = await listFiles(storageRoot)
  const legacyTenantIds = await getLegacyTenantIds(files)
  if (legacyTenantIds.size > 1) {
    throw new Error(`Refusing storage migration: found ${legacyTenantIds.size} legacy tenant directories`)
  }

  const moves: FileMove[] = []
  const failures: string[] = []
  for (const sourceRelativePath of files) {
    const segments = sourceRelativePath.split("/")
    if (segments.length < 3 || !legacyTenantIds.has(segments[0] || "")) continue
    const destinationRelativePath = segments.slice(1).join("/")
    const sourceAbsolutePath = resolveProjectNoteAbsolutePath(sourceRelativePath)
    const destinationAbsolutePath = resolveProjectNoteAbsolutePath(destinationRelativePath)
    const sourceHash = await sha256(sourceAbsolutePath)
    if (await exists(destinationAbsolutePath)) {
      const destinationHash = await sha256(destinationAbsolutePath)
      if (destinationHash !== sourceHash) {
        failures.push(`collision: ${sourceRelativePath} -> ${destinationRelativePath}`)
        continue
      }
    }
    moves.push({ sourceRelativePath, destinationRelativePath, hash: sourceHash })
  }

  const [projects, notes] = await Promise.all([
    prisma.project.findMany({ where: { description: { not: null } }, select: { id: true, description: true } }),
    prisma.note.findMany({ select: { id: true, content: true } }),
  ])
  const projectUpdates: ContentRow[] = []
  const noteUpdates: ContentRow[] = []
  let rewrittenUrls = 0
  const referencedPaths = new Set<string>()

  for (const project of projects) {
    const migrated = migrateContentUrls(project.description || "", legacyTenantIds)
    migrated.referencedPaths.forEach((item) => referencedPaths.add(item))
    rewrittenUrls += migrated.rewrittenCount
    if (migrated.content !== project.description) projectUpdates.push({ id: project.id, content: migrated.content })
  }
  for (const note of notes) {
    const migrated = migrateContentUrls(note.content, legacyTenantIds)
    migrated.referencedPaths.forEach((item) => referencedPaths.add(item))
    rewrittenUrls += migrated.rewrittenCount
    if (migrated.content !== note.content) noteUpdates.push({ id: note.id, content: migrated.content })
  }

  const legacyTenantId = [...legacyTenantIds][0]
  for (const relativePath of referencedPaths) {
    const destinationExists = await exists(resolveProjectNoteAbsolutePath(relativePath))
    const legacyExists = legacyTenantId
      ? await exists(resolveProjectNoteAbsolutePath(`${legacyTenantId}/${relativePath}`))
      : false
    if (!destinationExists && !legacyExists) failures.push(`missing referenced file: ${relativePath}`)
  }

  const summary = {
    dryRun,
    storageRoot,
    legacyTenantIds: [...legacyTenantIds],
    filesInventoried: files.length,
    filesToMove: moves.length,
    projectRowsToRewrite: projectUpdates.length,
    noteRowsToRewrite: noteUpdates.length,
    urlsToResign: rewrittenUrls,
    referencedFiles: referencedPaths.size,
    failures,
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  if (failures.length > 0) throw new Error("Project-note migration preflight failed")
  if (dryRun) return

  for (const move of moves) {
    const source = resolveProjectNoteAbsolutePath(move.sourceRelativePath)
    const destination = resolveProjectNoteAbsolutePath(move.destinationRelativePath)
    await mkdir(path.dirname(destination), { recursive: true })
    if (!await exists(destination)) await copyFile(source, destination, constants.COPYFILE_EXCL)
    if (await sha256(destination) !== move.hash) throw new Error(`Copy verification failed: ${move.destinationRelativePath}`)
  }

  await prisma.$transaction([
    ...projectUpdates.map((row) => prisma.project.update({ where: { id: row.id }, data: { description: row.content } })),
    ...noteUpdates.map((row) => prisma.note.update({ where: { id: row.id }, data: { content: row.content } })),
  ])

  const [verifiedProjects, verifiedNotes] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: projectUpdates.map((row) => row.id) } }, select: { id: true, description: true } }),
    prisma.note.findMany({ where: { id: { in: noteUpdates.map((row) => row.id) } }, select: { id: true, content: true } }),
  ])
  const projectById = new Map(verifiedProjects.map((row) => [row.id, row.description || ""]))
  const noteById = new Map(verifiedNotes.map((row) => [row.id, row.content]))
  if (projectUpdates.some((row) => projectById.get(row.id) !== row.content)) throw new Error("Project URL verification failed")
  if (noteUpdates.some((row) => noteById.get(row.id) !== row.content)) throw new Error("Note URL verification failed")

  for (const move of moves) {
    if (await sha256(resolveProjectNoteAbsolutePath(move.destinationRelativePath)) !== move.hash) {
      throw new Error(`Final file verification failed: ${move.destinationRelativePath}`)
    }
  }
  for (const tenantId of legacyTenantIds) {
    const tenantRoot = path.dirname(resolveProjectNoteAbsolutePath(`${tenantId}/verification-placeholder`))
    if (path.dirname(tenantRoot) !== storageRoot) throw new Error("Refusing to remove unexpected storage directory")
    if (await exists(tenantRoot)) await rm(tenantRoot, { recursive: true })
  }

  process.stdout.write("Project-note storage migration completed and verified.\n")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
