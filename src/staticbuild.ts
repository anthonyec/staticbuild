import * as fs from 'fs/promises';
import * as path from 'path';

import { getUserConfig } from './config';
import { getLayoutsFromFS } from './sources/getLayoutsFromFS';
import { getFunctionsFromFS } from './sources/getFunctionsFromFS';
import { renderPages } from './renderPages';
import { deleteFiles, recursiveReadDirectory } from './utils/fs';
import { watchDirectoryForChanges } from './watchDirectoryForChanges';

interface StaticBuildOptions {
  /** Specify an input folder containing website source files */
  inputDirectory: string;
  /** Specify an output folder for the website to be built to */
  outputDirectory: string;
  /** Specify path of the website config file */
  configPath: string;
  /** Watch files in the `outputDirectory and build when they change */
  watch?: boolean;
}

// TODO: Rewrite and tidy up.
function getCollectionsFromPages(pages: Page[]): { [key: string]: Page[] } {
  return pages.reduce((acc, page) => {
    if (page.collection) {
      // @ts-ignore
      if (!acc[page.collection]) {
        // @ts-ignore
        acc[page.collection] = [page];
      } else {
        // @ts-ignore
        acc[page.collection].push(page);
      }
    }

    return acc;
  }, {});
}

// TODO: Decide where this should live.
function getAssetsFromPages(pages: Page[]): Asset[] {
  const assets: Asset[] = [];

  for (const page of pages) {
    if (page.assets) {
      assets.push(...page.assets);
    }
  }

  return assets;
}

// TODO: Decide where this should live.
async function copyAssets(assets: Asset[]) {
  for await (const asset of assets) {
    await fs.cp(asset.inputPath, asset.outputPath);
  }
}

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
async function cleanOutputDirectory(
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

function getAssetsFilteredByChanges(
  inputDirectory: string,
  assets: Asset[],
  changedPaths: string[] = []
) {
  return assets.filter((asset) => {
    // TODO: Is there a way to be consistent with what paths include?
    // This code is getting rid of the `_src/` part from the `asset.inputPath`.
    const relativeAssetInputPath = path.relative(
      inputDirectory,
      asset.inputPath
    );
    const absoluteAssetInputPath = path.join(
      inputDirectory,
      relativeAssetInputPath
    );

    return changedPaths.includes(absoluteAssetInputPath);
  });
}

export default async function staticbuild(options: StaticBuildOptions) {
  // TODO: Think of a better name for `onlyChangeForPaths` and make consistent.
  async function build(onlyChangeForPaths?: string[]) {
    console.time('setup');
    const config = getUserConfig(options.configPath);

    // const hooks = await getFunctionsFromFS(config.directories.hooks);
    // TODO: Is it possible for these functions to use a shared sourcing func?
    // TODO: Add checks that paths exist.
    const functions = await getFunctionsFromFS(config.directories.functions);
    const data = await getFunctionsFromFS(config.directories.data);
    const layouts = await getLayoutsFromFS(config.directories.layouts);
    const partials = await getLayoutsFromFS(config.directories.partials);
    console.timeEnd('setup');

    console.time('source');
    // TODO: Add check that `getPages` and `getAssets` return arrays.
    // Maybe even warn when they return empty array.
    const pages = await config.getPages();
    const assets = await config.getAssets();
    const collections = getCollectionsFromPages(pages);
    console.timeEnd('source');

    console.time('copy');
    const assetsFromPages = getAssetsFromPages(pages);
    const allAssets = [...assets, ...assetsFromPages];
    const assetsToCopy = await getAssetsFilteredByChanges(
      options.inputDirectory,
      allAssets,
      onlyChangeForPaths
    );

    if (onlyChangeForPaths) {
      await copyAssets(assetsToCopy);
    } else {
      await copyAssets(allAssets);
    }
    console.timeEnd('copy');

    console.time('render');
    await renderPages({
      pages,
      layouts,
      partials,
      functions,
      collections,
      data
    });
    console.timeEnd('render');

    console.time('clean');
    await cleanOutputDirectory(options.outputDirectory, pages, allAssets);
    console.timeEnd('clean');
  }

  await build();

  if (options.watch) {
    console.log('---');
    console.log('👀 watching for changes...');

    await watchDirectoryForChanges(
      options.inputDirectory,
      async (changedFilePaths) => {
        console.log('---');
        await build(changedFilePaths);
      }
    );
  }
}
