import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { db } from './db/index.js';
import { api, errorHandler } from './routes.js';

const app = express();
app.disable('x-powered-by');
app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

// After `npm run build`, serve the client from the same port.
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = [path.resolve(here, '../../client/dist'), path.resolve(here, '../../../client/dist')].find((p) =>
  fs.existsSync(path.join(p, 'index.html')),
);
if (clientDist) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

db(); // open and migrate before taking requests
app.listen(config.port, () => {
  console.log(`Review Pulse API on http://localhost:${config.port}  (db: ${config.dbPath})`);
});
