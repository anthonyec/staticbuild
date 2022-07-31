"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchDirectoryForChanges = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// TODO: Better types for callback? What do other debounces do online for types?
function debounce(callback, timeout = 300) {
    let timer;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(callback, timeout);
    };
}
async function watchDirectoryForChanges(targetDirectoryPath, onChange) {
    let collatedChangeEvents = [];
    const watcher = fs.watch(targetDirectoryPath, {
        recursive: true
    });
    const onChangeDebounced = debounce(() => {
        const changedFilePaths = collatedChangeEvents.map((changeEvent) => {
            return path.join(targetDirectoryPath, changeEvent.filename);
        });
        onChange(changedFilePaths);
        collatedChangeEvents = [];
    });
    try {
        // Using debounce because `fs.watch` likes to emit events
        // twice for the same file in quick succession. It's known to be buggy.
        for await (const event of watcher) {
            const hasExistingEvent = collatedChangeEvents.find((changeEvent) => {
                return changeEvent.filename === event.filename;
            });
            // TODO: Add a way to ignore files? Like `.DS_Store`.
            if (!hasExistingEvent) {
                collatedChangeEvents.push(event);
            }
            onChangeDebounced();
        }
    }
    catch (err) {
        console.error('File watcher error', err);
    }
}
exports.watchDirectoryForChanges = watchDirectoryForChanges;
//# sourceMappingURL=watchDirectoryForChanges.js.map