import * as fs from 'fs/promises';

import { getUserConfig } from './config';
import { getLayoutsFromFS } from './sources/getLayoutsFromFS';
import { getFunctionsFromFS } from './sources/getFunctionsFromFS';
import { renderPages } from './renderPages';
import { recursiveReadDirectory } from './utils/fs';

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

export default async function staticbuild(options: StaticBuildOptions) {
  console.time('setup');
  const config = getUserConfig(options.configPath);

  // await resetOutputDirectory(options.outputDirectory);

  // const hooks = await getFunctionsFromFS(config.directories.hooks);
  // TODO: Is it possible for these functions to use a shared sourcing func?
  // TODO: Add checks that paths exist.
  const functions = await getFunctionsFromFS(config.directories.functions);
  const data = await getFunctionsFromFS(config.directories.data);
  const layouts = await getLayoutsFromFS(config.directories.layouts);
  const partials = await getLayoutsFromFS(config.directories.partials);
  console.timeEnd('setup');

  console.time('source');
  const pages = await config.getPages();
  // const assets = await config.getAssets();
  const collections = getCollectionsFromPages(pages);
  console.timeEnd('source');

  console.time('copy');
  const assetsFromPages = getAssetsFromPages(pages);
  // const assetsToCopy = await getAssetsFilteredByChanges([...assets, ...assetsFromPages], changeList);

  await copyAssets(assetsFromPages);
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

  // console.time('clean');
  // await recursiveReadDirectory(options.inputDirectory);
  // console.timeEnd('clean')

  // hooks.onPostBuild();
}
