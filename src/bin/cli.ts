#! /usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { exit, stdout } from 'process';

import { staticbuild } from '..';

const ERROR_CODE = {
  SUCCESS: 0,
  CALLED_WITH_ILLEGAL_PARAMETERS: 1,
  FAILED_T0_READ_LOCAL_FILE: 11
};

const DEFAULT_ARGS: Args = {
  watch: false
};

function logUsage() {
  stdout.write(
    `Usage: staticbuild <inputDirectory> <outputDirectory> [--watch]\n`
  );

  stdout.write(`\nArguments:\n`);
  stdout.write(
    `<inputDirectory>    Location of directory containing content\n`
  );
  stdout.write(`<outputDirectory>   Location of directory for build output\n`);
  stdout.write(`--watch, -w         Watch source directory for changes\n`);
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
  const options = args.reduce(
    (mem, arg) => {
      if (arg === '--watch' || arg === '-w') {
        mem['watch'] = true;
      }

      return mem;
    },
    { ...DEFAULT_ARGS }
  );

  // Check that the first argument is a path and not a command.
  if (!inputDirectory || inputDirectory.slice(0, 1) === '-') {
    stdout.write(`Error: Invalid input directory.\n`);
    return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS;
  }

  // Check that the second argument is a path and not a command.
  if (!outputDirectory || outputDirectory.slice(0, 1) === '-') {
    stdout.write(`Error: Invalid output directory.\n`);
    return ERROR_CODE.CALLED_WITH_ILLEGAL_PARAMETERS;
  }

  if (!fs.existsSync(inputDirectory)) {
    stdout.write(
      `Error: Input directory "${inputDirectory}" does not exist.\n`
    );
    return ERROR_CODE.FAILED_T0_READ_LOCAL_FILE;
  }

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory);
  }

  await staticbuild({
    inputDirectory: path.join(process.cwd(), inputDirectory),
    outputDirectory: path.join(process.cwd(), outputDirectory),
    configPath: path.join(process.cwd(), '.staticbuildrc.js'),
    ...options
  });
}

main();
