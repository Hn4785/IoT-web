import 'reflect-metadata';

import { createApp } from './app/create-app.js';
import { parseRuntimeConfig } from './config/runtime-config.js';

const config = parseRuntimeConfig(process.env);
const app = await createApp(config);

await app.listen(config.port, '0.0.0.0');
