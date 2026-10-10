import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, SlashCommandBuilder, StringSelectMenuBuilder,
  TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { RACES, ORIGINS, PRONOUNS, HEIGHTS, BUILDS, HAIR_STYLES, HAIR_COLORS, EYE_COLORS, MARKS, ATTRIBUTE_INFO, raceById, originById } from '../../data/races.ts';
import { CLASSES, classById, nodeById, nodesByClass, SKILLS, PASSIVES, secondaryAccessibleSkills, MODIFIERS } from '../../data/classes/index.ts';
import { PROFESSIONS, professionById } from '../../data/professions.ts';
import { ATTRIBUTES, type AttributeId, type Effect } from '../../data/types.ts';
import { itemById } from '../../data/items.ts';
import { regionById } from '../../data/regions.ts';
import { TITLES } from '../../data/social.ts';
import { xpForClassLevel } from '../../game/stats.ts';
import { profXpForLevel } from '../../data/professions.ts';
import { fail } from '../../services/core.ts';
import {
  allocateAttribute, allProfs, allProgress, allRep, createCharacter, currentMeal, eat, equippedItems, getCharacterByUser,
  rankProfession, requireCharacter, respecAttributes, setBelt, setMaster, setTitle, snapshot, talentPointsLeft, unspentAttributes,
  unlocksOf, updateAppearance, type Character,
} from '../../services/character.ts';
import {
  changeClass, equipSkills, knownPassives, knownSkills, learnNode, learnSecondarySkill, nodeState, respecCostPreview, respecTalents,
  saveLoadout, setSecondary, useLoadout,
} from '../../services/talents.ts';
import { activePet } from '../../services/pets.ts';
import { renderPortrait } from '../../render/sprites/portrait.ts';
import { skillTreeImage } from '../../render/scenes.ts';
import { command, component, ephemeral } from '../registry.ts';
import { bar, clip, COLORS, gold, image } from '../ui/format.ts';
import type { Game } from '../../services/core.ts';

const choices = <T extends string>(list: readonly T[]) => list.map((x) => ({ name: x, value: x }));

// ===================================================================== ficha

export function characterSheet(g: Game, c: Character) {
  const { derived: d, progress: p } = snapshot(g, c);
  const race = raceById.get(c.race)!;
  const cls = classById.get(c.classId)!;
  const portrait = image(renderPortrait({ race: c.race, raceChoice: c.raceChoice, classId: c.classId, appearance: c.appearance, equipment: equippedItems(g, c.id), region: c.region }).scaled(4), 'retrato');
  const xpNeed = xpForClassLevel(p.level);
  const meal = currentMeal(g, c);
  const pet = activePet(g, c);
  const res = Object.entries(d.resist).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ') || '—';
  const embed = new EmbedBuilder().setColor(parseInt(cls.color.slice(1), 16)).setTitle(`${c.name}${c.title ? ` — ${TITLES.find((t) => t.id === c.title)?.name ?? ''}` : ''}`)
    .setDescription([
      `${race.name} • ${originById.get(c.origin)?.name} • **${cls.name} nível ${p.level}** • ${c.pronouns}`,
      `XP \`${bar(p.xp / xpNeed, 12)}\` ${p.xp}/${xpNeed}`,
      `📍 ${regionById.get(c.region)?.name} (${regionById.get(c.region)?.hub}) • ${gold(c.gold)}`,
      c.story ? `\n_${clip(c.story, 300)}_` : '',
    ].join('\n'))
    .addFields(
      { name: 'Atributos', value: ATTRIBUTES.map((a) => `${ATTRIBUTE_INFO[a].short} **${d.attrs[a]}**`).join(' • ') + (unspentAttributes(p) ? `\n➕ ${unspentAttributes(p)} ponto(s) para distribuir (\`/personagem atributos\`)` : '') },
      { name: 'Combate', value: `❤️ ${d.maxHp} • 🛡️ ${d.armor} • 💨 ${d.dodge}% • 🎯 crítico ${d.crit}% • ⚡ iniciativa ${d.initiative}\n${cls.resource.name} ${d.resourceMax} • arma ${d.weapon.damage} (${d.weapon.range})`, inline: false },
      { name: 'Resistências', value: res, inline: true },
      { name: 'Carga', value: `${d.carry} kg • armadura ${d.armorWeight} kg`, inline: true },
      { name: `Traço racial: ${race.traitName}`, value: race.traitDesc + (c.raceChoice ? ` (${c.raceChoice})` : '') },
    )
    .setImage(portrait.url);
  if (d.penalties.length) embed.addFields({ name: '⚠️ Penalidades', value: d.penalties.join('\n') });
  if (meal) embed.addFields({ name: '🍲 Refeição', value: `${meal.label} até <t:${Math.floor(c.meal!.until / 1000)}:t>`, inline: true });
  if (pet) embed.addFields({ name: '🐾 Companheiro', value: `${pet.name} (nível ${pet.level})`, inline: true });
  return { embeds: [embed], files: [portrait.file] };
}

command({
  data: new SlashCommandBuilder().setName('personagem').setDescription('Seu aventureiro: ficha, aparência e atributos')
    .addSubcommand((s) => s.setName('criar').setDescription('Cria seu aventureiro (um por pessoa, válido em todos os servidores)')
      .addStringOption((o) => o.setName('nome').setDescription('Nome').setRequired(true).setMaxLength(24))
      .addStringOption((o) => o.setName('raca').setDescription('Raça').setRequired(true).addChoices(...RACES.map((r) => ({ name: `${r.name} — ${r.traitName}`, value: r.id }))))
      .addStringOption((o) => o.setName('origem').setDescription('Origem').setRequired(true).addChoices(...ORIGINS.map((x) => ({ name: x.name, value: x.id }))))
      .addStringOption((o) => o.setName('classe').setDescription('Classe inicial').setRequired(true).addChoices(...CLASSES.map((x) => ({ name: `${x.name} — ${x.role}`, value: x.id }))))
      .addStringOption((o) => o.setName('pronomes').setDescription('Pronomes').setRequired(true).addChoices(...choices(PRONOUNS)))
      .addStringOption((o) => o.setName('escolha_racial').setDescription('Draconatos: resistência • Ferais: sentido').addChoices(
        { name: 'Resistência a fogo', value: 'fogo' }, { name: 'Resistência a gelo', value: 'gelo' }, { name: 'Resistência a raio', value: 'raio' }, { name: 'Resistência a veneno', value: 'veneno' },
        { name: 'Olfato', value: 'olfato' }, { name: 'Audição', value: 'audicao' }, { name: 'Visão', value: 'visao' }))
      .addStringOption((o) => o.setName('altura').setDescription('Altura').addChoices(...choices(HEIGHTS)))
      .addStringOption((o) => o.setName('constituicao').setDescription('Constituição').addChoices(...choices(BUILDS)))
      .addStringOption((o) => o.setName('cabelo').setDescription('Cabelo').addChoices(...choices(HAIR_STYLES)))
      .addStringOption((o) => o.setName('cor_cabelo').setDescription('Cor do cabelo').addChoices(...choices(Object.keys(HAIR_COLORS))))
      .addStringOption((o) => o.setName('olhos').setDescription('Olhos').addChoices(...choices(Object.keys(EYE_COLORS))))
      .addIntegerOption((o) => o.setName('pele').setDescription('Tom de pele/escamas/casca (1 a 6)').setMinValue(1).setMaxValue(6))
      .addStringOption((o) => o.setName('marcas').setDescription('Marcas').addChoices(...choices(MARKS)))
      .addStringOption((o) => o.setName('voz').setDescription('Voz (descrição curta)').setMaxLength(40)))
    .addSubcommand((s) => s.setName('ver').setDescription('Mostra a ficha').addUserOption((o) => o.setName('usuario').setDescription('De outra pessoa')))
    .addSubcommand((s) => s.setName('aparencia').setDescription('Ajusta a aparência (não altera atributos)')
      .addStringOption((o) => o.setName('altura').setDescription('Altura').addChoices(...choices(HEIGHTS)))
      .addStringOption((o) => o.setName('constituicao').setDescription('Constituição').addChoices(...choices(BUILDS)))
      .addStringOption((o) => o.setName('cabelo').setDescription('Cabelo').addChoices(...choices(HAIR_STYLES)))
      .addStringOption((o) => o.setName('cor_cabelo').setDescription('Cor do cabelo').addChoices(...choices(Object.keys(HAIR_COLORS))))
      .addStringOption((o) => o.setName('olhos').setDescription('Olhos').addChoices(...choices(Object.keys(EYE_COLORS))))
      .addIntegerOption((o) => o.setName('pele').setDescription('Tom (1 a 6)').setMinValue(1).setMaxValue(6))
      .addStringOption((o) => o.setName('marcas').setDescription('Marcas').addChoices(...choices(MARKS)))
      .addStringOption((o) => o.setName('pronomes').setDescription('Pronomes').setMaxLength(20)))
    .addSubcommand((s) => s.setName('historia').setDescription('Escreve a história curta do personagem'))
    .addSubcommand((s) => s.setName('atributos').setDescription('Distribui pontos de atributo')
      .addStringOption((o) => o.setName('atributo').setDescription('Atributo').setRequired(true).addChoices(...ATTRIBUTES.map((a) => ({ name: `${ATTRIBUTE_INFO[a].name} — ${ATTRIBUTE_INFO[a].desc}`, value: a }))))
      .addIntegerOption((o) => o.setName('pontos').setDescription('Quantos pontos').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('redistribuir_atributos').setDescription('Devolve todos os pontos de atributo (a primeira vez é grátis)'))
    .addSubcommand((s) => s.setName('titulo').setDescription('Escolhe o título exibido').addStringOption((o) => o.setName('titulo').setDescription('Título').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('cinto').setDescription('Define até 4 consumíveis levados para combate')
      .addStringOption((o) => o.setName('item1').setDescription('Item').setAutocomplete(true)).addIntegerOption((o) => o.setName('qtd1').setDescription('Qtd').setMinValue(1).setMaxValue(5))
      .addStringOption((o) => o.setName('item2').setDescription('Item').setAutocomplete(true)).addIntegerOption((o) => o.setName('qtd2').setDescription('Qtd').setMinValue(1).setMaxValue(5))
      .addStringOption((o) => o.setName('item3').setDescription('Item').setAutocomplete(true)).addIntegerOption((o) => o.setName('qtd3').setDescription('Qtd').setMinValue(1).setMaxValue(5))
      .addStringOption((o) => o.setName('item4').setDescription('Item').setAutocomplete(true)).addIntegerOption((o) => o.setName('qtd4').setDescription('Qtd').setMinValue(1).setMaxValue(5)))
    .addSubcommand((s) => s.setName('comer').setDescription('Consome uma refeição (um benefício principal por vez)').addStringOption((o) => o.setName('item').setDescription('Refeição').setRequired(true).setAutocomplete(true))),
  async execute(ctx, i) {
    const g = ctx.game;
    const sub = i.options.getSubcommand();
    if (sub === 'criar') {
      const c = createCharacter(g, i.user.id, {
        name: i.options.getString('nome', true), race: i.options.getString('raca', true), origin: i.options.getString('origem', true),
        classId: i.options.getString('classe', true), pronouns: i.options.getString('pronomes', true), raceChoice: i.options.getString('escolha_racial') ?? undefined,
        appearance: {
          height: i.options.getString('altura') ?? undefined, build: i.options.getString('constituicao') ?? undefined, hair: i.options.getString('cabelo') ?? undefined,
          hairColor: i.options.getString('cor_cabelo') ?? undefined, eyes: i.options.getString('olhos') ?? undefined,
          skin: (i.options.getInteger('pele') ?? 1) - 1, marks: i.options.getString('marcas') ?? undefined, voice: i.options.getString('voz') ?? undefined,
        },
      });
      const sheet = characterSheet(g, c);
      return i.reply({ content: `✨ **${c.name}** foi registrado na Companhia dos Errantes, no Vau dos Errantes. Comece com \`/explorar\`, \`/trabalhar\` ou \`/ajuda\`.`, ...sheet });
    }
    if (sub === 'ver') {
      const u = i.options.getUser('usuario') ?? i.user;
      const c = getCharacterByUser(g, u.id) ?? fail(u.id === i.user.id ? 'Você ainda não tem aventureiro. Use `/personagem criar`.' : 'Essa pessoa não tem aventureiro.');
      return i.reply(characterSheet(g, c!));
    }
    const c = requireCharacter(g, i.user.id);
    if (sub === 'aparencia') {
      updateAppearance(g, c, {
        height: i.options.getString('altura') ?? undefined, build: i.options.getString('constituicao') ?? undefined, hair: i.options.getString('cabelo') ?? undefined,
        hairColor: i.options.getString('cor_cabelo') ?? undefined, eyes: i.options.getString('olhos') ?? undefined, marks: i.options.getString('marcas') ?? undefined,
        skin: i.options.getInteger('pele') ? i.options.getInteger('pele')! - 1 : undefined,
      }, undefined, i.options.getString('pronomes') ?? undefined);
      return i.reply(characterSheet(g, requireCharacter(g, i.user.id)));
    }
    if (sub === 'historia') {
      const modal = new ModalBuilder().setCustomId('pc:story').setTitle('História do personagem').addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('story').setLabel('Quem é você?').setStyle(TextInputStyle.Paragraph).setMaxLength(600).setValue(c.story || '').setRequired(false)));
      return i.showModal(modal);
    }
    if (sub === 'atributos') {
      const p = allocateAttribute(g, c, i.options.getString('atributo', true) as AttributeId, i.options.getInteger('pontos', true));
      return i.reply(ephemeral(`✅ Atributos atualizados. Restam ${unspentAttributes(p)} ponto(s).`));
    }
    if (sub === 'redistribuir_atributos') { const cost = respecAttributes(g, c); return i.reply(ephemeral(`♻️ Pontos devolvidos${cost ? ` (custo ${gold(cost)})` : ' (grátis)'}.`)); }
    if (sub === 'titulo') { setTitle(g, c, i.options.getString('titulo', true)); return i.reply(ephemeral('🏅 Título atualizado.')); }
    if (sub === 'cinto') {
      const belt = [1, 2, 3, 4].map((n) => ({ item: i.options.getString(`item${n}`) ?? '', qty: i.options.getInteger(`qtd${n}`) ?? 2 })).filter((b) => b.item);
      setBelt(g, c, belt);
      return i.reply(ephemeral(`🎒 Cinto: ${c.belt.map((b) => `${b.qty}× ${itemById.get(b.item)?.name}`).join(', ') || 'vazio'}. Os itens são reservados no início de cada combate.`));
    }
    if (sub === 'comer') { const buff = eat(g, c, i.options.getString('item', true)); return i.reply(ephemeral(`🍲 ${buff.label}: ${Object.entries(buff.stats).map(([k, v]) => `${k} +${v}`).join(', ')}${buff.workYield ? `, produção +${buff.workYield * 100}%` : ''}.`)); }
  },
  async autocomplete(ctx, i) {
    const g = ctx.game;
    const c = getCharacterByUser(g, i.user.id);
    if (!c) return i.respond([]);
    const focused = i.options.getFocused(true);
    const q = focused.value.toLowerCase();
    if (focused.name === 'titulo') {
      const owned = new Set(unlocksOf(g, c.id, 'titulo'));
      return i.respond(TITLES.filter((t) => owned.has(t.id) && t.name.toLowerCase().includes(q)).slice(0, 25).map((t) => ({ name: t.name, value: t.id })));
    }
    const rows = g.db.all<{ item_key: string; qty: number }>("SELECT item_key, qty FROM items WHERE owner_kind='char' AND owner_id=? AND data IS NULL AND qty > 0", c.id);
    const filter = focused.name === 'item' ? (k: string) => itemById.get(k)?.use?.t === 'refeicao' : (k: string) => { const u = itemById.get(k)?.use; return !!u && ['cura', 'recurso', 'purificar', 'resistencia', 'regeneracao', 'isca'].includes(u.t); };
    return i.respond(rows.filter((r) => filter(r.item_key) && (itemById.get(r.item_key)?.name.toLowerCase().includes(q) ?? false)).slice(0, 25)
      .map((r) => ({ name: `${itemById.get(r.item_key)!.name} (${r.qty})`, value: r.item_key })));
  },
});

component('pc', async (ctx, i, [action]) => {
  if (action !== 'story' || !i.isModalSubmit()) return;
  const c = requireCharacter(ctx.game, i.user.id);
  updateAppearance(ctx.game, c, {}, i.fields.getTextInputValue('story'));
  return i.reply(ephemeral('📖 História atualizada.'));
});

// ===================================================================== habilidades

function effectText(e: Effect): string {
  switch (e.k) {
    case 'dano': return `dano ${e.elem}${e.hits ? ` ×${e.hits}` : ''}`;
    case 'cura': return 'cura';
    case 'escudo': return 'escudo';
    case 'status': return e.id;
    default: return e.k;
  }
}

function treePanel(g: Game, c: Character, notice?: string) {
  const { progress: p } = snapshot(g, c);
  const cls = classById.get(p.classId)!;
  const nodes = nodesByClass(p.classId);
  const states = Object.fromEntries(nodes.map((n) => [n.id, nodeState(p, n.id)]));
  const img = image(skillTreeImage(p.classId, p.learned, p.level, states), 'arvore');
  const known = knownSkills(p);
  const eq = p.equipped.map((s, idx) => `\`${idx + 1}\` ${SKILLS.get(s)?.name ?? s}`).join(' • ') || '—';
  const embed = new EmbedBuilder().setColor(parseInt(cls.color.slice(1), 16)).setTitle(`🌳 ${cls.name} — nível ${p.level}`)
    .setDescription([
      notice ?? '',
      `**Pontos de talento:** ${talentPointsLeft(p)} • redistribuição: ${respecCostPreview(p) ? gold(respecCostPreview(p)) : 'grátis'}`,
      `**Equipadas (6):** ${eq}`,
      `**Passiva:** ${PASSIVES.get(p.passive ?? '')?.name ?? '—'}`,
      p.secondary ? `**Disciplina secundária:** ${classById.get(p.secondary)?.name}` : '',
      '_Quadrados: ativas • losangos: modificadores (só valem com a habilidade equipada) • círculos: passivas • dourado: culminante._',
    ].filter(Boolean).join('\n'))
    .setImage(img.url);
  const available = nodes.filter((n) => states[n.id] === 'disponivel').slice(0, 25);
  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
  if (available.length) rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId('hb:learn').setPlaceholder('Aprender um nó disponível…')
    .addOptions(available.map((n) => ({ label: clip(`${n.name} (${n.cost} pt)`, 100), value: n.id, description: clip(n.desc, 100) })))));
  const skillOpts = known.slice(0, 25).map((s) => ({ label: clip(SKILLS.get(s)?.name ?? s, 100), value: s, description: clip(`${SKILLS.get(s)?.cost} • recarga ${SKILLS.get(s)?.cooldown} • ${SKILLS.get(s)?.desc}`, 100), default: p.equipped.includes(s) }));
  rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId('hb:equip').setPlaceholder('Equipar até 6 habilidades…').setMinValues(1).setMaxValues(Math.min(6, skillOpts.length)).addOptions(skillOpts)));
  rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId('hb:passive').setPlaceholder('Passiva equipada…')
    .addOptions(knownPassives(p).map((x) => ({ label: clip(PASSIVES.get(x)?.name ?? x, 100), value: x, description: clip(PASSIVES.get(x)?.desc ?? '', 100), default: p.passive === x })))));
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('hb:respec').setStyle(ButtonStyle.Danger).setLabel('Redistribuir talentos')));
  return { embeds: [embed], files: [img.file], components: rows };
}

command({
  data: new SlashCommandBuilder().setName('habilidades').setDescription('Árvores de talento, escolhas e as seis habilidades equipadas')
    .addSubcommand((s) => s.setName('ver').setDescription('Árvores e habilidades equipadas'))
    .addSubcommand((s) => s.setName('detalhes').setDescription('Detalhes de um nó').addStringOption((o) => o.setName('no').setDescription('Nó').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('conjunto').setDescription('Salva ou usa um conjunto (exploração, chefes, coleta…)')
      .addStringOption((o) => o.setName('acao').setDescription('Salvar ou usar').setRequired(true).addChoices({ name: 'salvar', value: 'salvar' }, { name: 'usar', value: 'usar' }))
      .addStringOption((o) => o.setName('nome').setDescription('Nome do conjunto').setRequired(true).setMaxLength(24)))
    .addSubcommand((s) => s.setName('secundaria').setDescription('Disciplina secundária (nível 40+)')
      .addStringOption((o) => o.setName('classe').setDescription('Classe').setRequired(true).addChoices(...CLASSES.map((c) => ({ name: c.name, value: c.id })))))
    .addSubcommand((s) => s.setName('aprender_secundaria').setDescription('Aprende uma habilidade inicial da disciplina secundária (2 pontos)')
      .addStringOption((o) => o.setName('habilidade').setDescription('Habilidade').setRequired(true).setAutocomplete(true))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const sub = i.options.getSubcommand();
    if (sub === 'ver') return i.reply(treePanel(g, c));
    if (sub === 'detalhes') {
      const n = nodeById.get(i.options.getString('no', true)) ?? fail('Nó desconhecido.');
      const s = n!.grants.skill ? SKILLS.get(n!.grants.skill) : undefined;
      const m = n!.grants.modifier ? MODIFIERS.get(n!.grants.modifier) : undefined;
      const lines = [`**${n!.name}** (${n!.kind}) — ${n!.cost} ponto(s), nível ${n!.reqLevel}`, n!.desc];
      if (s) lines.push(`Custo ${s.cost} • recarga ${s.cooldown} • ${s.range} • efeitos: ${s.effects.map(effectText).join(', ')}`);
      if (m) lines.push(`Modifica **${SKILLS.get(m.skill)?.name}**.`);
      if (n!.exclusiveWith) lines.push(`Bifurcação: exclui **${nodeById.get(n!.exclusiveWith)?.name}**.`);
      return i.reply(ephemeral(lines.join('\n')));
    }
    if (sub === 'conjunto') {
      const name = i.options.getString('nome', true);
      if (i.options.getString('acao', true) === 'salvar') return i.reply(ephemeral(`💾 Conjunto **${saveLoadout(g, c, name)}** salvo.`));
      useLoadout(g, c, name);
      return i.reply(treePanel(g, c, `🔁 Conjunto **${name}** equipado.`));
    }
    if (sub === 'secundaria') { setSecondary(g, c, i.options.getString('classe', true)); return i.reply(ephemeral('📘 Disciplina secundária definida. Aprenda habilidades iniciais com `/habilidades aprender_secundaria`.')); }
    if (sub === 'aprender_secundaria') { learnSecondarySkill(g, c, i.options.getString('habilidade', true)); return i.reply(treePanel(g, c, '📘 Habilidade secundária aprendida.')); }
  },
  async autocomplete(ctx, i) {
    const c = getCharacterByUser(ctx.game, i.user.id);
    if (!c) return i.respond([]);
    const f = i.options.getFocused(true);
    const q = f.value.toLowerCase();
    const p = snapshot(ctx.game, c).progress;
    if (f.name === 'habilidade') {
      if (!p.secondary) return i.respond([]);
      return i.respond(secondaryAccessibleSkills(p.secondary).map((s) => ({ name: SKILLS.get(s)!.name, value: s })).filter((x) => x.name.toLowerCase().includes(q)));
    }
    return i.respond(nodesByClass(p.classId).filter((n) => n.name.toLowerCase().includes(q)).slice(0, 25).map((n) => ({ name: `${n.name} (${n.treeId})`, value: n.id })));
  },
});

component('hb', async (ctx, i, [action]) => {
  const g = ctx.game;
  const c = requireCharacter(g, i.user.id);
  if (i.isStringSelectMenu()) {
    if (action === 'learn') { const n = nodeById.get(i.values[0]); learnNode(g, c, i.values[0]); return i.update({ ...treePanel(g, c, `✅ Aprendido: **${n?.name}**`), attachments: [] }); }
    if (action === 'equip') { equipSkills(g, c, i.values); return i.update({ ...treePanel(g, c, '✅ Habilidades equipadas.'), attachments: [] }); }
    if (action === 'passive') { const p = snapshot(g, c).progress; equipSkills(g, c, p.equipped, i.values[0]); return i.update({ ...treePanel(g, c, '✅ Passiva equipada.'), attachments: [] }); }
  }
  if (i.isButton() && action === 'respec') {
    const cost = respecTalents(g, c);
    return i.update({ ...treePanel(g, c, `♻️ Talentos redistribuídos${cost ? ` por ${gold(cost)}` : ' (grátis)'}.`), attachments: [] });
  }
});

// ===================================================================== classe, profissões, reputação

command({
  data: new SlashCommandBuilder().setName('classe').setDescription('Progresso por classe e troca no santuário')
    .addSubcommand((s) => s.setName('ver').setDescription('Progresso de cada classe'))
    .addSubcommand((s) => s.setName('trocar').setDescription('Troca de classe (fora de atividades). A experiência de cada classe fica salva.')
      .addStringOption((o) => o.setName('classe').setDescription('Nova classe').setRequired(true).addChoices(...CLASSES.map((c) => ({ name: c.name, value: c.id }))))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    if (i.options.getSubcommand() === 'trocar') {
      const p = changeClass(g, c, i.options.getString('classe', true));
      return i.reply(`⛩️ No santuário, ${c.name} assume o caminho de **${classById.get(p.classId)?.name}** (nível ${p.level}). Profissões e história permanecem.`);
    }
    const list = allProgress(g, c.id);
    return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('⛩️ Classes').setDescription(
      list.map((p) => `${p.classId === c.classId ? '➡️' : '•'} **${classById.get(p.classId)?.name}** nível ${p.level} (${p.xp}/${xpForClassLevel(p.level)} XP)`).join('\n'))] }));
  },
});

command({
  data: new SlashCommandBuilder().setName('profissoes').setDescription('Profissões, especializações e mestres')
    .addSubcommand((s) => s.setName('ver').setDescription('Níveis e especializações'))
    .addSubcommand((s) => s.setName('especializar').setDescription('Gasta um ponto em um ramo (1 ponto a cada 10 níveis)')
      .addStringOption((o) => o.setName('profissao').setDescription('Profissão').setRequired(true).addChoices(...PROFESSIONS.map((p) => ({ name: p.name, value: p.id }))))
      .addStringOption((o) => o.setName('ramo').setDescription('Ramo').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('mestre').setDescription('Define uma das duas especialidades de mestre (nível até 100)')
      .addStringOption((o) => o.setName('profissao').setDescription('Profissão').setRequired(true).addChoices(...PROFESSIONS.map((p) => ({ name: p.name, value: p.id }))))
      .addStringOption((o) => o.setName('substituir').setDescription('Mestre a substituir (troca paga)').addChoices(...PROFESSIONS.map((p) => ({ name: p.name, value: p.id }))))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const sub = i.options.getSubcommand();
    if (sub === 'especializar') {
      const p = rankProfession(g, c, i.options.getString('profissao', true), i.options.getString('ramo', true));
      return i.reply(ephemeral(`📈 ${professionById.get(p.professionId)?.name}: ${Object.entries(p.ranks).map(([k, v]) => `${k} ${v}`).join(', ')}.`));
    }
    if (sub === 'mestre') {
      const cost = setMaster(g, c, i.options.getString('profissao', true), i.options.getString('substituir') ?? undefined);
      return i.reply(ephemeral(`🎓 Especialidade de mestre definida${cost ? ` (custo ${gold(cost)})` : ''}. Mestres: ${c.masters.map((m) => professionById.get(m)?.name).join(', ')}.`));
    }
    const profs = allProfs(g, c.id);
    return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🛠️ Profissões').setDescription(profs.map((p) => {
      const def = professionById.get(p.professionId)!;
      const master = c.masters.includes(p.professionId);
      const ranks = def.branches.map((b) => `${b.name} ${p.ranks[b.id] ?? 0}/${b.maxRank}`).join(' • ');
      return `${master ? '🎓' : '•'} **${def.name}** ${p.level}/${master ? 100 : 50} \`${bar(p.xp / profXpForLevel(p.level), 8)}\`\n   ${ranks}`;
    }).join('\n')).setFooter({ text: `Mestres: ${c.masters.length}/2 — não-mestres param no nível 50` })] }));
  },
  async autocomplete(ctx, i) {
    const prof = professionById.get(i.options.getString('profissao') ?? '');
    return i.respond((prof?.branches ?? []).map((b) => ({ name: `${b.name} — ${b.desc}`.slice(0, 100), value: b.id })));
  },
});

command({
  data: new SlashCommandBuilder().setName('reputacao').setDescription('Reputação com as facções'),
  async execute(ctx, i) {
    const c = requireCharacter(ctx.game, i.user.id);
    const reps = allRep(ctx.game, c.id);
    return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🏳️ Reputação').setDescription(reps.map((r) =>
      `**${r.faction.name}** — ${r.label} (${r.value})\n_${r.faction.desc}_`).join('\n'))] }));
  },
});

command({
  data: new SlashCommandBuilder().setName('ajuda').setDescription('Como jogar Ecos do Véu'),
  async execute(_ctx, i) {
    return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.main).setTitle('🌒 Ecos do Véu').setDescription([
      'O Véu está se rompendo. Prepare-se, explore, trabalhe e enfrente desafios cada vez maiores.',
      '',
      '**Começo:** `/personagem criar` → `/habilidades ver` → `/explorar`',
      '**Ciclo:** preparar (`/equipamento`, `/fabricar`, `/personagem cinto`) → explorar/trabalhar/contratos → materiais e conhecimento → aprimorar → desafios maiores',
      '**Automático:** `/trabalhar` (ordens com previsão e regras de parada), `/pet missao`, filas de `/fabricar`. Tudo continua com o Discord fechado; veja em `/atividade`.',
      '**Cooperativo:** `/grupo` + `/campanha` (ao vivo ou assíncrono).',
      '**Social:** `/guilda`, `/mercado`, encomendas, `/contratos`.',
      '**Mundo:** `/viajar`, `/bestiario`, `/reputacao`, `/loja`.',
    ].join('\n'))] }));
  },
});

void ORIGINS;
