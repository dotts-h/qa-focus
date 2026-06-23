// Static server for the HOSTILE red-team fixture (#0009) — mirrors fixtures/app/server.mjs.
// Serves the injection page that tries to subvert the autonomous explorer; the leash (URL
// allowlist + tool-gating, ADR 0001) must hold. PORT defaults to 3009 (the app fixture owns 3000);
// PORT=0 binds an ephemeral port and prints it, so concurrent red-team runs can't collide.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const port = process.env.PORT === undefined ? 3009 : Number(process.env.PORT);

createServer(async (req, res) => {
  try {
    const path = normalize(req.url === '/' ? '/index.html' : req.url.split('?')[0]);
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, () => {
  const addr = port; // when PORT=0 the OS assigns; read it off the server below
}).on('listening', function () {
  console.log(`hostile red-team fixture on http://localhost:${this.address().port}`);
});
