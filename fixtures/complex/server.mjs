// Static server for the complex-surfaces fixture (iframe + open/closed shadow roots).
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CX_PORT || 3002);
createServer((req, res) => {
  const p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try { res.end(readFileSync(join(HERE, '.' + p))); }
  catch { res.statusCode = 404; res.end('not found'); }
}).listen(PORT, () => console.log(`complex fixture on http://localhost:${PORT}`));
