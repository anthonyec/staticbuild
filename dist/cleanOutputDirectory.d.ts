/**
 * Remove files from output directory that are not expected to be there from built pages or copied assets.
 */
export declare function cleanOutputDirectory(outputDirectory: string, pages: Page[], assets: Asset[]): Promise<void>;
