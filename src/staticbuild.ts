import * as fs from 'fs/promises';
import * as path from 'path';

import { getLayoutsFromFS } from './sources/getLayoutsFromFS';
import { getFunctionsFromFS } from './sources/getFunctionsFromFS';
import { getUserConfig } from './lib/config';
import { renderPages } from './lib/renderPages';
import { watchDirectoryForChanges } from './lib/watchDirectoryForChanges';
import { cleanOutputDirectory } from './lib/cleanOutputDirectory';
import { getCollectionsFromPages } from './lib/getCollectionsFromPages';
import { getAssetsFromPages } from './lib/getAssetsFromPages';
import { createReloader } from './lib/reloader';
import { getEnvironmentConfig } from './lib/env';

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

// TODO: Decide where this should live.
async function copyAssets(assets: Asset[]) {
  for await (const asset of assets) {
    await fs.cp(asset.inputPath, asset.outputPath);
  }
}

export default async function staticbuild(options: StaticBuildOptions) {
  const reloader = createReloader();

  async function build() {
    console.time('setup');
    const env = getEnvironmentConfig();
    const config = await getUserConfig(options.configPath);
    const functions = await getFunctionsFromFS(config.directories.functions);
    // TODO: Add check for errors with data JSON formatting.
    const data = await getFunctionsFromFS(config.directories.data);
    const layouts = await getLayoutsFromFS(config.directories.layouts);
    const partials = await getLayoutsFromFS(config.directories.partials);
    const hooks = {
      onRenderPage: (context: RenderContext, template: string): string => {
        const extension = path.extname(context.page.outputPath);

        if (env.devMode && extension === '.html') {
          return template + reloader.getScript();
        }

        return template;
      }
    };
    console.timeEnd('setup');

    console.time('source');
    const pages = await config.getPages();
    const assets = await config.getAssets();

    if (!(pages instanceof Array)) {
      throw new Error('An array needs to be returned from `getPages`');
    }

    if (!(assets instanceof Array)) {
      throw new Error('An array needs to be returned from `getAssets`');
    }

    const collections = getCollectionsFromPages(pages);
    console.timeEnd('source');

    console.time('copy');
    // TODO: Filter assets by changed files.
    const allAssets = [...assets, ...getAssetsFromPages(pages)];

    await copyAssets(allAssets);
    console.timeEnd('copy');

    console.time('render');
    await renderPages({
      pages,
      layouts,
      partials,
      env,
      hooks,
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

    reloader.start();

    await watchDirectoryForChanges(options.inputDirectory, async () => {
      console.log('---');
      try {
        await build();
        reloader.reload();
      } catch (err) {
        console.log('error:', err);
      }
    });
  }
}
