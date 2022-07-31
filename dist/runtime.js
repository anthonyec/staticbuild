"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
function createRuntime() {
    let assets = [];
    let generatedAssets = [];
    let options;
    return {
        addAsset(asset) {
            assets.push(asset);
        },
        getAssets() {
            return assets;
        },
        addGeneratedAsset(generatedAsset) {
            generatedAssets.push(generatedAsset);
        },
        getGeneratedAssets() {
            return generatedAssets;
        },
        setOptions(userOptions) {
            options = userOptions;
        },
        getOptions() {
            return options;
        }
    };
}
exports.runtime = createRuntime();
//# sourceMappingURL=runtime.js.map