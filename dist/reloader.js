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
exports.createReloader = void 0;
const http = __importStar(require("http"));
const events_1 = require("events");
function formatServerSideEvent(name, message) {
    return `event: ${name}\ndata: ${message}\n\n`;
}
function createReloader() {
    let port = 4000;
    const events = new events_1.EventEmitter();
    function getScript(port) {
        return `
      <script>
        // This script is added by staticbuild for enabling auto-reloading when files change.
        (function() {
          const client = new EventSource('http://localhost:${port}/');

          client.onopen = () => {
            console.log('Reloader connected to staticbuild');
          };

          client.onerror = (error) => {
            console.error('Reloader failed to connect', error);
          };

          client.addEventListener('reload', () => {
            window.location.reload();
          });

          client.addEventListener('err', (err) => {
            console.log('ERROR', err);
          });
        })();
      </script>
    `;
    }
    function start() {
        const server = http.createServer(function (_request, response) {
            response.setHeader('Content-Type', 'text/event-stream');
            response.setHeader('access-control-allow-origin', '*');
            events.on('reload', () => {
                response.write(formatServerSideEvent('reload'));
            });
        });
        server.listen(port);
        server.once('error', (err) => {
            // If the port is already in use, increment the port number and try again!
            // TODO: Fix error type
            // @ts-ignore
            if (err.code === 'EADDRINUSE') {
                port++;
                start();
            }
        });
    }
    return {
        getScript: () => getScript(port),
        reload: () => events.emit('reload'),
        start
    };
}
exports.createReloader = createReloader;
//# sourceMappingURL=reloader.js.map