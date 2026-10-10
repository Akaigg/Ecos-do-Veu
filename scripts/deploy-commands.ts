// Registra os comandos de barra. Com DEV_GUILD_ID, registra só no servidor de testes (instantâneo).
import { REST, Routes } from 'discord.js';
import { config } from '../src/config.ts';
import { commands } from '../src/bot/index.ts';

const body = [...commands.values()].map((c) => c.data.toJSON());
if (process.argv.includes('--dry-run')) {
  console.log(`${body.length} comandos:`, body.map((b) => b.name).join(', '));
  process.exit(0);
}
if (!config.token || !config.clientId) {
  console.error('Defina DISCORD_TOKEN e DISCORD_CLIENT_ID no .env.');
  process.exit(1);
}
const rest = new REST().setToken(config.token);
const route = config.devGuildId ? Routes.applicationGuildCommands(config.clientId, config.devGuildId) : Routes.applicationCommands(config.clientId);
await rest.put(route, { body });
console.log(`✅ ${body.length} comandos registrados ${config.devGuildId ? `no servidor ${config.devGuildId}` : 'globalmente (pode levar até 1h para aparecer)'}.`);
