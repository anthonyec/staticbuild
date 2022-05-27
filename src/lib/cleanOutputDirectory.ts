import * as path from 'path';
import * as fs from 'fs/promises';

import { scanDirectory } from '../utils/fs';

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
  const expectedOutputPaths = getExpectedOutputPaths(
    outputDirectory,
    pages,
    assets
  ).map((outputPath) => path.join(outputDirectory, outputPath));

  await scanDirectory(outputDirectory, [], async (file) => {
    // TODO: Rename this long variable.
    const expectedOutputPathsThatStartWithFilePath = expectedOutputPaths.find(
      (expectedOutputPath) => {
        // TODO: Fix start with for folders with similar names, like "example" and "example-2"
        return expectedOutputPath.startsWith(file.path);
      }
    );

    // TODO: This `file.isEmpty` is ducktape over folders with similar name problem.
    // It will eventually delete the empty file, on 2nd build when watching.
    if (!expectedOutputPathsThatStartWithFilePath || file.isEmpty) {
      await fs.rm(file.path, { recursive: true });
    }
  });
}
