"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class EventSource {
    constructor(url) { }
    onopen() { }
    onerror(error) { }
    addEventListener(name, callback) { }
}
const window = {
    location: {
        reload: () => { }
    }
};
function getScript() {
    (function () {
        const client = new EventSource('http://localhost:${PORT}/');
        client.onopen = () => {
            console.log('Reloader connected to staticbuild');
        };
        client.onerror = (error) => {
            console.error('Reloader failed to connect', error);
        };
        client.addEventListener('reload', () => {
            window.location.reload();
        });
    })();
}
exports.default = getScript;
//# sourceMappingURL=script.js.map