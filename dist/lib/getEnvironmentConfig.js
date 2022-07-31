"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvironmentConfig = void 0;
function getEnvironmentConfig() {
    return {
        devMode: process.env.NODE_ENV === 'dev'
    };
}
exports.getEnvironmentConfig = getEnvironmentConfig;
//# sourceMappingURL=getEnvironmentConfig.js.map