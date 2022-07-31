"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedirectsFromMap = exports.getAssetsFromFS = exports.getCollectionFromFS = exports.staticbuild = void 0;
var staticbuild_1 = require("./staticbuild");
Object.defineProperty(exports, "staticbuild", { enumerable: true, get: function () { return __importDefault(staticbuild_1).default; } });
var getCollectionFromFS_1 = require("./sources/getCollectionFromFS");
Object.defineProperty(exports, "getCollectionFromFS", { enumerable: true, get: function () { return __importDefault(getCollectionFromFS_1).default; } });
var getAssetsFromFS_1 = require("./sources/getAssetsFromFS");
Object.defineProperty(exports, "getAssetsFromFS", { enumerable: true, get: function () { return __importDefault(getAssetsFromFS_1).default; } });
var getRedirectsFromMap_1 = require("./sources/getRedirectsFromMap");
Object.defineProperty(exports, "getRedirectsFromMap", { enumerable: true, get: function () { return __importDefault(getRedirectsFromMap_1).default; } });
//# sourceMappingURL=index.js.map