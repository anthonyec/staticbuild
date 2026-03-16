import * as fs from "fs"
import { constants } from "fs"
import * as path from "path"

const IGNORED_FILES = [".DS_Store"]

export function requireUncached<T>(module: string): T {
  delete require.cache[require.resolve(module)]
  return require(module)
}

/** Returns `true` if a file exists, otherwise `false`. */
export function checkFileExists(filePath: string) {
  try {
    fs.accessSync(filePath, constants.F_OK)
    return true
  } catch (err) {
    if (err instanceof Error) {
      if (err.code === "ENOENT") {
        return false
      }

      throw new Error(err.message)
    }
  }
}

/** Return names of all directories found at the specified path. */
export function getDirectoryNames(directoryPath: string): string[] {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })

  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

/** Return names of all files found at the specified directoryPath. */
export function getFileNames(directoryPath: string): string[] {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => !IGNORED_FILES.includes(entry.name))
    .map((entry) => entry.name)
}

interface File {
  name: string
  filename: string
  path: string
  isDirectory: boolean
  isEmpty: boolean
}

export function scanDirectory(targetDirectory: string, ignorePathsAndDirectories: string[] = []): File[] {
  // Remove `./` from ignored paths.
  const normalizedIgnorePathsAndDirectories = ignorePathsAndDirectories.map(path.normalize)

  function scan(currentTargetDirectory: string) {
    const files: File[] = []
    const entries = fs.readdirSync(currentTargetDirectory, {
      withFileTypes: true,
    })

    for (const entry of entries) {
      const entryPath = path.join(currentTargetDirectory, entry.name)
      const isIgnored = normalizedIgnorePathsAndDirectories.find((pathOrDirectory) =>
        pathOrDirectory.startsWith(entryPath),
      )

      if (isIgnored) continue
      if (IGNORED_FILES.includes(entry.name)) continue

      if (entry.isDirectory()) {
        const subDirectoryFiles = scan(entryPath)
        files.push(...subDirectoryFiles)

        const file = {
          name: path.parse(entry.name).name,
          filename: entry.name,
          path: entryPath,
          isDirectory: true,
          isEmpty: subDirectoryFiles.length === 0,
        }

        files.push(file)
      } else {
        const file = {
          name: path.parse(entry.name).name,
          filename: entry.name,
          path: entryPath,
          isDirectory: false,
          isEmpty: false,
        }

        files.push(file)
      }
    }

    return files
  }

  return scan(targetDirectory)
}

export function deleteFiles(filePaths: string[], expectedDirectoryToDeleteFrom: string, dryRun?: boolean) {
  for (const filePath of filePaths) {
    const isFileInExpectedDirectory = filePath.includes(expectedDirectoryToDeleteFrom)

    if (!isFileInExpectedDirectory) {
      throw new Error(
        `Safety checked failed for deleting file at path "${filePath}" that does not include the expected directory "${expectedDirectoryToDeleteFrom}"`,
      )
    }

    if (dryRun) {
      console.warn("[dry run] delete:", filePath)
    } else {
      fs.rmSync(filePath)
    }
  }
}
