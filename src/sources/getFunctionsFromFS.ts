import * as path from 'path';
import * as fs from 'fs/promises';

import { getFileNames, requireUncached } from '../utils/fs';

export async function getFunctionsFromFS(functionsDirectory: string) {
  const functions: { [name: string]: any } = {};
  const functionFilenames = await getFileNames(functionsDirectory);

  for await (const functionFilename of functionFilenames) {
    const { name } = path.parse(functionFilename);

    // TODO: Find out why we need to use process.cwd() for require and not readFile.
    const functionPath = path.join(process.cwd(), functionsDirectory, functionFilename);

    // TODO: Could this be cached instead?
    const func = requireUncached(functionPath);

    functions[name] = func;
  }

  return functions;
}
