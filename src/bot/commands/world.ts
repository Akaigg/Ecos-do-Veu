import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { REGIONS, regionById, HAZARD_INFO } from '../../data/regions.ts';
import { ALL_MONSTERS, monsterById, bossById, MECHANIC_INFO, FAMILIES, COMMONS, VARIANTS, BOSSES } from '../../data/monsters/index.ts';
import { itemById } from '../../data/items.ts';
import { PET_AFFINITIES, PET_MISSION_DURATIONS, petTraitById, petXpForLevel } from '../../data/pets.ts';
import { GUILD_RANKS, GUILD_UPGRADES, guildUpgradeById, type GuildRank } from '../../data/social.ts';
import { ARMOR_MODELS, CLOAK_MODELS, JEWELRY_MODELS, WEAPON_MODELS, REINFORCEMENTS, LININGS, FINISHES, materialByItem } from '../../data/equipment.ts';
import { GLYPHS } from '../../render/sprites/icons.ts';
import { activeEvent } from '../../data/events.ts';
import { fail, type Game } from '../../services/core.ts';
import { getCharacterByUser, requireCharacter, travel, type Character } from '../../services/character.ts';
import { knowsWeakness, weatherOf } from '../../services/exploration.ts';
import { feedPet, getPet, listPets, missionPreview, releasePet, renamePet, setActivePet, stableCap, startPetMission } from '../../services/pets.ts';
import { claimContract, listContracts } from '../../services/contracts.ts';
import {
  acceptCommission, buyListing, cancelCommission, cancelListing, createCommission, createListing, listingLabel, myCommissions, myListings,
  openCommissions, searchListings,
} from '../../services/market.ts';
import {
  acceptGuildInvite, contribute, createGuild, depositGold, depositItem, guildOf, guildUpgradeLevel, inviteToGuild, kick, leaveGuild, memberCap,
  members, pendingGuildInvites, setBanner, setRank, startProject, vault, vaultLog, withdraw,
} from '../../services/guild.ts';
import { uniqueItems } from '../../services/gear.ts';
import { bestiaryGrid, guildHall, itemCatalog, worldMap } from '../../render/scenes.ts';
import { monsterThumb } from '../../render/sprites/monsters.ts';
import { command, component, ephemeral } from '../registry.ts';
import { bar, clip, COLORS, gold, image, imageBuf, itemList, itemName, ts } from '../ui/format.ts';
import type { EquipSpec } from '../../game/crafting.ts';

// ===================================================================== viagem e mapa

command({
  data: new SlashCommandBuilder().setName('viajar').setDescription('Mapa do mundo e viagens entre regiões')
    .addStringOption((o) => o.setName('destino').setDescription('Região de destino (vazio = só ver o mapa)').setAutocomplete(true)),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const dest = i.options.getString('destino');
    if (dest) {
      const cost = travel(g, c, dest);
      const reg = regionById.get(dest)!;
      const map = image(worldMap(reg.id, c.visited), 'mapa');
      return i.reply({ embeds: [new EmbedBuilder().setColor(parseInt(reg.color.slice(1), 16)).setTitle(`🧭 ${reg.name} — ${reg.hub}`)
        .setDescription(`${reg.desc}\n\nNíveis ${reg.levels[0]}–${reg.levels[1]}${reg.hazard ? ` • Perigo ambiental: **${HAZARD_INFO[reg.hazard].label}** (${HAZARD_INFO[reg.hazard].counters})` : ''}\nViagem: ${gold(cost)}`).setImage(map.url)], files: [map.file] });
    }
    const reg = regionById.get(c.region)!;
    const map = image(worldMap(c.region, c.visited), 'mapa');
    return i.reply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🗺️ Mapa do Véu').setImage(map.url).setDescription(
      `Você está em **${reg.name}** (${reg.hub}). Clima agora: ${weatherOf(reg, g.now())}.\n` +
      REGIONS.map((r) => { const ev = activeEvent(r.id, g.now()); return `${c.visited.includes(r.id) ? '🟢' : '⚫'} ${r.name} — níveis ${r.levels[0]}–${r.levels[1]}${ev ? ` • ✨ ${ev.name}` : ''}`; }).join('\n') +
      `${activeEvent(c.region, g.now()) ? `\n\n✨ **Evento aqui:** ${activeEvent(c.region, g.now())!.name} — ${activeEvent(c.region, g.now())!.desc}` : ''}`)], files: [map.file] });
  },
  async autocomplete(ctx, i) {
    const q = i.options.getFocused().toLowerCase();
    return i.respond(REGIONS.filter((r) => r.name.toLowerCase().includes(q)).map((r) => ({ name: `${r.name} (nível ${r.minLevel}+, ${r.travelCost} ouro)`, value: r.id })));
  },
});

// ===================================================================== bestiário

command({
  data: new SlashCommandBuilder().setName('bestiario').setDescription('Criaturas, pistas, materiais e descobertas')
    .addStringOption((o) => o.setName('criatura').setDescription('Criatura').setAutocomplete(true))
    .addStringOption((o) => o.setName('regiao').setDescription('Filtrar por região').addChoices(...REGIONS.map((r) => ({ name: r.name, value: r.id })))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const entries = new Map(g.db.all<{ monster_id: string; kills: number; seen: number; analyzed: number }>('SELECT * FROM bestiary WHERE character_id = ?', c.id).map((r) => [r.monster_id, r]));
    const id = i.options.getString('criatura');
    if (!id) {
      const region = i.options.getString('regiao') ?? c.region;
      const ids = ALL_MONSTERS.filter((m) => m.region === region).map((m) => m.id);
      const img = image(bestiaryGrid(ids, new Set(entries.keys()), 10).scaled(2), 'bestiario');
      const total = ALL_MONSTERS.length;
      return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle(`📖 Bestiário — ${regionById.get(region)?.name}`).setImage(img.url)
        .setDescription(`Registradas: **${entries.size}/${total}** (comuns ${COMMONS.filter((m) => entries.has(m.id)).length}/120 • variantes ${VARIANTS.filter((m) => entries.has(m.id)).length}/50 • chefes ${BOSSES.filter((m) => entries.has(m.id)).length}/20)`)], files: [img.file] }));
    }
    const m = monsterById.get(id) ?? fail('Criatura desconhecida.');
    const e = entries.get(m!.id);
    if (!e) fail('Você ainda não encontrou essa criatura.');
    const known = knowsWeakness(g, c.id, m!.id);
    const thumb = imageBuf(monsterThumb(m!.id, 3), 'criatura');
    const lines = [
      `**${m!.rank === 'chefe' ? `Chefe — ${bossById.get(m!.id)?.title}` : m!.rank === 'variante' ? 'Variante' : 'Comum'}** • ${regionById.get(m!.region)?.name} • nível ${m!.level} • ${FAMILIES[m!.family]?.label ?? m!.family}`,
      `_${m!.habit}_`,
      '',
      `Abatidos: ${e!.kills} • Encontros: ${e!.seen}${m!.tameable ? ' • 🐾 domável' : ''}`,
      `Fraquezas: ${known ? (m!.weak.join(', ') || 'nenhuma') : '❓ (analise em combate ou derrote 5)'}`,
      `Resistências: ${known ? (m!.resist.join(', ') || 'nenhuma') : '❓'}`,
      `Materiais: ${[...new Set(m!.drops.map((d) => itemName(d.item)))].slice(0, 8).join(', ')}`,
    ];
    const mech = m!.tags.find((t) => t.startsWith('mecanica:'))?.slice(9) as keyof typeof MECHANIC_INFO | undefined;
    if (mech) lines.push('', `**${MECHANIC_INFO[mech].label}:** ${MECHANIC_INFO[mech].desc}`, `💡 ${MECHANIC_INFO[mech].hint}`);
    const boss = bossById.get(m!.id);
    if (boss) lines.push('', `**Mecânica:** ${boss.mechanic}`, `**Recompensa:** ${boss.reward}`, `Grupo sugerido: ${boss.partySuggested}`);
    if (m!.base) lines.push(`Variante de: ${monsterById.get(m!.base)?.name}`);
    return i.reply(ephemeral({ embeds: [new EmbedBuilder().setColor(m!.rank === 'chefe' ? COLORS.warn : COLORS.info).setTitle(`📖 ${m!.name}`).setThumbnail(thumb.url).setDescription(lines.join('\n'))], files: [thumb.file] }));
  },
  async autocomplete(ctx, i) {
    const c = getCharacterByUser(ctx.game, i.user.id);
    if (!c) return i.respond([]);
    const q = i.options.getFocused().toLowerCase();
    const seen = ctx.game.db.all<{ monster_id: string }>('SELECT monster_id FROM bestiary WHERE character_id = ?', c.id).map((r) => r.monster_id);
    return i.respond(seen.map((id) => monsterById.get(id)!).filter((m) => m && m.name.toLowerCase().includes(q)).slice(0, 25).map((m) => ({ name: `${m.name} (${m.rank})`, value: m.id })));
  },
});

// ===================================================================== pets

function petList(g: Game, c: Character) {
  const pets = listPets(g, c.id);
  const grid = image(bestiaryGrid(pets.map((p) => p.species), new Set(pets.map((p) => p.species)), Math.max(1, Math.min(5, pets.length))).scaled(2), 'pets');
  const lines = pets.map((p, n) => {
    const st = p.status === 'missao' ? `🧭 missão (volta ${ts(p.mission!.endsAt)})` : p.status === 'ativo' ? '⭐ acompanhando' : p.injuredUntil && p.injuredUntil > g.now() ? `🤕 ferido até ${ts(p.injuredUntil, 't')}` : '🏠 estábulo';
    return `\`${n + 1}\` **${p.name}** (${monsterById.get(p.species)?.name}) nível ${p.level} \`${bar(p.xp / petXpForLevel(p.level), 6)}\` • ${PET_AFFINITIES[p.affinity]?.label} • lealdade ${p.loyalty} • ${p.traits.map((t) => petTraitById.get(t)?.name).join(', ')}\n   ${st}`;
  });
  return { embeds: [new EmbedBuilder().setColor(COLORS.ok).setTitle(`🐾 Estábulo (${pets.length}/${stableCap(g, c)})`).setDescription(lines.join('\n') || 'Nenhum pet. Dome criaturas enfraquecidas em combate usando uma isca no cinto (`/personagem cinto`).').setImage(pets.length ? grid.url : null)], files: pets.length ? [grid.file] : [] };
}

command({
  data: new SlashCommandBuilder().setName('pet').setDescription('Criaturas domadas: companhia e missões')
    .addSubcommand((s) => s.setName('ver').setDescription('Seu estábulo'))
    .addSubcommand((s) => s.setName('ativar').setDescription('Leva um pet como companheiro (apoio limitado em combate)').addStringOption((o) => o.setName('pet').setDescription('Pet').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('guardar').setDescription('Deixa o companheiro no estábulo'))
    .addSubcommand((s) => s.setName('missao').setDescription('Envia um pet em missão automática')
      .addStringOption((o) => o.setName('pet').setDescription('Pet').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('regiao').setDescription('Região visitada').setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) => o.setName('horas').setDescription('Duração').setRequired(true).addChoices(...PET_MISSION_DURATIONS.map((h) => ({ name: `${h}h`, value: h })))))
    .addSubcommand((s) => s.setName('alimentar').setDescription('Petisco: lealdade e recuperação').addStringOption((o) => o.setName('pet').setDescription('Pet').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('renomear').setDescription('Novo nome').addStringOption((o) => o.setName('pet').setDescription('Pet').setRequired(true).setAutocomplete(true)).addStringOption((o) => o.setName('nome').setDescription('Nome').setRequired(true).setMaxLength(24)))
    .addSubcommand((s) => s.setName('libertar').setDescription('Devolve o pet à natureza').addStringOption((o) => o.setName('pet').setDescription('Pet').setRequired(true).setAutocomplete(true))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const sub = i.options.getSubcommand();
    const petId = () => Number(i.options.getString('pet', true));
    if (sub === 'ver') return i.reply(ephemeral(petList(g, c)));
    if (sub === 'ativar') { const p = setActivePet(g, c, petId()); return i.reply(ephemeral(`⭐ ${p?.name} agora acompanha você. Patrulheiros com Chamar Companheiro o convocam como lacaio completo.`)); }
    if (sub === 'guardar') { setActivePet(g, c, null); return i.reply(ephemeral('🏠 Companheiro no estábulo.')); }
    if (sub === 'alimentar') { const r = feedPet(g, c, petId()); return i.reply(ephemeral(`🍖 Lealdade ${r.loyalty}.`)); }
    if (sub === 'renomear') { renamePet(g, c, petId(), i.options.getString('nome', true)); return i.reply(ephemeral('✏️ Nome atualizado.')); }
    if (sub === 'libertar') { const p = releasePet(g, c, petId()); return i.reply(ephemeral(`🌿 ${p.name} voltou à natureza.`)); }
    if (sub === 'missao') {
      const pv = missionPreview(g, c, petId(), i.options.getString('regiao', true), i.options.getInteger('horas', true));
      const embed = new EmbedBuilder().setColor(COLORS.ok).setTitle(`🐾 ${pv.affinity.mission} — ${pv.pet.name}`).setDescription([
        `**Região:** ${pv.region.name} • **Duração:** ${pv.realHours.toFixed(1)}h`,
        `**Ração de pet:** ${pv.food}`,
        `**Traz:** ${pv.affinity.desc}`,
        `**Risco de ferimento:** ~${Math.round(pv.injuryRisk * 100)}% (ferido traz metade e descansa 4h)`,
      ].join('\n'));
      return i.reply(ephemeral({ embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`pt:go:${pv.pet.id}:${pv.region.id}:${i.options.getInteger('horas', true)}`).setStyle(ButtonStyle.Success).setLabel('Enviar'))] }));
    }
  },
  async autocomplete(ctx, i) {
    const c = getCharacterByUser(ctx.game, i.user.id);
    if (!c) return i.respond([]);
    const f = i.options.getFocused(true);
    if (f.name === 'regiao') return i.respond(c.visited.map((r) => ({ name: regionById.get(r)!.name, value: r })));
    return i.respond(listPets(ctx.game, c.id).filter((p) => p.name.toLowerCase().includes(f.value.toLowerCase())).slice(0, 25).map((p) => ({ name: `${p.name} (nível ${p.level}, ${p.status})`, value: String(p.id) })));
  },
});

component('pt', async (ctx, i, [action, pet, region, hours]) => {
  if (action !== 'go' || !i.isButton()) return;
  const c = requireCharacter(ctx.game, i.user.id);
  const r = startPetMission(ctx.game, c, Number(pet), region, Number(hours));
  return i.update({ content: `🐾 ${r.pet.name} partiu para ${r.region.name}. Volta ${ts(r.mission.endsAt)}.`, embeds: [], components: [] });
});

// ===================================================================== contratos

function contractsView(g: Game, c: Character) {
  const list = listContracts(g, c);
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const k of list.filter((x) => !x.claimed && x.progress >= x.target).slice(0, 5)) row.addComponents(new ButtonBuilder().setCustomId(`ct:claim:${k.week}:${k.idx}`).setStyle(ButtonStyle.Success).setLabel(clip(`Receber: ${k.template.id}`, 80)));
  return {
    embeds: [new EmbedBuilder().setColor(COLORS.warn).setTitle('📜 Contratos da Companhia').setDescription(list.map((k) =>
      `${k.claimed ? '✅' : k.progress >= k.target ? '🎁' : '•'} ${k.label} — \`${bar(k.progress / k.target, 8)}\` ${k.progress}/${k.target} • ${gold(k.template.gold)} +${k.template.rep} rep`).join('\n'))
      .setFooter({ text: 'Novos contratos toda semana; os não concluídos acumulam por até 3 semanas.' })],
    components: row.components.length ? [row] : [],
  };
}

command({
  data: new SlashCommandBuilder().setName('contratos').setDescription('Contratos semanais acumuláveis'),
  async execute(ctx, i) { return i.reply(ephemeral(contractsView(ctx.game, requireCharacter(ctx.game, i.user.id)))); },
});

component('ct', async (ctx, i, [action, week, idx]) => {
  if (action !== 'claim' || !i.isButton()) return;
  const c = requireCharacter(ctx.game, i.user.id);
  const r = claimContract(ctx.game, c, Number(week), Number(idx));
  return i.update({ ...contractsView(ctx.game, c), content: `🎁 +${gold(r.gold)}, +${r.rep} reputação, +${r.xp} XP${r.levels ? ' • subiu de nível!' : ''}` });
});

// ===================================================================== mercado e encomendas

command({
  data: new SlashCommandBuilder().setName('mercado').setDescription('Compra, venda e encomendas entre jogadores')
    .addSubcommand((s) => s.setName('buscar').setDescription('Procura anúncios').addStringOption((o) => o.setName('termo').setDescription('Nome do item')))
    .addSubcommand((s) => s.setName('vender').setDescription('Anuncia itens empilháveis (preço por unidade)')
      .addStringOption((o) => o.setName('item').setDescription('Item').setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) => o.setName('quantidade').setDescription('Quantidade').setRequired(true).setMinValue(1))
      .addIntegerOption((o) => o.setName('preco').setDescription('Preço por unidade').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('vender_peca').setDescription('Anuncia uma peça única')
      .addStringOption((o) => o.setName('item').setDescription('Peça').setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) => o.setName('preco').setDescription('Preço').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('comprar').setDescription('Compra um anúncio').addIntegerOption((o) => o.setName('anuncio').setDescription('Número do anúncio').setRequired(true)).addIntegerOption((o) => o.setName('quantidade').setDescription('Quantidade').setMinValue(1)))
    .addSubcommand((s) => s.setName('meus').setDescription('Seus anúncios e encomendas'))
    .addSubcommand((s) => s.setName('cancelar').setDescription('Cancela um anúncio').addIntegerOption((o) => o.setName('anuncio').setDescription('Número').setRequired(true)))
    .addSubcommand((s) => s.setName('encomendar').setDescription('Encomenda uma peça personalizada a artesãos (materiais e pagamento ficam guardados)')
      .addStringOption((o) => o.setName('tipo').setDescription('Tipo').setRequired(true).addChoices({ name: 'Armadura', value: 'armadura' }, { name: 'Capa', value: 'capa' }, { name: 'Joia', value: 'joia' }, { name: 'Arma', value: 'arma' }))
      .addStringOption((o) => o.setName('modelo').setDescription('Modelo').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('material').setDescription('Material (do seu inventário)').setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) => o.setName('pagamento').setDescription('Ouro pago ao artesão').setRequired(true).setMinValue(1))
      .addStringOption((o) => o.setName('peca').setDescription('Parte do corpo').addChoices({ name: 'Cabeça', value: 'cabeca' }, { name: 'Torso', value: 'torso' }, { name: 'Mãos', value: 'maos' }, { name: 'Pernas', value: 'pernas' }, { name: 'Pés', value: 'pes' }))
      .addStringOption((o) => o.setName('reforco').setDescription('Reforço').addChoices(...REINFORCEMENTS.map((r) => ({ name: r.name, value: r.id }))))
      .addStringOption((o) => o.setName('forro').setDescription('Forro').addChoices(...LININGS.map((r) => ({ name: r.name, value: r.id }))))
      .addStringOption((o) => o.setName('acabamento').setDescription('Acabamento').addChoices(...FINISHES.map((r) => ({ name: r.name, value: r.id }))))
      .addStringOption((o) => o.setName('runa').setDescription('Runa (do seu inventário)').setAutocomplete(true))
      .addStringOption((o) => o.setName('gema').setDescription('Gema (joias)').setAutocomplete(true))
      .addStringOption((o) => o.setName('cor').setDescription('Cor (#rrggbb)').setMaxLength(7))
      .addUserOption((o) => o.setName('artesao').setDescription('Direcionar a um artesão específico'))
      .addStringOption((o) => o.setName('nota').setDescription('Observação').setMaxLength(200)))
    .addSubcommand((s) => s.setName('encomendas').setDescription('Encomendas abertas para artesãos'))
    .addSubcommand((s) => s.setName('cancelar_encomenda').setDescription('Cancela uma encomenda ainda não aceita').addIntegerOption((o) => o.setName('encomenda').setDescription('Número').setRequired(true))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const sub = i.options.getSubcommand();
    if (sub === 'buscar') {
      const list = searchListings(g, i.options.getString('termo') ?? undefined, 24);
      const img = list.length ? image(itemCatalog(list.map((l) => ({ item: l.data ? 'mapa' : l.itemKey, price: l.price }))), 'mercado') : undefined;
      const embed = new EmbedBuilder().setColor(COLORS.warn).setTitle('🏛️ Mercado').setDescription(list.map((l, n) =>
        `\`${n + 1}\` **#${l.id}** ${listingLabel(l)} — ${gold(l.price)}${l.data ? '' : '/un'} • ${l.sellerName} • expira ${ts(l.expiresAt)}`).join('\n') || 'Nenhum anúncio encontrado.')
        .setFooter({ text: 'Compre com /mercado comprar anuncio:<número>. Taxa de venda: 5%.' });
      if (img) embed.setImage(img.url);
      return i.reply(ephemeral({ embeds: [embed], files: img ? [img.file] : [] }));
    }
    if (sub === 'vender') { const l = createListing(g, c, { key: i.options.getString('item', true), qty: i.options.getInteger('quantidade', true) }, i.options.getInteger('preco', true)); return i.reply(ephemeral(`📢 Anúncio #${l.id}: ${listingLabel(l)} a ${gold(l.price)}/un.`)); }
    if (sub === 'vender_peca') { const l = createListing(g, c, { rowId: Number(i.options.getString('item', true)) }, i.options.getInteger('preco', true)); return i.reply(ephemeral(`📢 Anúncio #${l.id}: ${listingLabel(l)} a ${gold(l.price)}.`)); }
    if (sub === 'comprar') { const r = buyListing(g, c, i.options.getInteger('anuncio', true), i.options.getInteger('quantidade') ?? undefined); return i.reply(ephemeral(`🛍️ Comprou ${r.label} por ${gold(r.total)}.`)); }
    if (sub === 'cancelar') { cancelListing(g, c, i.options.getInteger('anuncio', true)); return i.reply(ephemeral('🗑️ Anúncio cancelado; itens devolvidos.')); }
    if (sub === 'meus') {
      const ls = myListings(g, c.id);
      const cs = myCommissions(g, c.id);
      return i.reply(ephemeral(`**Anúncios:**\n${ls.map((l) => `• #${l.id} ${listingLabel(l)} — ${gold(l.price)}`).join('\n') || '—'}\n\n**Encomendas:**\n${cs.map((x) => `• #${x.id} ${x.spec.t === 'equipamento' ? x.spec.model : ''} — ${gold(x.payment)} (${x.status})`).join('\n') || '—'}`));
    }
    if (sub === 'encomendar') {
      const kind = i.options.getString('tipo', true) as EquipSpec['kind'];
      const model = i.options.getString('modelo', true);
      const spec: EquipSpec = {
        t: 'equipamento', kind, model, material: i.options.getString('material', true),
        piece: (kind === 'joia' ? (model === 'amuleto' ? 'amuleto' : 'anel') : i.options.getString('peca') ?? undefined) as EquipSpec['piece'],
        reinforcement: i.options.getString('reforco') ?? undefined, lining: i.options.getString('forro') ?? undefined, finish: i.options.getString('acabamento') ?? undefined,
        runes: i.options.getString('runa') ? [i.options.getString('runa')!] : [], gem: i.options.getString('gema') ?? undefined, color: i.options.getString('cor') ?? undefined,
      };
      const crafterUser = i.options.getUser('artesao');
      const crafter = crafterUser ? getCharacterByUser(g, crafterUser.id) ?? fail('Esse artesão não tem aventureiro.') : undefined;
      const com = createCommission(g, c, spec, i.options.getInteger('pagamento', true), i.options.getString('nota') ?? '', crafter?.id);
      return i.reply(`📦 Encomenda #${com.id} aberta por ${c.name}: ${model} de ${itemName(spec.material)} — ${gold(com.payment)}. Artesãos podem aceitar em \`/mercado encomendas\`.`);
    }
    if (sub === 'encomendas') {
      const list = openCommissions(g, c.id);
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const x of list.slice(0, 5)) row.addComponents(new ButtonBuilder().setCustomId(`mk:accept:${x.id}`).setStyle(ButtonStyle.Success).setLabel(`Aceitar #${x.id}`));
      return i.reply(ephemeral({ content: list.map((x) => `• **#${x.id}** de ${x.requesterName}: ${x.spec.t === 'equipamento' ? `${x.spec.model} de ${itemName(x.spec.material)}${x.spec.piece ? ` (${x.spec.piece})` : ''}${x.spec.reinforcement ? `, ${x.spec.reinforcement}` : ''}` : ''} — ${gold(x.payment)}${x.note ? ` — _${x.note}_` : ''}`).join('\n') || 'Nenhuma encomenda aberta.', components: row.components.length ? [row] : [] }));
    }
    if (sub === 'cancelar_encomenda') { cancelCommission(g, c, i.options.getInteger('encomenda', true)); return i.reply(ephemeral('🗑️ Encomenda cancelada; materiais e pagamento devolvidos.')); }
  },
  async autocomplete(ctx, i) {
    const g = ctx.game;
    const c = getCharacterByUser(g, i.user.id);
    if (!c) return i.respond([]);
    const f = i.options.getFocused(true);
    const q = f.value.toLowerCase();
    const sub = i.options.getSubcommand();
    if (sub === 'vender_peca') return i.respond(uniqueItems(g, c).filter((x) => !x.slot && !x.bound && x.data.name.toLowerCase().includes(q)).slice(0, 25).map((x) => ({ name: clip(x.data.name, 100), value: String(x.id) })));
    if (f.name === 'modelo') {
      const t = i.options.getString('tipo');
      const ms = t === 'armadura' ? ARMOR_MODELS : t === 'capa' ? CLOAK_MODELS : t === 'joia' ? JEWELRY_MODELS : WEAPON_MODELS;
      return i.respond(ms.filter((m) => m.name.toLowerCase().includes(q)).map((m) => ({ name: m.name, value: m.id })));
    }
    const rows = g.db.all<{ item_key: string; qty: number }>("SELECT item_key, qty FROM items WHERE owner_kind='char' AND owner_id=? AND data IS NULL AND qty > 0", c.id);
    const pick = (fn: (k: string) => boolean) => i.respond(rows.filter((r) => fn(r.item_key) && (itemById.get(r.item_key)?.name.toLowerCase().includes(q) ?? false)).slice(0, 25).map((r) => ({ name: `${itemById.get(r.item_key)!.name} (${r.qty})`, value: r.item_key })));
    if (f.name === 'material') return pick((k) => materialByItem.has(k));
    if (f.name === 'runa') return pick((k) => k.startsWith('runa-'));
    if (f.name === 'gema') return pick((k) => materialByItem.get(k)?.family === 'cristal');
    return pick((k) => !itemById.get(k)?.untradeable);
  },
});

component('mk', async (ctx, i, [action, id]) => {
  if (action !== 'accept' || !i.isButton()) return;
  const c = requireCharacter(ctx.game, i.user.id);
  const r = acceptCommission(ctx.game, c, Number(id));
  return i.update({ content: `🔨 Encomenda #${r.commission.id} aceita: **${r.queue.analysis.label}** pronta ${ts(r.queue.row.ends_at)}. O pagamento chega na entrega.`, components: [] });
});

// ===================================================================== guilda

const RANK_CHOICES = (Object.keys(GUILD_RANKS) as GuildRank[]).map((r) => ({ name: GUILD_RANKS[r].label, value: r }));

command({
  data: new SlashCommandBuilder().setName('guilda').setDescription('Guildas: sede, membros, cofre e projetos')
    .addSubcommand((s) => s.setName('ver').setDescription('Sede e informações'))
    .addSubcommand((s) => s.setName('criar').setDescription('Funda uma guilda (1000 ouro)').addStringOption((o) => o.setName('nome').setDescription('Nome').setRequired(true).setMaxLength(32)).addStringOption((o) => o.setName('sigla').setDescription('Sigla (2–5)').setRequired(true).setMaxLength(5)))
    .addSubcommand((s) => s.setName('convidar').setDescription('Convida alguém').addUserOption((o) => o.setName('usuario').setDescription('Quem').setRequired(true)))
    .addSubcommand((s) => s.setName('membros').setDescription('Lista de membros'))
    .addSubcommand((s) => s.setName('cargo').setDescription('Define o cargo de um membro').addUserOption((o) => o.setName('usuario').setDescription('Quem').setRequired(true)).addStringOption((o) => o.setName('cargo').setDescription('Cargo').setRequired(true).addChoices(...RANK_CHOICES)))
    .addSubcommand((s) => s.setName('expulsar').setDescription('Remove um membro').addUserOption((o) => o.setName('usuario').setDescription('Quem').setRequired(true)))
    .addSubcommand((s) => s.setName('sair').setDescription('Sai da guilda'))
    .addSubcommand((s) => s.setName('cofre').setDescription('Cofre e registro de movimentações'))
    .addSubcommand((s) => s.setName('depositar').setDescription('Deposita no cofre').addStringOption((o) => o.setName('item').setDescription('Item ou "ouro"').setRequired(true).setAutocomplete(true)).addIntegerOption((o) => o.setName('quantidade').setDescription('Quantidade').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('retirar').setDescription('Retira do cofre (limite diário por cargo)').addStringOption((o) => o.setName('item').setDescription('Item ou "ouro"').setRequired(true).setAutocomplete(true)).addIntegerOption((o) => o.setName('quantidade').setDescription('Quantidade').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('projeto').setDescription('Inicia uma melhoria da sede').addStringOption((o) => o.setName('melhoria').setDescription('Melhoria').setRequired(true).addChoices(...GUILD_UPGRADES.map((u) => ({ name: `${u.name} — ${u.desc}`.slice(0, 100), value: u.id })))))
    .addSubcommand((s) => s.setName('contribuir').setDescription('Contribui com o projeto (ouro ou material)').addStringOption((o) => o.setName('item').setDescription('Material ou "ouro"').setRequired(true).setAutocomplete(true)).addIntegerOption((o) => o.setName('quantidade').setDescription('Quantidade').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('estandarte').setDescription('Personaliza o estandarte')
      .addStringOption((o) => o.setName('cor').setDescription('Cor principal (#rrggbb)').setMaxLength(7))
      .addStringOption((o) => o.setName('cor2').setDescription('Cor do símbolo (#rrggbb)').setMaxLength(7))
      .addStringOption((o) => o.setName('simbolo').setDescription('Símbolo').addChoices(...['estrela', 'lua', 'sol', 'coroa', 'espada', 'escudo', 'olho', 'folha', 'raio', 'caveira', 'torre', 'nota', 'pata', 'fogo', 'gelo', 'espiral'].filter((x) => x in GLYPHS).map((x) => ({ name: x, value: x }))))
      .addStringOption((o) => o.setName('descricao').setDescription('Descrição').setMaxLength(300))),
  async execute(ctx, i) {
    const g = ctx.game;
    const c = requireCharacter(g, i.user.id);
    const sub = i.options.getSubcommand();
    const hex = (s: string | null) => (s && /^#[0-9a-f]{6}$/i.test(s) ? s : undefined);
    if (sub === 'criar') { const gu = createGuild(g, c, i.options.getString('nome', true), i.options.getString('sigla', true)); return i.reply(`🏰 A guilda **${gu.name} [${gu.tag}]** foi fundada!`); }
    if (sub === 'convidar') {
      const u = i.options.getUser('usuario', true);
      const t = getCharacterByUser(g, u.id) ?? fail('Essa pessoa não tem aventureiro.');
      const gu = inviteToGuild(g, c, t!);
      return i.reply({ content: `🏰 <@${u.id}>, você foi convidado para **${gu.name}**.`, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`gd:join:${gu.id}`).setLabel('Aceitar').setStyle(ButtonStyle.Success))] });
    }
    if (sub === 'sair') { leaveGuild(g, c); return i.reply(ephemeral('Você saiu da guilda.')); }
    const gu = guildOf(g, c.id);
    if (!gu) {
      const inv = pendingGuildInvites(g, c.id);
      fail(`Você não está em uma guilda.${inv.length ? ` Convites: ${inv.map((x) => x.name).join(', ')}.` : ' Crie uma com `/guilda criar`.'}`);
    }
    if (sub === 'ver') {
      const ms = members(g, gu!.id);
      const img = image(guildHall(gu!.name, gu!.tag, gu!.upgrades, gu!.banner, ms.length), 'sede');
      const p = gu!.project;
      const projText = p ? `**${guildUpgradeById.get(p.upgrade)?.name} ${p.level}** — ouro ${p.gold}/${p.need.gold} • trabalho ${p.work}/${p.need.work}h • ${p.need.items.map(([k, q]) => `${itemName(k)} ${p.items[k] ?? 0}/${q}`).join(', ')}` : 'nenhum';
      return i.reply({ embeds: [new EmbedBuilder().setColor(parseInt((gu!.banner.color ?? '#7040a0').slice(1), 16)).setTitle(`🏰 ${gu!.name} [${gu!.tag}]`).setImage(img.url).setDescription([
        gu!.description || '_Sem descrição._',
        `Membros: ${ms.length}/${memberCap(gu!)} • Cofre: ${gold(gu!.gold)}`,
        `Melhorias: ${GUILD_UPGRADES.map((u) => `${u.name} ${guildUpgradeLevel(gu!, u.id)}/${u.maxLevel}`).join(' • ')}`,
        `Projeto: ${projText}`,
      ].join('\n'))], files: [img.file] });
    }
    if (sub === 'membros') return i.reply(ephemeral(members(g, gu!.id).map((m) => `• **${m.name}** — ${GUILD_RANKS[m.rank].label} • contribuiu ${m.contributed}`).join('\n')));
    if (sub === 'cargo') { const t = getCharacterByUser(g, i.options.getUser('usuario', true).id) ?? fail('Sem aventureiro.'); setRank(g, c, t!, i.options.getString('cargo', true) as GuildRank); return i.reply('✅ Cargo atualizado.'); }
    if (sub === 'expulsar') { const t = getCharacterByUser(g, i.options.getUser('usuario', true).id) ?? fail('Sem aventureiro.'); kick(g, c, t!); return i.reply('✅ Membro removido.'); }
    if (sub === 'cofre') {
      const items = vault(g, gu!.id).filter((x) => !x.data);
      const log = vaultLog(g, gu!.id, 12);
      const img = items.length ? image(itemCatalog(items.slice(0, 40).map((x) => ({ item: x.item_key, qty: x.qty }))), 'cofre') : undefined;
      const embed = new EmbedBuilder().setColor(COLORS.warn).setTitle(`🗝️ Cofre — ${gold(gu!.gold)}`)
        .setDescription(`Limite diário de retirada (${GUILD_RANKS[gu!.rank].label}): ${GUILD_RANKS[gu!.rank].vaultWithdrawPerDay === Infinity ? 'ilimitado' : GUILD_RANKS[gu!.rank].vaultWithdrawPerDay}\n\n**Registro:**\n` +
          (log.map((l) => `${ts(l.at, 'R')} ${l.name ?? 'sistema'} — ${l.action}${l.item_key ? ` ${l.qty}× ${itemName(l.item_key)}` : ''}${l.gold ? ` ${gold(l.gold)}` : ''}${l.note ? ` (${l.note})` : ''}`).join('\n') || '—'));
      if (img) embed.setImage(img.url);
      return i.reply(ephemeral({ embeds: [embed], files: img ? [img.file] : [] }));
    }
    const item = () => i.options.getString('item', true);
    const qty = () => i.options.getInteger('quantidade', true);
    if (sub === 'depositar') { if (item() === 'ouro') depositGold(g, c, qty()); else depositItem(g, c, item(), qty()); return i.reply(ephemeral('✅ Depósito registrado.')); }
    if (sub === 'retirar') { withdraw(g, c, item(), qty()); return i.reply(ephemeral('✅ Retirada registrada.')); }
    if (sub === 'projeto') { const p = startProject(g, c, i.options.getString('melhoria', true)); return i.reply(`🏗️ Projeto iniciado: ${guildUpgradeById.get(p.upgrade)?.name} ${p.level}. Contribua com ouro, materiais ou horas de trabalho (ordens de trabalho dos membros contam automaticamente).`); }
    if (sub === 'contribuir') { const r = contribute(g, c, item() === 'ouro' ? 'ouro' : 'item', item(), qty()); return i.reply(r?.done ? '🎉 Projeto concluído! A sede foi melhorada.' : '🧱 Contribuição registrada.'); }
    if (sub === 'estandarte') { setBanner(g, c, { color: hex(i.options.getString('cor')), color2: hex(i.options.getString('cor2')), symbol: i.options.getString('simbolo') ?? undefined }, i.options.getString('descricao') ?? undefined); return i.reply(ephemeral('🎨 Estandarte atualizado.')); }
  },
  async autocomplete(ctx, i) {
    const g = ctx.game;
    const c = getCharacterByUser(g, i.user.id);
    if (!c) return i.respond([]);
    const q = i.options.getFocused().toLowerCase();
    const sub = i.options.getSubcommand();
    const base = [{ name: 'Ouro', value: 'ouro' }];
    if (sub === 'retirar') {
      const gu = guildOf(g, c.id);
      const items = gu ? vault(g, gu.id).filter((x) => !x.data) : [];
      return i.respond([...base, ...items.map((x) => ({ name: `${itemName(x.item_key)} (${x.qty})`, value: x.item_key }))].filter((x) => x.name.toLowerCase().includes(q)).slice(0, 25));
    }
    const rows = g.db.all<{ item_key: string; qty: number }>("SELECT item_key, qty FROM items WHERE owner_kind='char' AND owner_id=? AND data IS NULL AND qty > 0", c.id);
    return i.respond([...base, ...rows.map((r) => ({ name: `${itemName(r.item_key)} (${r.qty})`, value: r.item_key }))].filter((x) => x.name.toLowerCase().includes(q)).slice(0, 25));
  },
});

component('gd', async (ctx, i, [action, id]) => {
  if (action !== 'join' || !i.isButton()) return;
  const c = requireCharacter(ctx.game, i.user.id);
  const gu = acceptGuildInvite(ctx.game, c, Number(id));
  return i.reply(`🏰 ${c.name} entrou em **${gu.name}**!`);
});

void itemList; void getPet; void HAZARD_INFO;
