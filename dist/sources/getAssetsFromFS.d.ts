interface AssetsOptions {
    inputDirectory: string;
    outputDirectory: string;
    ignorePathsAndDirectories: string[];
}
export default function getAssetsFromFS(options: AssetsOptions): Promise<Asset[]>;
export {};
