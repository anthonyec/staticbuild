#! /usr/bin/env node
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const process_1 = require("process");
const __1 = require("..");
const ERROR_CODE = {
    SUCCESS: 0,
    CALLED_WITH_ILLEGAL_PARAMETERS: 1,
    FAILED_T0_READ_LOCAL_FILE: 11
};
const DEFAULT_ARGS = {
    watch: false
};
function logUsage() {
    process_1.stdout.write(`Usage: staticbuild <inputDirectory> <outputDirectory> [--watch]\n`);
    process_1.stdout.write(`\nArguments:\n`);
    process_1.stdout.write(`<inputDirectory>    Location of directory containing content\n`);
    process_1.stdout.write(`<outputDirectory>   Location of directory for build output\n`);
    process_1.stdout.write(`--watch, -w         Watch source directory for changes\n`);
}
async function main() {
    // Remove the first 2 arguments that nodejs provides.
    const args = process.argv.splice(2, process.argv.length);
    if (args.length === 0) {
        logUsage();
        return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS;
    }
    const inputDirectory = args[0];
    const outputDirectory = args[1];
    // Parse options that user has provided as an args object.
    const options = args.reduce((mem, arg) => {
        if (arg === '--watch' || arg === '-w') {
            mem['watch'] = true;
        }
        return mem;
    }, { ...DEFAULT_ARGS });
    // Check that the first argument is a path and not a command.
    if (!inputDirectory || inputDirectory.slice(0, 1) === '-') {
        process_1.stdout.write(`Error: Invalid input directory.\n`);
        return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS;
    }
    // Check that the second argument is a path and not a command.
    if (!outputDirectory || outputDirectory.slice(0, 1) === '-') {
        process_1.stdout.write(`Error: Invalid output directory.\n`);
        return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS;
    }
    if (!fs.existsSync(inputDirectory)) {
        process_1.stdout.write(`Error: Input directory "${inputDirectory}" does not exist.\n`);
        return ERROR_CODE.FAILED_T0_READ_LOCAL_FILE;
    }
    if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory);
    }
    await (0, __1.staticbuild)({
        inputDirectory: path.join(process.cwd(), inputDirectory),
        outputDirectory: path.join(process.cwd(), outputDirectory),
        configPath: path.join(process.cwd(), '.staticbuildrc.js'),
        ...options
    });
}
main();
//# sourceMappingURL=cli.js.map