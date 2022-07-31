"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const getLayoutsFromFS_1 = require("./sources/getLayoutsFromFS");
const getFunctionsFromFS_1 = require("./sources/getFunctionsFromFS");
const getUserConfig_1 = require("./lib/getUserConfig");
const renderPages_1 = require("./lib/renderPages");
const watchDirectoryForChanges_1 = require("./lib/watchDirectoryForChanges");
const cleanOutputDirectory_1 = require("./lib/cleanOutputDirectory");
const getCollectionsFromPages_1 = require("./lib/getCollectionsFromPages");
const getAssetsFromPages_1 = require("./lib/getAssetsFromPages");
const reloader_1 = require("./lib/reloader");
const getEnvironmentConfig_1 = require("./lib/getEnvironmentConfig");
const getBuiltInPartials_1 = require("./sources/getBuiltInPartials");
// TODO: Decide where this should live.
async function copyAssets(assets) {
    for await (const asset of assets) {
        await fs.cp(asset.inputPath, asset.outputPath);
    }
}
async function writePages(pages) {
    for await (const page of pages) {
        const outputDirectory = path.dirname(page.outputPath);
        await fs.mkdir(outputDirectory, { recursive: true });
        await fs.writeFile(page.outputPath, page.content, 'utf8');
    }
}
async function staticbuild(options) {
    const reloader = (0, reloader_1.createReloader)();
    async function build(changedFilePaths = []) {
        console.time('setup');
        const env = (0, getEnvironmentConfig_1.getEnvironmentConfig)();
        const config = await (0, getUserConfig_1.getUserConfig)(options.configPath);
        const functions = await (0, getFunctionsFromFS_1.getFunctionsFromFS)(config.directories.functions);
        // TODO: Add check for errors with data JSON formatting.
        const data = await (0, getFunctionsFromFS_1.getFunctionsFromFS)(config.directories.data);
        const layouts = await (0, getLayoutsFromFS_1.getLayoutsFromFS)(config.directories.layouts);
        const partials = {
            ...(await (0, getLayoutsFromFS_1.getLayoutsFromFS)(config.directories.partials)),
            ...(0, getBuiltInPartials_1.getBuiltInPartials)()
        };
        const hooks = {
            onRenderPage: function injectReloaderScript(context, template) {
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
        const collections = (0, getCollectionsFromPages_1.getCollectionsFromPages)(pages);
        console.timeEnd('source');
        console.time('copy');
        const allAssets = [...assets, ...(0, getAssetsFromPages_1.getAssetsFromPages)(pages)];
        const filteredAssets = allAssets.filter((asset) => {
            // TODO: Explain why this path is made like this. Hint, it's to get around the double `src/src` bit in a path.
            const assetInputPath = path.join(options.inputDirectory, path.relative(options.inputDirectory, asset.inputPath));
            return changedFilePaths.includes(assetInputPath);
        });
        // TODO: Clean up to not use ternary?
        await copyAssets(changedFilePaths.length ? filteredAssets : allAssets);
        console.timeEnd('copy');
        console.time('render');
        const renderedPages = await (0, renderPages_1.renderPages)({
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
        console.time('write');
        writePages(renderedPages);
        console.timeEnd('write');
        console.time('clean');
        await (0, cleanOutputDirectory_1.cleanOutputDirectory)(options.outputDirectory, pages, allAssets);
        console.timeEnd('clean');
    }
    await build();
    if (options.watch) {
        console.log('---');
        console.log('👀 watching for changes...');
        reloader.start();
        await (0, watchDirectoryForChanges_1.watchDirectoryForChanges)(options.inputDirectory, async (changedFilePaths) => {
            console.log('---');
            try {
                await build(changedFilePaths);
                reloader.reload();
            }
            catch (err) {
                console.log('error:', err);
            }
        });
    }
}
exports.default = staticbuild;
//# sourceMappingURL=staticbuild.js.map