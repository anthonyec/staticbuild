import * as http from 'http';
import { EventEmitter } from 'events';

function formatServerSideEvent(name: string, message?: string) {
  return `event: ${name}\ndata: ${message}\n\n`;
}

export function createReloader() {
  const PORT = 5678;
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

  const server = http.createServer(function (_request, response) {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('access-control-allow-origin', '*');

    events.on('reload', () => {
      response.write(formatServerSideEvent('reload'));
    });
  });

  server.listen(PORT);

  return {
    getScript: () => getScript(PORT),
    reload: () => events.emit('reload')
  };
}
