import * as fs from 'fs/promises';
import * as path from 'path';

import { getUserConfig } from './config';
import { getLayoutsFromFS } from './sources/getLayoutsFromFS';
import { getFunctionsFromFS } from './sources/getFunctionsFromFS';
import { renderPages } from './renderPages';
import { watchDirectoryForChanges } from './watchDirectoryForChanges';
import { cleanOutputDirectory } from './cleanOutputDirectory';

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

    // TODO: Is it possible for these functions to use a shared sourcing func?
    // TODO: Add checks that paths exist.
    // const hooks = await getFunctionsFromFS(config.directories.hooks);
    const functions = await getFunctionsFromFS(config.directories.functions);

    // TODO: Add check for errors with data JSON formatting.
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
