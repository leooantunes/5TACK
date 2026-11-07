import 'dotenv/config';
import { loadEnv } from './config/env';
import { createServices } from './container';
import { buildServer } from './http/server';

const env = loadEnv();
const app = await buildServer(env, (sign) => createServices(env, sign));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
