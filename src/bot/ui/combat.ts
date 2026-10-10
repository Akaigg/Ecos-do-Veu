import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, type AttachmentBuilder,
} from 'discord.js';
import { itemById } from '../../data/items.ts';
import { fieldById } from '../../data/minions.ts';
import { STATUS_INFO, type CombatState, type Fighter } from '../../game/combat/state.ts';
import { describeIntent, skillUsable, validTargets } from '../../game/combat/engine.ts';
import { battleImage } from '../../render/scenes.ts';
import { getCharacter } from '../../services/character.ts';
import type { Game } from '../../services/core.ts';
import { bar, clip, COLORS, image } from './format.ts';

/** Alvo escolhido por jogador em cada combate (memória; o padrão é automático). */
export const targetChoice = new Map<string, string>();
/** Movimento entre linhas marcado para acompanhar a próxima ação (uma ação principal + um movimento por rodada). */
export const moveChoice = new Set<string>();
export const tkey = (combatId: string, charId: number) => `${combatId}:${charId}`;

function statusLine(f: Fighter): string {
  const s = f.statuses.filter((x) => x.dur > 0 || x.stacks > 1).map((x) => `${STATUS_INFO[x.id].icon}${x.stacks > 1 ? x.stacks : ''}`);
  return s.join('');
}

function fighterLine(f: Fighter, withRes = false): string {
  const pct = f.hp / Math.max(1, f.maxHp);
  const line = f.line === 'frente' ? '⚔️' : '🏹';
  const res = withRes && f.res ? ` • ${f.res.name} ${Math.floor(f.res.cur)}/${f.res.max}` : '';
  const shield = f.shield > 0 ? ` 🛡️${f.shield}` : '';
  const dead = f.alive ? '' : ' ✝';
  return `${line} **${f.name}**${dead} \`${bar(pct, 8)}\` ${Math.max(0, f.hp)}/${f.maxHp}${shield}${res} ${statusLine(f)}`;
}

export function combatEmbed(g: Game, st: CombatState, extra: string[] = []): { embeds: EmbedBuilder[]; files: AttachmentBuilder[] } {
  const heroes = st.fighters.filter((f) => f.side === 'herois' && (f.alive || f.kind === 'jogador'));
  const enemies = st.fighters.filter((f) => f.side === 'inimigos' && f.alive);
  const lines: string[] = [];
  lines.push('**Inimigos**');
  for (const e of enemies) {
    lines.push(fighterLine(e));
    const intent = describeIntent(st, e);
    if (intent) lines.push(`  ↳ ${intent}`);
  }
  for (const m of st.meters) lines.push(`📈 **${m.label}** \`${bar(m.value / m.max)}\` ${m.value}/${m.max}`);
  for (const fl of st.fields) lines.push(`🌍 ${fieldById.get(fl.id)?.name ?? fl.id}${fl.rounds < 50 ? ` (${fl.rounds} rodadas)` : ''}`);
  lines.push('', '**Grupo**');
  for (const h of heroes) lines.push(fighterLine(h, h.kind === 'jogador'));
  const pending = st.fighters.filter((f) => f.kind === 'jogador' && f.alive && !st.pending[f.id]);
  if (!st.outcome && st.context.partySize > 1) lines.push(`\n⏳ Aguardando: ${pending.map((p) => p.name).join(', ') || '—'}`);
  const log = [...extra, ...st.log].slice(-14);
  const color = st.outcome === 'vitoria' ? COLORS.ok : st.outcome === 'derrota' ? COLORS.bad : COLORS.main;
  const title = st.outcome === 'vitoria' ? '🏆 Vitória' : st.outcome === 'derrota' ? '💀 Derrota' : st.outcome === 'fuga' ? '🏃 Fuga' : `⚔️ Combate — Rodada ${st.round}`;
  const img = image(battleImage(st, (f) => (f.kind === 'jogador' ? getCharacter(g, Number(f.ref))?.classId : undefined)), `batalha-${st.round}`);
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(clip(lines.join('\n'), 3800)).setImage(img.url);
  if (log.length) embed.addFields({ name: 'Última rodada', value: clip(log.join('\n'), 1024) });
  return { embeds: [embed], files: [img.file] };
}

export function skillPanelText(st: CombatState, f: Fighter): string {
  return f.skills.map((s, i) => {
    const cd = f.cooldowns[s.id] ?? 0;
    const why = skillUsable(st, f, s);
    const tgt = { si: 'em si', inimigo: 'alvo', aliado: 'aliado', todos_inimigos: 'todos inimigos', todos_aliados: 'grupo', linha_inimiga: 'linha', nenhum: '—' }[s.target];
    return `\`${i + 1}\` **${s.name}** — ${s.cost} ${f.res?.name ?? ''} • recarga ${s.cooldown} • ${s.range === 'corpo' ? 'corpo' : 'distância'} • ${tgt}${cd ? ` ⏳${cd}` : ''}${why && !cd ? ' ⛔' : ''}`;
  }).join('\n');
}

/** Usabilidade considerando o movimento marcado para acompanhar a ação (ele acontece antes). */
function usableAfterMove(st: CombatState, f: Fighter, s: Fighter['skills'][number], moving: boolean): string | null {
  if (!moving) return skillUsable(st, f, s);
  const line = f.line;
  f.line = line === 'frente' ? 'tras' : 'frente';
  try { return skillUsable(st, f, s); } finally { f.line = line; }
}

/** Botões e menus de ação de um jogador: 6 habilidades em duas fileiras + ações universais + alvo + extras. */
export function actionRows(st: CombatState, f: Fighter, combatId: string): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  if (st.outcome || !f.alive) return [];
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  const btn = (s: (typeof f.skills)[number], i: number) => {
    const cd = f.cooldowns[s.id] ?? 0;
    const blocked = !!usableAfterMove(st, f, s, moveChoice.has(tkey(combatId, Number(f.ref))));
    return new ButtonBuilder().setCustomId(`cb:sk:${combatId}:${i}`).setStyle(s.culminant ? ButtonStyle.Success : ButtonStyle.Primary)
      .setLabel(clip(`${s.name}${cd ? ` ⏳${cd}` : ` (${s.cost})`}`, 80)).setDisabled(blocked);
  };
  const first = f.skills.slice(0, 3), second = f.skills.slice(3, 6);
  if (first.length) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(first.map((s, i) => btn(s, i))));
  if (second.length) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(second.map((s, i) => btn(s, i + 3))));
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`cb:atk:${combatId}`).setStyle(ButtonStyle.Secondary).setLabel('Atacar').setEmoji('🗡️'),
    new ButtonBuilder().setCustomId(`cb:def:${combatId}`).setStyle(ButtonStyle.Secondary).setLabel('Defender').setEmoji('🛡️'),
    new ButtonBuilder().setCustomId(`cb:mov:${combatId}`).setStyle(moveChoice.has(tkey(combatId, Number(f.ref))) ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setLabel(`${f.line === 'frente' ? 'Recuar' : 'Avançar'}${moveChoice.has(tkey(combatId, Number(f.ref))) ? ' ✓ (com a próxima ação)' : ' + ação'}`).setEmoji('↔️'),
  ));
  const charId = Number(f.ref);
  const chosen = targetChoice.get(tkey(combatId, charId));
  const enemies = validTargets(st, f, 'inimigo', false);
  const allies = st.fighters.filter((x) => x.side === f.side && (x.alive || x.kind === 'jogador'));
  const opts = [...enemies.map((e) => ({ label: clip(`🎯 ${e.name} (${e.hp}/${e.maxHp})`, 100), value: e.id, default: chosen === e.id })),
    ...allies.map((a) => ({ label: clip(`💚 ${a.name} (${a.hp}/${a.maxHp})${a.alive ? '' : ' ✝'}`, 100), value: a.id, default: chosen === a.id }))].slice(0, 25);
  if (opts.length) rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(`cb:tgt:${combatId}`).setPlaceholder('Alvo (automático se não escolher)').addOptions(opts)));
  const more: { label: string; value: string; description?: string }[] = [];
  for (const b of f.belt ?? []) {
    if (b.qty <= 0) continue;
    const def = itemById.get(b.item);
    if (!def?.use) continue;
    if (def.use.t === 'isca') more.push({ label: clip(`🪤 Domar alvo com ${def.name} (${b.qty})`, 100), value: `domar:${b.item}`, description: 'Alvo domável abaixo de 35% de vida' });
    else more.push({ label: clip(`🧪 ${def.name} (${b.qty})${def.kind === 'pocao' && f.potionCd ? ` ⏳${f.potionCd}` : ''}`, 100), value: `item:${b.item}`, description: 'Consome a ação principal' });
  }
  more.push({ label: '🔍 Analisar o alvo', value: 'analisar', description: 'Revela fraquezas e registra no bestiário' });
  if (st.context.canFlee) more.push({ label: '🏃 Fugir', value: 'fugir' });
  rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(`cb:more:${combatId}`).setPlaceholder('Itens do cinto, domar, analisar…').addOptions(more.slice(0, 25))));
  return rows.slice(0, 5);
}

/** Painel compartilhado de grupo: só mostra o estado e um botão para cada um abrir suas ações. */
export function partyRows(combatId: string, done: boolean): ActionRowBuilder<ButtonBuilder>[] {
  if (done) return [];
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`cb:act:${combatId}`).setStyle(ButtonStyle.Primary).setLabel('Escolher minha ação').setEmoji('⚔️'),
    new ButtonBuilder().setCustomId(`cb:ref:${combatId}`).setStyle(ButtonStyle.Secondary).setLabel('Atualizar').setEmoji('🔄'),
  )];
}
