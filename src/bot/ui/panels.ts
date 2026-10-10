import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type AttachmentBuilder } from 'discord.js';
import { regionById, WEATHER_LABEL } from '../../data/regions.ts';
import { EVENT_INFO } from '../../data/exploration.ts';
import { campaignById } from '../../data/campaigns.ts';
import { activeEvent } from '../../data/events.ts';
import type { Game } from '../../services/core.ts';
import { getCharacter, type Character } from '../../services/character.ts';
import { currentExploration } from '../../services/exploration.ts';
import { currentNode, type Run } from '../../services/campaign.ts';
import { loadCombat } from '../../services/combat.ts';
import { actionRows, combatEmbed, partyRows } from './combat.ts';
import { bar, clip, COLORS, itemList, gold } from './format.ts';

export interface Panel { content?: string; embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder | import('discord.js').StringSelectMenuBuilder>[]; files: AttachmentBuilder[] }

export function combatPanel(g: Game, combatId: string, viewer?: Character, extra: string[] = []): Panel {
  const loaded = loadCombat(g, combatId);
  if (!loaded) return { content: 'Combate não encontrado.', embeds: [], components: [], files: [] };
  const st = loaded.state;
  const { embeds, files } = combatEmbed(g, st, extra);
  if (st.context.partySize > 1) return { embeds, files, components: partyRows(combatId, !!st.outcome) };
  const me = viewer ? st.fighters.find((f) => f.id === `p${viewer.id}`) : st.fighters.find((f) => f.kind === 'jogador');
  return { embeds, files, components: me ? actionRows(st, me, combatId) : [] };
}

export function explorePanel(g: Game, c: Character, extra: string[] = []): Panel {
  const ex = currentExploration(g, c.id);
  if (!ex) {
    return {
      embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🧭 Exploração encerrada').setDescription(extra.join('\n') || 'Você está na cidade.')],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('ex:start').setLabel('Explorar novamente').setStyle(ButtonStyle.Primary).setEmoji('🧭'))],
      files: [],
    };
  }
  if (ex.state.combatId) return combatPanel(g, ex.state.combatId, c, extra);
  const st = ex.state;
  const reg = regionById.get(st.region)!;
  const desc = [
    `**${reg.name}** • passo ${st.step + 1}/${st.maxSteps} • ${WEATHER_LABEL[st.weather] ?? st.weather}`,
    `❤️ \`${bar(st.hpPct)}\` ${Math.round(st.hpPct * 100)}%`,
    `🎒 Mochila (não guardada): ${itemList(st.backpack, 'vazia')}${st.gold ? ` • ${gold(st.gold)}` : ''}`,
    ...(activeEvent(st.region, g.now()) ? [`✨ Evento da semana: **${activeEvent(st.region, g.now())!.name}** — ${activeEvent(st.region, g.now())!.desc}`] : []),
    '',
    ...extra,
    ...(extra.length ? [''] : []),
    '**Caminhos à frente:**',
    ...st.paths.map((p, i) => `\`${i + 1}\` **${p.name}** — ${p.revealed ? `${EVENT_INFO[p.kind].label}` : `_${p.hint}_`}`),
  ];
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...st.paths.map((p, i) => new ButtonBuilder().setCustomId(`ex:go:${i}`).setStyle(p.kind === 'covil' ? ButtonStyle.Danger : ButtonStyle.Primary).setLabel(clip(p.name, 60))),
    new ButtonBuilder().setCustomId('ex:back').setStyle(ButtonStyle.Secondary).setLabel('Voltar à cidade').setEmoji('🏠'),
  );
  return { embeds: [new EmbedBuilder().setColor(COLORS.main).setTitle('🧭 Exploração').setDescription(clip(desc.join('\n'), 4000))], components: [row], files: [] };
}

export function campaignPanel(g: Game, run: Run, extra: string[] = []): Panel {
  const def = campaignById.get(run.campaignId)!;
  if (run.combatId) {
    const loaded = loadCombat(g, run.combatId);
    if (loaded && !loaded.state.outcome) return combatPanel(g, run.combatId, undefined, extra);
  }
  const members = run.members.map((id) => getCharacter(g, id)!).filter(Boolean);
  const cur = run.status === 'ativa' ? currentNode(g, run) : null;
  const lines: string[] = [...extra];
  if (extra.length) lines.push('');
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (run.status === 'concluida') lines.push('🎉 Campanha concluída.');
  else if (run.status === 'pausada') {
    lines.push('⏸️ Campanha pausada em um acampamento. Quem lidera pode retomá-la com `/campanha retomar`.');
  } else if (cur) {
    const ch = def.chapters[cur.chapter];
    lines.push(`**Capítulo ${cur.chapter + 1}: ${ch.title}**`);
    const n = cur.node;
    const row = new ActionRowBuilder<ButtonBuilder>();
    if (n.t === 'escolha') {
      lines.push(`🔀 ${n.text}`);
      const votes = run.votes[`${run.chapter}:${run.node}`] ?? {};
      for (const o of n.options) {
        const count = Object.values(votes).filter((v) => v === o.id).length;
        lines.push(`• **${o.label}** — ${o.desc}${count ? ` (${count} voto${count > 1 ? 's' : ''})` : ''}`);
        row.addComponents(new ButtonBuilder().setCustomId(`cp:vote:${run.id}:${o.id}`).setStyle(ButtonStyle.Primary).setLabel(clip(o.label, 70)));
      }
      if (run.deadlineAt) lines.push(`⏳ Prazo da votação: <t:${Math.floor(run.deadlineAt / 1000)}:R>`);
    } else {
      const label = n.t === 'combate' ? 'Enfrentar' : n.t === 'chefe' ? 'Enfrentar o chefe' : n.t === 'acampamento' ? 'Montar acampamento' : 'Continuar';
      lines.push(n.t === 'combate' || n.t === 'chefe' ? '⚔️ Um confronto aguarda o grupo.' : '📜 A história continua…');
      row.addComponents(new ButtonBuilder().setCustomId(`cp:next:${run.id}`).setStyle(n.t === 'chefe' ? ButtonStyle.Danger : ButtonStyle.Success).setLabel(label));
    }
    rows.push(row);
  }
  lines.push('', `👥 ${members.map((m) => `${m.name} ${Math.round((run.state.hp[m.id] ?? 1) * 100)}%`).join(' • ')}`);
  lines.push(`Ritmo: ${run.mode === 'assincrono' ? `assíncrono (prazo ${run.deadlineHours}h)` : 'ao vivo'}`);
  return {
    embeds: [new EmbedBuilder().setColor(COLORS.warn).setTitle(`📜 ${def.name}`).setDescription(clip(lines.join('\n'), 4000)).setFooter({ text: `Campanha #${run.id}` })],
    components: rows, files: [],
  };
}
