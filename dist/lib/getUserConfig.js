"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserConfig = void 0;
const fs_1 = require("../utils/fs");
const DEFAULT_CONFIG = {
    directories: {
        layouts: './src/_layouts',
        partials: './src/_partials',
        functions: './src/_functions',
        data: './src/_data'
    },
    getPages: () => [],
    getAssets: () => []
};
async function getUserConfig(configPath) {
    if (!(await (0, fs_1.checkFileExists)(configPath))) {
        return DEFAULT_CONFIG;
    }
    const userConfig = (0, fs_1.requireUncached)(configPath);
    return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        directories: {
            ...DEFAULT_CONFIG.directories,
            ...userConfig.directories
        }
    };
}
exports.getUserConfig = getUserConfig;
//# sourceMappingURL=getUserConfig.js.map