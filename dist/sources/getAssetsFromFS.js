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
const path = __importStar(require("path"));
const fs_1 = require("../utils/fs");
function replaceStart(targetString, searchValue, replaceString) {
    return replaceString + targetString.slice(searchValue.length);
}
async function getAssetsFromFS(options) {
    const files = await (0, fs_1.scanDirectory)(options.inputDirectory, options.ignorePathsAndDirectories);
    const filesWithoutDirectories = files.filter((file) => !file.isDirectory);
    return filesWithoutDirectories.map((file) => {
        // Could use `path.normalize(options.outputDirectory)` at the end instead of empty string.
        const outputPath = replaceStart(file.path, path.normalize(options.inputDirectory), '');
        return {
            filename: file.name,
            inputPath: file.path,
            outputPath: path.join(options.outputDirectory, outputPath)
        };
    });
}
exports.default = getAssetsFromFS;
//# sourceMappingURL=getAssetsFromFS.js.map