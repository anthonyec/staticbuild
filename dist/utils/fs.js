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
exports.deleteFiles = exports.recursiveReadDirectory = exports.scanDirectory = exports.getFileNames = exports.getDirectoryNames = exports.checkFileExists = exports.requireUncached = void 0;
const fs = __importStar(require("fs/promises"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const IGNORED_FILES = ['.DS_Store'];
function requireUncached(module) {
    delete require.cache[require.resolve(module)];
    return require(module);
}
exports.requireUncached = requireUncached;
/** Returns `true` if a file exists, otherwise `false`. */
async function checkFileExists(filePath) {
    try {
        await fs.access(filePath, fs_1.constants.F_OK);
        return true;
    }
    catch (err) {
        if (err instanceof Error) {
            if (err.code === 'ENOENT') {
                return false;
            }
            throw new Error(err.message);
        }
    }
}
exports.checkFileExists = checkFileExists;
/** Return names of all directories found at the specified path. */
async function getDirectoryNames(directoryPath) {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}
exports.getDirectoryNames = getDirectoryNames;
/** Return names of all files found at the specified directoryPath. */
async function getFileNames(directoryPath) {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile())
        .filter((entry) => !IGNORED_FILES.includes(entry.name))
        .map((entry) => entry.name);
}
exports.getFileNames = getFileNames;
async function scanDirectory(targetDirectory, ignorePathsAndDirectories = [], callback = () => { }) {
    // Remove `./` from ignored paths.
    const normalizedIgnorePathsAndDirectories = ignorePathsAndDirectories.map(path.normalize);
    async function scan(currentTargetDirectory) {
        const files = [];
        const entries = await fs.readdir(currentTargetDirectory, {
            withFileTypes: true
        });
        for await (const entry of entries) {
            const entryPath = path.join(currentTargetDirectory, entry.name);
            const isIgnored = normalizedIgnorePathsAndDirectories.find((pathOrDirectory) => pathOrDirectory.startsWith(entryPath));
            if (isIgnored) {
                continue;
            }
            if (IGNORED_FILES.includes(entry.name)) {
                continue;
            }
            if (entry.isDirectory()) {
                const subDirectoryFiles = await scan(entryPath);
                files.push(...subDirectoryFiles);
                const file = {
                    name: entry.name,
                    path: entryPath,
                    isDirectory: true,
                    isEmpty: subDirectoryFiles.length === 0
                };
                files.push(file);
                await callback(file);
            }
            else {
                const file = {
                    name: entry.name,
                    path: entryPath,
                    isDirectory: false,
                    isEmpty: false
                };
                files.push(file);
                await callback(file);
            }
        }
        return files;
    }
    return await scan(targetDirectory);
}
exports.scanDirectory = scanDirectory;
// TODO: Remove this and replace?
async function recursiveReadDirectory(directoryPath) {
    async function scan(targetDirectoryPath) {
        const files = [];
        const entries = await fs.readdir(targetDirectoryPath, {
            withFileTypes: true
        });
        for await (const entry of entries) {
            const entryPath = path.join(targetDirectoryPath, entry.name);
            if (IGNORED_FILES.includes(entry.name)) {
                continue;
            }
            if (entry.isDirectory()) {
                const subDirectoryFiles = await scan(entryPath);
                files.push(...subDirectoryFiles);
            }
            if (entry.isFile()) {
                files.push(entryPath);
            }
        }
        return files;
    }
    return await scan(directoryPath);
}
exports.recursiveReadDirectory = recursiveReadDirectory;
async function deleteFiles(filePaths, expectedDirectoryToDeleteFrom, dryRun) {
    for await (const filePath of filePaths) {
        const isFileInExpectedDirectory = filePath.includes(expectedDirectoryToDeleteFrom);
        if (!isFileInExpectedDirectory) {
            throw new Error(`Safety checked failed for deleting file at path "${filePath}" that does not include the expected directory "${expectedDirectoryToDeleteFrom}"`);
        }
        if (dryRun) {
            console.warn('[dry run] delete:', filePath);
        }
        else {
            await fs.rm(filePath);
        }
    }
}
exports.deleteFiles = deleteFiles;
//# sourceMappingURL=fs.js.map