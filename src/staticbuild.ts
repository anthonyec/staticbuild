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

export default async function staticbuild(options: StaticBuildOptions) {
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
  // const assetsToCopy = await getAssetsFilteredByChanges([...assets, ...assetsFromPages], changeList);

  await copyAssets([...assets, ...assetsFromPages]);
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
  await cleanOutputDirectory(options.outputDirectory, pages, assetsFromPages);
  console.timeEnd('clean');

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
    await cleanOutputDirectory(options.outputDirectory, pages, assetsFromPages);
    console.timeEnd('clean');
  }

  await build();

  await watchDirectoryForChanges(
    options.inputDirectory,
    async (changedFilePaths) => {
      console.log('---');
      await build(changedFilePaths);
    }
  );
  // hooks.onPostBuild();
}
