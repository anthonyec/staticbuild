import * as fs from 'fs/promises';
import { constants } from 'fs';

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
    .map((dirent) => dirent.name);
}
