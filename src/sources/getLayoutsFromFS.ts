import * as path from 'path';
import * as fs from 'fs';

import { checkFileExists, getFileNames } from '../utils/fs';

export function getLayoutsFromFS(layoutsDirectory: string) {
  if (!(checkFileExists(layoutsDirectory))) {
    return {};
  }

  const layouts: { [name: string]: string } = {};
  const layoutFilenames = getFileNames(layoutsDirectory);

  for (const layoutFilename of layoutFilenames) {
    const { name } = path.parse(layoutFilename);
    const layoutPath = path.join(layoutsDirectory, layoutFilename);
    const content = fs.readFileSync(layoutPath, 'utf8');

    layouts[name] = content;
  }

  return layouts;
}
