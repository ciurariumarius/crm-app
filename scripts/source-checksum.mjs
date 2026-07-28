import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

const sourceRoots = [
  "app",
  "components",
  "hooks",
  "lib",
  "prisma",
  "public",
  "scripts",
  "tests",
  "types",
]
const sourceFiles = [
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "prisma.config.ts",
  "proxy.ts",
  "tsconfig.json",
]

function isExcluded(relativePath) {
  return (
    relativePath.includes("/node_modules/") ||
    relativePath.includes("/.next/") ||
    /(?:^|\/)(?:dev\.db|.*\.sqlite)(?:-(?:wal|shm))?$/.test(relativePath) ||
    relativePath.endsWith(".log")
  )
}

async function collectFiles(relativePath, output) {
  if (isExcluded(relativePath)) return
  const absolutePath = path.resolve(relativePath)
  let fileStat
  try {
    fileStat = await stat(absolutePath)
  } catch {
    return
  }
  if (fileStat.isFile()) {
    output.push(relativePath.replaceAll(path.sep, "/"))
    return
  }
  if (!fileStat.isDirectory()) return
  const entries = await readdir(absolutePath)
  for (const entry of entries) {
    await collectFiles(path.join(relativePath, entry), output)
  }
}

const files = []
for (const sourceRoot of sourceRoots) await collectFiles(sourceRoot, files)
for (const sourceFile of sourceFiles) await collectFiles(sourceFile, files)
files.sort()

const manifestHash = createHash("sha256")
for (const file of files) {
  const fileHash = createHash("sha256").update(await readFile(file)).digest("hex")
  manifestHash.update(file)
  manifestHash.update("\0")
  manifestHash.update(fileHash)
  manifestHash.update("\n")
}

process.stdout.write(manifestHash.digest("hex"))
