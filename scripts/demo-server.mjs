import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const html = await readFile(
  new URL('../tests/fixtures/reading.html', import.meta.url),
);
createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
}).listen(4173, '127.0.0.1', () =>
  console.log('阅读体验页：http://127.0.0.1:4173'),
);
