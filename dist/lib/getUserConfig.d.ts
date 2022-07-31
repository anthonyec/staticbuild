interface Config {
    directories: {
        layouts: string;
        partials: string;
        functions: string;
        data: string;
    };
    getPages: () => Promise<Page[]>;
    getAssets: () => Promise<Asset[]>;
}
export declare function getUserConfig(configPath: string): Promise<Config>;
export {};
