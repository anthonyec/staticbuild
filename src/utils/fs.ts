import * as fs from 'fs/promises';
import { constants } from 'fs';

const IGNORED_FILES = ['.DS_Store'];

export function requireUncached<T>(module: string): T {
  delete require.cache[require.resolve(module)];
  return require(module);
}

/** Returns `true` if a file exists, otherwise `false`. */
export async function checkFileExists(filePath: string) {
  try {
    await fs.access(filePath, constants.F_OK);
    return true;
  } catch (err: unknown) {
    if (err instanceof Error) {
      // TODO: Fix types
      // @ts-ignore
      if (err.code === 'ENOENT') {
        return false;
      }

      throw new Error(err.message);
    }
  }
}

/** Return names of all directories found at the specified path. */
export async function getDirectoryNames(path: string): Promise<string[]> {
  const entries = await fs.readdir(path, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** Return names of all files found at the specified path. */
export async function getFileNames(path: string): Promise<string[]> {
  const entries = await fs.readdir(path, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => !IGNORED_FILES.includes(entry.name))
    .map((entry) => entry.name);
}
