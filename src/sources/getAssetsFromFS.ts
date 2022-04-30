import * as path from 'path';

import { scanDirectory } from '../utils/fs';

// TODO: Rename interface.
interface AssetsOptions {
  inputDirectory: string;
  outputDirectory: string;
  ignorePathsAndDirectories: string[];
}

function replaceStart(
  targetString: string,
  searchValue: string,
  replaceString: string
): string {
  return replaceString + targetString.slice(searchValue.length);
}

export default async function getAssetsFromFS(
  options: AssetsOptions
): Promise<Asset[]> {
  const files = await scanDirectory(
    options.inputDirectory,
    options.ignorePathsAndDirectories
  );
  const filesWithoutDirectories = files.filter((file) => !file.isDirectory);

  return filesWithoutDirectories.map((file) => {
    // Could use `path.normalize(options.outputDirectory)` at the end instead of empty string.
    const outputPath = replaceStart(
      file.path,
      path.normalize(options.inputDirectory),
      ''
    );

    return {
      filename: file.name,
      inputPath: file.path,
      outputPath: path.join(options.outputDirectory, outputPath)
    };
  });
}
