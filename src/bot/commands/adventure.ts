import { EmbedBuilder, SlashCommandBuilder, type Client, type Message } from 'discord.js';
import { CAMPAIGNS, campaignById } from '../../data/campaigns.ts';
import { regionById } from '../../data/regions.ts';
import { itemById } from '../../data/items.ts';
import { fail, type Game } from '../../services/core.ts';
import { activeCombatId, getCharacter, requireCharacter, getCharacterByUser, type Character } from '../../services/character.ts';
import { act, loadCombat, setCombatMessage, type ActResult, type CombatSettlement } from '../../services/combat.ts';
import { routeSettlement } from '../../services/jobs.ts';
import { choosePath, currentExploration, returnToCity, startExploration } from '../../services/exploration.ts';
import {
  abandonCampaign, advanceCampaign, fragments, getRun, pauseCampaign, redeemFragments, resumeCampaign, runOf, substitute, vote,
} from '../../services/campaign.ts';
import { createParty, inviteToParty, joinParty, leaveParty, partyOf, partyInvites, setPartyMode, setPosture } from '../../services/party.ts';
import type { PlayerAction } from '../../game/combat/state.ts';
import { command, component, ephemeral, type Ctx, type ComponentInteraction } from '../registry.ts';
import { actionRows, combatEmbed, moveChoice, skillPanelText, targetChoice, tkey } from '../ui/combat.ts';
import { campaignPanel, combatPanel, explorePanel, type Panel } from '../ui/panels.ts';
import { COLORS, itemList } from '../ui/format.ts';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// ===================================================================== utilidades

export function settlementLines(g: Game, s: CombatSettlement): string[] {
  const out: string[] = [];
  for (const m of s.members) {
    const c = getCharacter(g, m.characterId);
    if (!c) continue;
    const parts = [`**${c.name}**: +${m.xp} XP`];
    if (m.levels) parts.push(`🎉 nível ${m.level}!`);
    if (Object.keys(m.items).length) parts.push(`saque: ${itemList(m.items)}`);
    if (m.tamed.length) parts.push(`🐾 ${m.tamed.join(', ')}`);
    if (m.firstBoss) parts.push('👑 primeira vitória sobre este chefe — receitas e visuais liberados!');
    out.push(parts.join(' • '));
  }
  return out;
}

/** Painel que deve aparecer depois de uma ação de combate. */
function afterAct(g: Game, c: Character, res: ActResult): Panel {
  const extra: string[] = [];
  if (res.settlement) {
    extra.push(...settlementLines(g, res.settlement));
    extra.push(...routeSettlement(g, res.kind, res.ref, res.settlement));
  }
  if (res.ref?.startsWith('act:') && res.settlement) return explorePanel(g, c, extra);
  if (res.ref?.startsWith('run:') && res.settlement) {
    const run = getRun(g, Number(res.ref.slice(4)));
    if (run) return campaignPanel(g, run, extra);
  }
  return combatPanel(g, res.state.id, c, extra);
}

export async function editShared(client: Client, g: Game, combatId: string, panel: Panel) {
  const row = g.db.get<{ channel_id: string | null; message_id: string | null }>('SELECT channel_id, message_id FROM combats WHERE id = ?', combatId);
  if (!row?.channel_id || !row.message_id) return;
  try {
    const ch = await client.channels.fetch(row.channel_id);
    if (ch?.isTextBased()) await (await ch.messages.fetch(row.message_id)).edit({ ...panel, attachments: [] });
  } catch (e) { console.warn('[painel] não foi possível atualizar', (e as Error).message); }
}

function chosenTarget(combatId: string, charId: number) { return targetChoice.get(tkey(combatId, charId)); }

function buildAction(g: Game, c: Character, combatId: string, action: string, arg?: string, value?: string): PlayerAction {
  const loaded = loadCombat(g, combatId) ?? fail('Combate não encontrado.');
  const st = loaded!.state;
  const me = st.fighters.find((f) => f.id === `p${c.id}`) ?? fail('Você não participa deste combate.');
  const tgt = chosenTarget(combatId, c.id);
  const tf = tgt ? st.fighters.find((f) => f.id === tgt) : undefined;
  const enemyT = tf && tf.side !== me!.side ? tf.id : undefined;
  const allyT = tf && tf.side === me!.side ? tf.id : undefined;
  switch (action) {
    case 'sk': {
      const s = me!.skills[Number(arg)] ?? fail('Habilidade inválida.');
      return { kind: 'habilidade', skillId: s!.id, targetId: s!.target === 'aliado' ? allyT ?? me!.id : enemyT };
    }
    case 'atk': return { kind: 'atacar', targetId: enemyT };
    case 'def': return { kind: 'defender' };
    case 'mov': return { kind: 'mover' };
    case 'more': {
      if (!value) fail('Escolha uma opção.');
      if (value === 'analisar') return { kind: 'analisar', targetId: enemyT ?? st.fighters.find((f) => f.side !== me!.side && f.alive)?.id ?? '' };
      if (value === 'fugir') return { kind: 'fugir' };
      const [k, item] = value!.split(':');
      if (k === 'item') return { kind: 'item', itemId: item, targetId: allyT };
      if (k === 'domar') {
        if (!enemyT) fail('Escolha primeiro o alvo a domar no menu de alvo.');
        return { kind: 'domar', itemId: item, targetId: enemyT! };
      }
      fail('Opção inválida.');
    }
  }
  return fail('Ação inválida.');
}

// ===================================================================== combate

component('cb', async (ctx, i, [action, combatId, arg]) => {
  const g = ctx.game;
  if (i.isModalSubmit()) return;
  const c = requireCharacter(g, i.user.id);
  const loaded = loadCombat(g, combatId) ?? fail('Combate não encontrado.');
  const party = loaded!.state.context.partySize > 1;
  if (action === 'ref') {
    if (!i.isButton()) return;
    return i.update({ ...combatPanel(g, combatId, c), attachments: [] });
  }
  if (action === 'act') {
    const me = loaded!.state.fighters.find((f) => f.id === `p${c.id}`);
    if (!me) fail('Você não participa deste combate.');
    if (!me!.alive) fail('Você está fora de combate.');
    return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.main).setTitle(`Suas ações — ${me!.name}`).setDescription(skillPanelText(loaded!.state, me!))], components: actionRows(loaded!.state, me!, combatId) }));
  }
  if (action === 'tgt' && i.isStringSelectMenu()) {
    targetChoice.set(tkey(combatId, c.id), i.values[0]);
    return i.deferUpdate();
  }
  const key = tkey(combatId, c.id);
  if (action === 'mov') {
    // Alterna o movimento; ele acompanha a próxima ação principal.
    if (moveChoice.has(key)) moveChoice.delete(key); else moveChoice.add(key);
    const me = loaded!.state.fighters.find((f) => f.id === `p${c.id}`);
    if (!me) fail('Você não participa deste combate.');
    if (!party) return i.update({ ...combatPanel(g, combatId, c), attachments: [] });
    return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.main).setTitle(`Suas ações — ${me!.name}`).setDescription(skillPanelText(loaded!.state, me!))], components: actionRows(loaded!.state, me!, combatId) });
  }
  const value = i.isStringSelectMenu() ? i.values[0] : undefined;
  const pa = buildAction(g, c, combatId, action, arg, value);
  if (moveChoice.has(key) && pa.kind !== 'mover' && pa.kind !== 'fugir') { (pa as { move?: boolean }).move = true; }
  moveChoice.delete(key);
  const res = act(g, c, combatId, pa);
  if (!party) return i.update({ ...afterAct(g, c, res), attachments: [] });
  // Grupo: atualiza o painel compartilhado; o painel pessoal mostra a confirmação.
  if (res.resolved) {
    const panel = afterAct(g, c, res);
    await editShared(i.client, g, combatId, panel);
    return i.update({ content: '✅ Rodada resolvida — veja o painel do grupo.', embeds: [], components: [] });
  }
  await editShared(i.client, g, combatId, combatPanel(g, combatId));
  return i.update({ content: '✅ Ação registrada. Aguardando o restante do grupo.', embeds: [], components: [] });
});

command({
  data: new SlashCommandBuilder().setName('combate').setDescription('Mostra o painel do seu combate atual'),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const id = activeCombatId(g, c.id) ?? fail('Você não está em combate.');
    const panel = combatPanel(g, id!, c);
    const msg = await i.reply({ ...panel, withResponse: true });
    if ((loadCombat(g, id!)?.state.context.partySize ?? 1) > 1) {
      const m = msg.resource?.message;
      if (m) setCombatMessage(g, id!, m.channelId, m.id);
    }
  },
});

// ===================================================================== exploração

command({
  data: new SlashCommandBuilder().setName('explorar').setDescription('Explore a região atual: caminhos, encontros e descobertas')
    .addBooleanOption((o) => o.setName('mapa').setDescription('Usar um Mapa de Tesouro desta região')),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    if (!currentExploration(g, c.id)) startExploration(g, c, { treasureMap: i.options.getBoolean('mapa') ?? false });
    return i.reply(explorePanel(g, c));
  },
});

component('ex', async (ctx, i, [action, arg]) => {
  const g = ctx.game;
  const c = requireCharacter(g, i.user.id);
  if (!i.isButton()) return;
  if (action === 'start') { startExploration(g, c); return i.update({ ...explorePanel(g, c), attachments: [] }); }
  if (action === 'back') {
    const st = returnToCity(g, c);
    return i.update({ ...explorePanel(g, c, [`🏠 Você volta a ${regionById.get(st.region)?.hub}. Mochila guardada: ${itemList(st.backpack, 'vazia')}.`]), attachments: [] });
  }
  if (action === 'go') {
    const ex = currentExploration(g, c.id);
    if (!ex) fail('Você não está explorando.');
    const out = choosePath(g, c, Number(arg));
    return i.update({ ...explorePanel(g, c, out.text), attachments: [] });
  }
});

// ===================================================================== grupo

command({
  data: new SlashCommandBuilder().setName('grupo').setDescription('Grupos de até quatro pessoas para campanhas')
    .addSubcommand((s) => s.setName('ver').setDescription('Mostra seu grupo'))
    .addSubcommand((s) => s.setName('criar').setDescription('Cria um grupo'))
    .addSubcommand((s) => s.setName('convidar').setDescription('Convida alguém').addUserOption((o) => o.setName('usuario').setDescription('Quem convidar').setRequired(true)))
    .addSubcommand((s) => s.setName('sair').setDescription('Sai do grupo'))
    .addSubcommand((s) => s.setName('ritmo').setDescription('Define o ritmo das campanhas')
      .addStringOption((o) => o.setName('modo').setDescription('Ao vivo ou assíncrono').setRequired(true).addChoices({ name: 'Ao vivo', value: 'ao_vivo' }, { name: 'Assíncrono (prazo para agir)', value: 'assincrono' }))
      .addIntegerOption((o) => o.setName('prazo').setDescription('Horas para agir no modo assíncrono (1–48)').setMinValue(1).setMaxValue(48)))
    .addSubcommand((s) => s.setName('postura').setDescription('O que fazer se você não agir a tempo')
      .addStringOption((o) => o.setName('postura').setDescription('Postura automática').setRequired(true).addChoices({ name: 'Defender', value: 'defender' }, { name: 'Ataque básico seguro', value: 'atacar' }))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const sub = i.options.getSubcommand();
    if (sub === 'criar') { createParty(g, c); return i.reply('👥 Grupo criado. Convide com `/grupo convidar`.'); }
    if (sub === 'convidar') {
      const u = i.options.getUser('usuario', true);
      const target = getCharacterByUser(g, u.id) ?? fail(`${u.username} ainda não tem aventureiro.`);
      const p = inviteToParty(g, c, target!);
      return i.reply({
        content: `👥 <@${u.id}>, ${c.name} convidou você para o grupo.`,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`gp:join:${p.id}`).setLabel('Entrar no grupo').setStyle(ButtonStyle.Success))],
      });
    }
    if (sub === 'sair') { leaveParty(g, c); return i.reply(ephemeral('Você saiu do grupo.')); }
    if (sub === 'ritmo') { setPartyMode(g, c, i.options.getString('modo', true) as 'ao_vivo', i.options.getInteger('prazo') ?? undefined); return i.reply('⏱️ Ritmo atualizado.'); }
    if (sub === 'postura') { setPosture(g, c, i.options.getString('postura', true) as 'defender'); return i.reply(ephemeral('Postura automática atualizada.')); }
    const p = partyOf(g, c.id);
    const invites = partyInvites(g, c.id);
    if (!p) return i.reply(ephemeral(`Você não está em um grupo.${invites.length ? ` Convites: ${invites.map((x) => `grupo de ${x.leader}`).join(', ')}.` : ''}`));
    return i.reply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('👥 Grupo')
      .setDescription(p.members.map((m) => `${m.id === p.leaderId ? '👑' : '•'} ${m.name} — postura: ${m.posture}`).join('\n'))
      .setFooter({ text: `Ritmo: ${p.mode === 'assincrono' ? `assíncrono (${p.deadlineHours}h)` : 'ao vivo'}` })] });
  },
});

component('gp', async (ctx, i, [action, partyId]) => {
  if (action !== 'join' || !i.isButton()) return;
  const c = requireCharacter(ctx.game, i.user.id);
  const p = joinParty(ctx.game, c, Number(partyId));
  return i.reply(`👥 ${c.name} entrou no grupo (${p.members.length}/4).`);
});

// ===================================================================== campanhas

const campaignChoices = CAMPAIGNS.map((c) => ({ name: `${c.name} (nível ${c.minLevel}+)`, value: c.id }));

command({
  data: new SlashCommandBuilder().setName('campanha').setDescription('Campanhas cooperativas para até quatro pessoas')
    .addSubcommand((s) => s.setName('lista').setDescription('Campanhas disponíveis'))
    .addSubcommand((s) => s.setName('iniciar').setDescription('Inicia uma campanha com seu grupo (ou solo)')
      .addStringOption((o) => o.setName('campanha').setDescription('Qual campanha').setRequired(true).addChoices(...campaignChoices)))
    .addSubcommand((s) => s.setName('continuar').setDescription('Mostra o painel da campanha atual'))
    .addSubcommand((s) => s.setName('pausar').setDescription('Pausa em um acampamento'))
    .addSubcommand((s) => s.setName('retomar').setDescription('Retoma a campanha pausada'))
    .addSubcommand((s) => s.setName('substituir').setDescription('Troca um participante (em acampamentos)')
      .addUserOption((o) => o.setName('sai').setDescription('Quem sai').setRequired(true))
      .addUserOption((o) => o.setName('entra').setDescription('Quem entra').setRequired(true)))
    .addSubcommand((s) => s.setName('abandonar').setDescription('Abandona a campanha'))
    .addSubcommand((s) => s.setName('fragmentos').setDescription('Fragmentos de recompensas (proteção contra azar)'))
    .addSubcommand((s) => s.setName('resgatar').setDescription('Troca fragmentos pela recompensa')
      .addStringOption((o) => o.setName('recompensa').setDescription('Qual').setRequired(true).addChoices(...CAMPAIGNS.map((c) => ({ name: c.fragmentReward.label, value: c.fragmentReward.key }))))),
  async execute(ctx, i) {
    const g = ctx.game;
    const sub = i.options.getSubcommand();
    if (sub === 'lista') {
      return i.reply({ embeds: [new EmbedBuilder().setColor(COLORS.warn).setTitle('📜 Campanhas').setDescription(CAMPAIGNS.map((c) =>
        `**${c.name}** — ${regionById.get(c.region)?.name}, nível ${c.minLevel}+${c.requiresExactly ? ` • **exige ${c.requiresExactly} pessoas**` : ' • 1 a 4 pessoas'}\n${c.desc}`).join('\n\n'))] });
    }
    const c = requireCharacter(g, i.user.id);
    if (sub === 'iniciar') {
      const def = campaignById.get(i.options.getString('campanha', true)) ?? fail('Campanha desconhecida.');
      // Cada campanha ganha um tópico próprio quando o canal permite.
      let thread: { id: string; send: (p: unknown) => Promise<unknown> } | undefined;
      try {
        const ch = i.channel as unknown as { threads?: { create: (o: { name: string; autoArchiveDuration: number }) => Promise<{ id: string; send: (p: unknown) => Promise<unknown> }> } } | null;
        if (ch?.threads) thread = await ch.threads.create({ name: `📜 ${def!.name} — ${c.name}`.slice(0, 90), autoArchiveDuration: 10080 });
      } catch { thread = undefined; }
      const run = startCampaign(g, c, def!.id, thread?.id ?? i.channelId);
      const panel = campaignPanel(g, run, [`📜 ${def!.desc}`]);
      if (thread) { await thread.send(panel); return i.reply(`📜 **${def!.name}** começou em <#${thread.id}>.`); }
      return i.reply(panel);
    }
    if (sub === 'fragmentos') {
      const fr = fragments(g, c.id);
      return i.reply(ephemeral(fr.length ? fr.map((f) => {
        const def = CAMPAIGNS.find((x) => x.fragmentReward.key === f.key);
        return `• ${itemById.get(f.key)?.name ?? f.key}: ${f.count}/${def?.fragmentReward.needed ?? '?'}`;
      }).join('\n') : 'Nenhum fragmento ainda. Cada campanha concluída concede um.'));
    }
    if (sub === 'resgatar') { const label = redeemFragments(g, c, i.options.getString('recompensa', true)); return i.reply(`🎁 Você forjou **${label}** a partir dos fragmentos!`); }
    const run = runOf(g, c.id) ?? fail('Você não está em uma campanha.');
    if (sub === 'continuar') {
      const msg = await i.reply({ ...campaignPanel(g, run!), withResponse: true });
      if (run!.combatId && msg.resource?.message) setCombatMessage(g, run!.combatId, msg.resource.message.channelId, msg.resource.message.id);
      return;
    }
    if (sub === 'pausar') { pauseCampaign(g, c, run!.id); return i.reply('⏸️ Campanha pausada. Todos estão livres para outras atividades.'); }
    if (sub === 'retomar') { const r = resumeCampaign(g, c, run!.id); return i.reply(campaignPanel(g, r, ['▶️ Campanha retomada.'])); }
    if (sub === 'abandonar') { abandonCampaign(g, c, run!.id); return i.reply('🏳️ Campanha abandonada.'); }
    if (sub === 'substituir') {
      const out = getCharacterByUser(g, i.options.getUser('sai', true).id) ?? fail('Essa pessoa não tem aventureiro.');
      const inc = getCharacterByUser(g, i.options.getUser('entra', true).id) ?? fail('Essa pessoa não tem aventureiro.');
      const r = substitute(g, c, run!.id, out!.id, inc!);
      return i.reply(campaignPanel(g, r, [`🔁 ${out!.name} sai e ${inc!.name} entra na expedição.`]));
    }
  },
});

import { startCampaign } from '../../services/campaign.ts';

component('cp', async (ctx, i, [action, runId, opt]) => {
  const g = ctx.game;
  const c = requireCharacter(g, i.user.id);
  if (!i.isButton()) return;
  if (action === 'vote') {
    const res = vote(g, c, Number(runId), opt);
    return i.update({ ...campaignPanel(g, res.run, res.text), attachments: [] });
  }
  if (action === 'next') {
    const res = advanceCampaign(g, c, Number(runId));
    if (res.combatId) {
      const panel = combatPanel(g, res.combatId, c, res.text);
      await i.update({ ...panel, attachments: [] });
      const msg = (i as ComponentInteraction & { message: Message }).message;
      setCombatMessage(g, res.combatId, msg.channelId, msg.id);
      return;
    }
    return i.update({ ...campaignPanel(g, res.run, res.text), attachments: [] });
  }
});

export type { Ctx };
void combatEmbed;
