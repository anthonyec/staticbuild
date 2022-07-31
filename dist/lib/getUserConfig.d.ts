interface Config {
    directories: {
        layouts: string;
        partials: string;
        functions: string;
        data: string;
    };
    getPages: () => Page[];
    getAssets: () => Asset[];
}
export declare function getUserConfig(configPath: string): Promise<Config>;
export {};
