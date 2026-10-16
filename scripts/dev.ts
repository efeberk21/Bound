import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { createServer as createViteServer } from 'vite';
import control from '../api/control.js';
import content from '../api/content.js';
import preview from '../api/preview.js';
import run from '../api/run.js';
if (existsSync('.env')) process.loadEnvFile('.env');
const handlers:Partial<Record<string,typeof content>> = process.argv.includes('--tools-only') ? {content,preview} : {control,content,preview,run};
const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname.split('/');
  const handler = handlers[path[2]??''];
  if (!handler || path[1] !== 'api') { response.writeHead(404).end(); return; }
  void handler(request, response);
});
server.listen(3001, '127.0.0.1');
const vite = await createViteServer({ root: 'apps/web' });
await vite.listen();
vite.printUrls();
function stop() { server.close(); void vite.close(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
