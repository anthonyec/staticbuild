"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DEFAULT_CONFIG = {
    directories: {
        layouts: './src/_layouts',
        partials: './src/_partials',
        functions: './src/_functions',
        data: './src/_data',
        hooks: './src/_hooks',
    },
    getPages: () => [],
    getAssets: () => [],
};
function requireUncached(module) {
    delete require.cache[require.resolve(module)];
    return require(module);
}
async function staticbuild(options) {
    const config = {
        ...DEFAULT_CONFIG,
        ...requireUncached(options.configPath),
    };
    // await resetOutputDirectory(options.outputDirectory);
    // const functions = await getFunctionsFromFS(config.directories?.functions);
    // const layouts = await getLayoutsFromFS(config.directories?.layouts);
    // const partials = await getPartialsFromFS(config.directories?.partials);
    // const data = await getDataFromFS(config.directories?.data);
    // const hooks = await getHooksFromFS(config.directories?.hooks);
    const pages = await config.getPages();
    // const assets = await config.getAssets();
    // console.log(pages);
}
exports.default = staticbuild;
