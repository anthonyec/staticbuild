export declare function requireUncached<T>(module: string): T;
/** Returns `true` if a file exists, otherwise `false`. */
export declare function checkFileExists(filePath: string): Promise<boolean | undefined>;
/** Return names of all directories found at the specified path. */
export declare function getDirectoryNames(directoryPath: string): Promise<string[]>;
/** Return names of all files found at the specified directoryPath. */
export declare function getFileNames(directoryPath: string): Promise<string[]>;
interface File {
    name: string;
    path: string;
    isDirectory: boolean;
    isEmpty: boolean;
}
export declare function scanDirectory(targetDirectory: string, ignorePathsAndDirectories?: string[], callback?: (file: File) => void): Promise<File[]>;
export declare function recursiveReadDirectory(directoryPath: string): Promise<string[]>;
export declare function deleteFiles(filePaths: string[], expectedDirectoryToDeleteFrom: string, dryRun?: boolean): Promise<void>;
export {};
