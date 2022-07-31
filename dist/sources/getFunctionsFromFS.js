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
exports.getFunctionsFromFS = void 0;
const path = __importStar(require("path"));
const fs_1 = require("../utils/fs");
async function getFunctionsFromFS(functionsDirectory) {
    if (!(await (0, fs_1.checkFileExists)(functionsDirectory))) {
        return {};
    }
    const functions = {};
    const functionFilenames = await (0, fs_1.getFileNames)(functionsDirectory);
    for await (const functionFilename of functionFilenames) {
        const { name } = path.parse(functionFilename);
        // TODO: Find out why we need to use process.cwd() for require and not readFile.
        const functionPath = path.join(process.cwd(), functionsDirectory, functionFilename);
        // TODO: Could this be cached instead?
        const func = (0, fs_1.requireUncached)(functionPath);
        functions[name] = func;
    }
    return functions;
}
exports.getFunctionsFromFS = getFunctionsFromFS;
//# sourceMappingURL=getFunctionsFromFS.js.map