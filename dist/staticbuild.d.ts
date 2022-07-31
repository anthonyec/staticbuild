interface StaticBuildOptions {
    /** Specify an input folder containing website source files */
    inputDirectory: string;
    /** Specify an output folder for the website to be built to */
    outputDirectory: string;
    /** Specify path of the website config file */
    configPath: string;
    /** Watch files in the `outputDirectory and build when they change */
    watch?: boolean;
}
export default function staticbuild(options: StaticBuildOptions): Promise<void>;
export {};
