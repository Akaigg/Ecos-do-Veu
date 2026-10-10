import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config.ts';
import { Db } from './db/database.ts';
import { createGame } from './services/core.ts';
import { processDue } from './services/jobs.ts';
import { dispatch } from './bot/index.ts';
import { editShared } from './bot/commands/adventure.ts';
import { combatPanel } from './bot/ui/panels.ts';

if (!config.token) {
  console.error('Defina DISCORD_TOKEN no arquivo .env (veja .env.example).');
  process.exit(1);
}

const db = new Db(config.databasePath);
const game = createGame(db);
// Notificações vão para uma caixa de saída persistente: nada se perde se o bot reiniciar.
game.notify = (userId, text) => { db.run('INSERT INTO outbox (user_id, text, at) VALUES (?,?,?)', userId, text.slice(0, 1900), Date.now()); };

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`🌒 Ecos do Véu online como ${c.user.tag}`);
  const tick = async () => {
    try {
      const ev = processDue(game);
      for (const res of ev.combatsUpdated) await editShared(client, game, res.state.id, combatPanel(game, res.state.id, undefined, res.log));
      await flushOutbox();
    } catch (e) {
      console.error('[tarefas]', e);
    }
  };
  void tick();
  setInterval(tick, config.jobIntervalSeconds * 1000);
});

async function flushOutbox() {
  const pending = db.all<{ id: number; user_id: string; text: string }>('SELECT * FROM outbox WHERE sent = 0 ORDER BY id LIMIT 20');
  for (const m of pending) {
    try {
      const user = await client.users.fetch(m.user_id);
      await user.send(m.text);
    } catch { /* DMs fechadas: o relatório continua disponível em /atividade */ }
    db.run('UPDATE outbox SET sent = 1 WHERE id = ?', m.id);
  }
}

client.on(Events.InteractionCreate, (i) => { void dispatch({ game }, i); });

process.on('SIGINT', () => { client.destroy(); db.close(); process.exit(0); });
process.on('SIGTERM', () => { client.destroy(); db.close(); process.exit(0); });

void client.login(config.token);
