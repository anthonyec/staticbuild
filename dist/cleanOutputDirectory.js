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
exports.cleanOutputDirectory = void 0;
const path = __importStar(require("path"));
const fs_1 = require("./utils/fs");
function getExpectedOutputPaths(outputDirectory, pages, assets) {
    const pageOutputPaths = pages.map((page) => path.relative(outputDirectory, page.outputPath));
    const assetOutputPaths = assets.map((asset) => path.relative(outputDirectory, asset.outputPath));
    return [...pageOutputPaths, ...assetOutputPaths];
}
/**
 * Remove files from output directory that are not expected to be there from built pages or copied assets.
 */
async function cleanOutputDirectory(outputDirectory, pages, assets) {
    // TODO: There is a bug with renamed directories leave empty folders around
    // that don't get deleted.
    // TODO: Make clearer, its confusing about which is absolute and relative and why.
    const outputAbsolutePaths = await (0, fs_1.recursiveReadDirectory)(outputDirectory);
    const actualOutputPaths = outputAbsolutePaths.map((outputPath) => {
        return path.relative(outputDirectory, outputPath);
    });
    const expectedOutputPaths = getExpectedOutputPaths(outputDirectory, pages, assets);
    const unexpectedOutputPaths = actualOutputPaths.filter((outputPath) => !expectedOutputPaths.includes(outputPath));
    const unexpectedOutputPathsAbsolute = unexpectedOutputPaths.map((unexpectedOutputPath) => {
        return path.join(outputDirectory, unexpectedOutputPath);
    });
    await (0, fs_1.deleteFiles)(unexpectedOutputPathsAbsolute, outputDirectory);
}
exports.cleanOutputDirectory = cleanOutputDirectory;
//# sourceMappingURL=cleanOutputDirectory.js.map