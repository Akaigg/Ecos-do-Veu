import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

export const config = {
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.DISCORD_CLIENT_ID ?? '',
  devGuildId: process.env.DEV_GUILD_ID || undefined,
  databasePath: process.env.DATABASE_PATH ?? './data/ecos.db',
  jobIntervalSeconds: Number(process.env.JOB_INTERVAL_SECONDS ?? 30),
};
