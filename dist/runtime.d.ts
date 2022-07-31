import { StaticBuildOptions } from "./staticbuild";
export declare const runtime: {
    addAsset(asset: Asset): void;
    getAssets(): Asset[];
    addGeneratedAsset(generatedAsset: GeneratedAsset): void;
    getGeneratedAssets(): GeneratedAsset[];
    setOptions(userOptions: StaticBuildOptions): void;
    getOptions(): StaticBuildOptions;
};
