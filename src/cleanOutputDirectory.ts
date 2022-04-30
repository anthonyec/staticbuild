import * as path from 'path';

import { deleteFiles, recursiveReadDirectory } from './utils/fs';

function getExpectedOutputPaths(
  outputDirectory: string,
  pages: Page[],
  assets: Asset[]
): string[] {
  const pageOutputPaths = pages.map((page) =>
    path.relative(outputDirectory, page.outputPath)
  );
  const assetOutputPaths = assets.map((asset) =>
    path.relative(outputDirectory, asset.outputPath)
  );

  return [...pageOutputPaths, ...assetOutputPaths];
}

/**
 * Remove files from output directory that are not expected to be there from built pages or copied assets.
 */
export async function cleanOutputDirectory(
  outputDirectory: string,
  pages: Page[],
  assets: Asset[]
) {
  // TODO: There is a bug with renamed directories leave empty folders around
  // that don't get deleted.

  // TODO: Make clearer, its confusing about which is absolute and relative and why.
  const outputAbsolutePaths = await recursiveReadDirectory(outputDirectory);
  const actualOutputPaths = outputAbsolutePaths.map((outputPath) => {
    return path.relative(outputDirectory, outputPath);
  });
  const expectedOutputPaths = getExpectedOutputPaths(
    outputDirectory,
    pages,
    assets
  );
  const unexpectedOutputPaths = actualOutputPaths.filter(
    (outputPath) => !expectedOutputPaths.includes(outputPath)
  );
  const unexpectedOutputPathsAbsolute = unexpectedOutputPaths.map(
    (unexpectedOutputPath) => {
      return path.join(outputDirectory, unexpectedOutputPath);
    }
  );

  await deleteFiles(unexpectedOutputPathsAbsolute, outputDirectory);
}
