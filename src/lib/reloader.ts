import * as http from 'http';
import { EventEmitter } from 'events';

function formatServerSideEvent(name: string, message?: string) {
  return `event: ${name}\ndata: ${message}\n\n`;
}

export function createReloader() {
  let port = 4000;
  const events = new EventEmitter();

  function getScript(port: number) {
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

      events.once('reload', () => {
        response.write(formatServerSideEvent('reload'));
      });
    });

    server.once('error', (err) => {
      if (err instanceof Error && err.code === 'EADDRINUSE') {
        port++;
        start();
      }
    });

    server.listen(port);
  }

  return {
    getScript: () => getScript(port),
    reload: () => events.emit('reload'),
    start
  };
}
