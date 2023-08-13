import * as path from 'path';

import { checkFileExists, getFileNames, requireUncached } from '../utils/fs';

export function getFunctionsFromFS(functionsDirectory: string) {
  if (!(checkFileExists(functionsDirectory))) {
    return {};
  }

  const functions: { [name: string]: any } = {};
  const functionFilenames = getFileNames(functionsDirectory);

  for (const functionFilename of functionFilenames) {
    const { name } = path.parse(functionFilename);

    // TODO: Find out why we need to use process.cwd() for require and not readFile.
    const functionPath = path.join(
      process.cwd(),
      functionsDirectory,
      functionFilename
    );

    // TODO: Could this be cached instead?
    const func = requireUncached(functionPath);

    functions[name] = func;
  }

  return functions;
}
