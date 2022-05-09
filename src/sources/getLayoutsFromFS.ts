import * as path from 'path';
import * as fs from 'fs/promises';

import { checkFileExists, getFileNames } from '../utils/fs';

export async function getLayoutsFromFS(layoutsDirectory: string) {
  if (!(await checkFileExists(layoutsDirectory))) {
    return {};
  }

  const layouts: { [name: string]: string } = {};
  const layoutFilenames = await getFileNames(layoutsDirectory);

  for await (const layoutFilename of layoutFilenames) {
    const { name } = path.parse(layoutFilename);
    const layoutPath = path.join(layoutsDirectory, layoutFilename);
    const content = await fs.readFile(layoutPath, 'utf8');

    layouts[name] = content;
  }

  return layouts;
}
