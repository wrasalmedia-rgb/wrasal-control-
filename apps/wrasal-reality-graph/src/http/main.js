// Entry point.
import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 4310);
const host = process.env.HOST ?? '0.0.0.0';
const { server } = await buildServer({ dataDir: process.env.WRASAL_DATA_DIR ?? null });

server.listen(port, host, () => {
  console.log(`WRASAL Reality Graph — substrate online at http://${host}:${port}`);
});
