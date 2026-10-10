import {
  MessageFlags, type AutocompleteInteraction, type ButtonInteraction, type ChatInputCommandInteraction, type Interaction,
  type ModalSubmitInteraction, type RESTPostAPIChatInputApplicationCommandsJSONBody, type StringSelectMenuInteraction,
  type InteractionReplyOptions,
} from 'discord.js';
import { GameError, type Game } from '../services/core.ts';

export interface Ctx { game: Game }

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(ctx: Ctx, i: ChatInputCommandInteraction): Promise<unknown>;
  autocomplete?(ctx: Ctx, i: AutocompleteInteraction): Promise<unknown>;
}

export type ComponentInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;
/** Componentes usam customId no formato `prefixo:ação:arg1:arg2…`. */
export type ComponentHandler = (ctx: Ctx, i: ComponentInteraction, args: string[]) => Promise<unknown>;

export const commands = new Map<string, Command>();
export const components = new Map<string, ComponentHandler>();

export function command(c: Command) { commands.set(c.data.name, c); }
export function component(prefix: string, h: ComponentHandler) { components.set(prefix, h); }

export const ephemeral = (o: InteractionReplyOptions | string): InteractionReplyOptions =>
  typeof o === 'string' ? { content: o, flags: MessageFlags.Ephemeral } : { ...o, flags: MessageFlags.Ephemeral };

async function replyError(i: Interaction, msg: string) {
  if (!i.isRepliable()) return;
  const payload = ephemeral(`⚠️ ${msg}`);
  try {
    if (i.deferred || i.replied) await i.followUp(payload);
    else await i.reply(payload);
  } catch { /* interação expirada */ }
}

export async function dispatch(ctx: Ctx, i: Interaction) {
  try {
    if (i.isChatInputCommand()) {
      const c = commands.get(i.commandName);
      if (c) await c.execute(ctx, i);
    } else if (i.isAutocomplete()) {
      const c = commands.get(i.commandName);
      if (c?.autocomplete) await c.autocomplete(ctx, i);
    } else if (i.isButton() || i.isStringSelectMenu() || i.isModalSubmit()) {
      const [prefix, ...args] = i.customId.split(':');
      const h = components.get(prefix);
      if (h) await h(ctx, i, args);
    }
  } catch (e) {
    if (e instanceof GameError) return replyError(i, e.message);
    console.error('[erro]', e);
    return replyError(i, 'Algo deu errado do nosso lado. Nada foi perdido; tente novamente.');
  }
}
